import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { achievements, actions, businesses, education, housing, jobs, purchases, recovery } from './game/data';
import {
  buyHousing,
  buyItem,
  createNewLife,
  enrollEducation,
  getAge,
  getBusinessUpgradeCost,
  getClockLabel,
  getDailyExpenses,
  getDayNumber,
  getNetWorth,
  getPassiveIncomePerDay,
  investCash,
  normalizeState,
  payDebt,
  performAction,
  recover,
  restartLife,
  sellInvestments,
  transferToSavings,
  upgradeBusiness,
  withdrawSavings,
  workShift
} from './game/engine';
import { EducationType, HousingType, LifeState } from './game/types';
import { loadGame, saveGame } from './storage';
import { preloadRewardedAd, showRewardedAd } from './ads';

type Page = 'home' | 'work' | 'life' | 'money' | 'empire';
type RewardKind = 'restore' | 'double' | 'cash';

const C = {
  bg: '#07090b', panel: '#11161a', panel2: '#151c20', border: '#273137',
  text: '#f7f9fa', muted: '#89959c', dim: '#5e6a71', lime: '#d7ff45',
  green: '#67e8a0', blue: '#78b7ff', orange: '#ffb65d', red: '#ff8686', purple: '#b992ff'
};

const money = (value: number) => value.toLocaleString('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: Math.abs(value) < 1000 ? 2 : 0,
  maximumFractionDigits: Math.abs(value) < 1000 ? 2 : 0
});
const duration = (minutes: number) => minutes >= 1440 ? `${Math.round(minutes / 1440)} days` : minutes >= 60 ? `${minutes / 60} hr` : `${minutes} min`;
const clamp = (value: number) => Math.max(0, Math.min(100, value));

function rankFor(netWorth: number) {
  if (netWorth < 0) return { title: 'DIGGING OUT', sub: 'Get back above zero.', accent: C.red };
  if (netWorth < 100) return { title: 'STARTING FROM ZERO', sub: 'Every dollar matters.', accent: C.orange };
  if (netWorth < 1000) return { title: 'GETTING TRACTION', sub: 'Stability is within reach.', accent: C.blue };
  if (netWorth < 10000) return { title: 'ON THE RISE', sub: 'Money is finally working for you.', accent: C.green };
  if (netWorth < 100000) return { title: 'BUILDING AN EMPIRE', sub: 'Scale what works.', accent: C.lime };
  return { title: 'BOTTOM DOLLAR LEGEND', sub: 'You built something massive.', accent: C.purple };
}

export default function BottomDollarAppFinal() {
  const [state, setState] = useState<LifeState>(createNewLife());
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>('home');
  const [notice, setNotice] = useState('You have nothing to lose. Start hustling.');
  const [adBusy, setAdBusy] = useState(false);
  const [adCooldownUntil, setAdCooldownUntil] = useState(0);

  useEffect(() => {
    loadGame().then(saved => {
      if (saved) setState(normalizeState(saved));
      setReady(true);
    });
    preloadRewardedAd().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => saveGame(state), 250);
    return () => clearTimeout(timer);
  }, [state, ready]);

  const age = getAge(state);
  const day = getDayNumber(state);
  const clock = getClockLabel(state);
  const netWorth = getNetWorth(state);
  const passive = getPassiveIncomePerDay(state);
  const expenses = getDailyExpenses(state);
  const dailyNet = passive - expenses;
  const currentJob = useMemo(() => jobs.find(j => j.id === state.currentJobId), [state.currentJobId]);
  const businessCount = Object.values(state.businesses).filter(level => level > 0).length;
  const rank = rankFor(netWorth);
  const doubleReady = (state.stats.doubleNextPay ?? 0) > 0;
  const nextMilestone = netWorth < 100 ? 100 : netWorth < 1000 ? 1000 : netWorth < 10000 ? 10000 : netWorth < 100000 ? 100000 : 1000000;
  const milestoneProgress = clamp((Math.max(0, netWorth) / nextMilestone) * 100);
  const quickAmounts = [50, 250, 1000];

  const commit = (next: LifeState, message: string, big = false) => {
    if (next === state) return;
    setState(next);
    setNotice(message);
    if (big) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const consumeDouble = (before: LifeState, next: LifeState) => {
    if ((before.stats.doubleNextPay ?? 0) <= 0 || next === before) return next;
    const gain = Math.max(0, next.cash - before.cash);
    if (gain <= 0) return { ...next, stats: { ...next.stats, doubleNextPay: 0 } };
    return {
      ...next,
      cash: Math.round((next.cash + gain) * 100) / 100,
      stats: { ...next.stats, doubleNextPay: 0, earned: (next.stats.earned ?? 0) + gain }
    };
  };

  const doAction = (id: string, label: string) => {
    const next = consumeDouble(state, performAction(state, id));
    const gain = Math.max(0, next.cash - state.cash);
    commit(next, `${label} paid ${money(gain)}${doubleReady ? ' · 2× BOOST!' : ''}`, true);
  };

  const doShift = (id: string, title: string, hours: number) => {
    const next = consumeDouble(state, workShift(state, id));
    const gain = Math.max(0, next.cash - state.cash);
    commit(next, `${hours}h ${title} shift complete · +${money(gain)}${doubleReady ? ' · 2× BOOST!' : ''}`, true);
  };

  const applyReward = (kind: RewardKind) => {
    if (kind === 'restore') {
      commit({ ...state, energy: 100, health: clamp(state.health + 18), happiness: clamp(state.happiness + 16) }, 'BOOST CLAIMED · Fully recharged and ready to grind.', true);
      return;
    }
    if (kind === 'double') {
      commit({ ...state, stats: { ...state.stats, doubleNextPay: 1 } }, 'BOOST CLAIMED · Your next active payout is doubled.', true);
      return;
    }
    const bonus = Math.max(35, Math.min(7500, Math.round(Math.max(75, Math.abs(netWorth) * 0.025))));
    commit({ ...state, cash: state.cash + bonus, stats: { ...state.stats, earned: (state.stats.earned ?? 0) + bonus } }, `SPONSOR DROP · +${money(bonus)} cash.`, true);
  };

  const grantReward = async (kind: RewardKind) => {
    const now = Date.now();
    if (adBusy || now < adCooldownUntil) {
      if (now < adCooldownUntil) setNotice('Sponsor is resetting. Try again in a few seconds.');
      return;
    }
    setAdBusy(true);
    setNotice('Calling in a sponsor...');
    const earned = await showRewardedAd();
    setAdBusy(false);
    if (!earned) {
      setNotice('Sponsor unavailable right now. Try again shortly.');
      preloadRewardedAd().catch(() => undefined);
      return;
    }
    setAdCooldownUntil(Date.now() + 15000);
    applyReward(kind);
  };

  if (state.dead) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar hidden />
        <View style={styles.deathScreen}>
          <Text style={styles.deathKicker}>RUN ENDED</Text>
          <Text style={styles.deathTitle}>The bottom won this round.</Text>
          <Text style={styles.deathReason}>{state.deathReason}</Text>
          <View style={styles.deathStats}>
            <MiniStat label="AGE" value={age.toFixed(1)} />
            <MiniStat label="NET WORTH" value={money(netWorth)} />
            <MiniStat label="BEST" value={money(state.bestNetWorth)} />
          </View>
          <Text style={styles.deathFlavor}>You know more now. Build smarter next life.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => { setState(restartLife(state)); setPage('home'); setNotice('Fresh start. Make it count.'); }}>
            <Text style={styles.primaryButtonText}>RUN IT BACK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderHome = () => (
    <>
      <View style={[styles.rankCard, { borderColor: `${rank.accent}55` }]}> 
        <View style={styles.rowBetween}><Text style={[styles.rankLabel, { color: rank.accent }]}>{rank.title}</Text><Text style={styles.rankAge}>AGE {age.toFixed(1)}</Text></View>
        <Text style={styles.rankSub}>{rank.sub}</Text>
        <Text style={styles.heroMoney}>{money(netWorth)}</Text>
        <Text style={styles.heroCaption}>TOTAL NET WORTH</Text>
        <View style={styles.milestoneTrack}><View style={[styles.milestoneFill, { width: `${milestoneProgress}%`, backgroundColor: rank.accent }]} /></View>
        <View style={styles.rowBetween}><Text style={styles.trackText}>Next target</Text><Text style={styles.trackValue}>{money(nextMilestone)}</Text></View>
      </View>

      <View style={styles.noticeCard}><Text style={styles.noticeIcon}>⚡</Text><Text style={styles.noticeText}>{notice}</Text></View>

      <View style={styles.kpiRow}>
        <Kpi label="CASH" value={money(state.cash)} tone={C.lime} />
        <Kpi label="PASSIVE / DAY" value={money(passive)} tone={C.green} />
        <Kpi label="DAILY NET" value={money(dailyNet)} tone={dailyNet >= 0 ? C.blue : C.red} />
      </View>

      <Section title="YOUR LIFE" subtitle="The stuff standing between you and the top">
        <View style={styles.lifeGrid}>
          <LifeCard icon="⌂" label="HOUSING" value={state.housing} accent={C.blue} />
          <LifeCard icon="$" label="JOB" value={currentJob?.title ?? 'Unemployed'} accent={C.lime} />
          <LifeCard icon="◆" label="EDUCATION" value={state.education} accent={C.purple} />
          <LifeCard icon="▲" label="BUSINESSES" value={`${businessCount} running`} accent={C.orange} />
        </View>
      </Section>

      <View style={styles.challengeCard}>
        <Text style={styles.challengeKicker}>THE CHALLENGE</Text>
        <Text style={styles.challengeTitle}>Go from broke to untouchable.</Text>
        <Text style={styles.challengeBody}>Work, recover, upgrade your life, invest, and build businesses. Time keeps moving whether your plan is good or not.</Text>
      </View>
    </>
  );

  const renderWork = () => (
    <>
      <PageIntro kicker="ACTIVE INCOME" title="HUSTLE" subtitle="Trade time and energy for the cash that gets everything started." />
      {doubleReady ? <View style={styles.boostActive}><Text style={styles.boostActiveText}>⚡ 2× NEXT PAYOUT ARMED</Text></View> : null}
      <Section title="RECOVER" subtitle="You can't grind at zero">
        {recovery.map(option => {
          const unlocked = !option.requires || option.requires(state);
          const affordable = state.cash >= option.cost;
          const detail = unlocked ? `${duration(option.minutes)} · +${option.energyGain} EN${option.healthGain ? ` · +${option.healthGain} HP` : ''}${option.happinessGain ? ` · ${option.happinessGain > 0 ? '+' : ''}${option.happinessGain} HAP` : ''}` : option.requirementText ?? 'Locked';
          return <ActionCard key={option.id} title={option.label} detail={detail} badge={option.cost ? money(option.cost) : 'FREE'} disabled={!unlocked || !affordable} reason={unlocked && !affordable ? `${money(option.cost - state.cash)} short` : undefined} onPress={() => commit(recover(state, option.id), `${option.label} complete.`, true)} />;
        })}
      </Section>
      <Section title="QUICK CASH" subtitle="Scrappy work. Immediate money.">
        {actions.map(action => {
          const unlocked = !action.requires || action.requires(state);
          const enough = state.energy >= action.energyCost;
          return <ActionCard key={action.id} title={action.label} detail={unlocked ? `${money(action.minCash)}–${money(action.maxCash)} · ${duration(action.minutes)} · -${action.energyCost} EN` : action.requirementText ?? 'Locked'} badge="HUSTLE" disabled={!unlocked || !enough} reason={unlocked && !enough ? `Need ${action.energyCost} energy` : undefined} onPress={() => doAction(action.id, action.label)} />;
        })}
      </Section>
      <Section title="CAREER LADDER" subtitle="Unlock better work and leave survival mode behind">
        {jobs.map(job => {
          const unlocked = !job.requires || job.requires(state);
          const enough = state.energy >= job.energyCost;
          return <ActionCard key={job.id} title={job.title} detail={unlocked ? `${job.shiftHours}h shift · ${money(job.hourlyPay * job.shiftHours)} gross · -${job.energyCost} EN` : job.requirementText ?? 'Locked'} badge={state.currentJobId === job.id ? 'CURRENT' : `${money(job.hourlyPay)}/HR`} disabled={!unlocked || !enough} reason={unlocked && !enough ? `Need ${job.energyCost} energy` : undefined} onPress={() => doShift(job.id, job.title, job.shiftHours)} />;
        })}
      </Section>
    </>
  );

  const renderLife = () => (
    <>
      <PageIntro kicker="UPGRADE YOURSELF" title="LIFE" subtitle="Buy stability. Unlock mobility. Become eligible for better opportunities." />
      <Section title="ESSENTIALS" subtitle="Tiny purchases that change what's possible">
        {purchases.map(item => {
          const owned = state.inventory.includes(item.id);
          return <ActionCard key={item.id} title={item.label} detail={item.description} badge={owned ? 'OWNED' : money(item.cost)} disabled={owned || state.cash < item.cost} reason={!owned && state.cash < item.cost ? `${money(item.cost - state.cash)} short` : undefined} onPress={() => commit(buyItem(state, item.id, item.cost), `${item.label} acquired. New doors opened.`, true)} />;
        })}
      </Section>
      <Section title="HOUSING" subtitle="More stability, more recurring cost">
        {housing.map(option => {
          const current = state.housing === option.id;
          const unlocked = !option.requires || option.requires(state);
          return <ActionCard key={option.id} title={option.label} detail={current ? `${money(option.dailyCost)}/day · This is home.` : unlocked ? `${option.description} · ${money(option.dailyCost)}/day` : option.requirementText ?? 'Locked'} badge={current ? 'CURRENT' : money(option.cost)} disabled={current || !unlocked || state.cash < option.cost} reason={!current && unlocked && state.cash < option.cost ? `${money(option.cost - state.cash)} short` : undefined} onPress={() => commit(buyHousing(state, option.id as HousingType), `Moved into ${option.label}.`, true)} />;
        })}
      </Section>
      <Section title="EDUCATION" subtitle="Spend now to raise your ceiling">
        {education.map(option => {
          const complete = state.education === option.id || (state.education === 'Trade Certificate' && option.id === 'GED');
          const unlocked = !option.requires || option.requires(state);
          return <ActionCard key={option.id} title={option.label} detail={complete ? 'Completed.' : unlocked ? `${option.days} days · ${option.description}` : option.requirementText ?? 'Locked'} badge={complete ? 'DONE' : money(option.cost)} disabled={complete || !unlocked || state.cash < option.cost} reason={!complete && unlocked && state.cash < option.cost ? `${money(option.cost - state.cash)} short` : undefined} onPress={() => commit(enrollEducation(state, option.id as EducationType), `${option.label} complete. Career ceiling raised.`, true)} />;
        })}
      </Section>
    </>
  );

  const renderMoney = () => (
    <>
      <PageIntro kicker="MAKE IT WORK" title="MONEY" subtitle="Cash keeps you alive. Assets are how you escape." />
      <View style={styles.moneyBoard}>
        <MiniStat label="CASH" value={money(state.cash)} />
        <MiniStat label="SAVINGS" value={money(state.savings)} />
        <MiniStat label="INVESTED" value={money(state.investments)} />
        <MiniStat label="DEBT" value={money(state.debt)} />
      </View>
      <Section title="SAVINGS" subtitle="Safe, boring, useful">
        <FinanceHero label="SAVINGS BALANCE" value={money(state.savings)} sub="Build a cushion before one bad day wrecks your run." accent={C.blue} />
        <QuickButtons amounts={quickAmounts} prefix="Save" disabled={amount => state.cash < amount} onPress={amount => commit(transferToSavings(state, amount), `${money(amount)} protected in savings.`)} />
        <QuickButtons amounts={quickAmounts} prefix="Withdraw" disabled={amount => state.savings < amount} onPress={amount => commit(withdrawSavings(state, amount), `${money(amount)} moved back to cash.`)} />
      </Section>
      <Section title="INVEST" subtitle="Let time do some of the work">
        <FinanceHero label="MARKET VALUE" value={money(state.investments)} sub="Investments grow with in-game time and count toward net worth." accent={C.green} />
        <QuickButtons amounts={quickAmounts} prefix="Invest" disabled={amount => state.cash < amount} onPress={amount => commit(investCash(state, amount), `${money(amount)} put to work.`)} />
        <QuickButtons amounts={quickAmounts} prefix="Sell" disabled={amount => state.investments < amount} onPress={amount => commit(sellInvestments(state, amount), `${money(amount)} sold back to cash.`)} />
      </Section>
      {state.debt > 0 ? <Section title="DEBT" subtitle="Kill the drag on your net worth"><FinanceHero label="YOU OWE" value={money(state.debt)} sub="Every payment gets you closer to breathing room." accent={C.red} /><QuickButtons amounts={quickAmounts} prefix="Pay" disabled={() => state.cash <= 0} onPress={amount => commit(payDebt(state, amount), 'Debt chopped down.')} /></Section> : null}
    </>
  );

  const renderEmpire = () => (
    <>
      <PageIntro kicker="PASSIVE POWER" title="EMPIRE" subtitle="Stop selling every hour of your life. Build things that pay you back." />
      <View style={styles.passiveHero}>
        <Text style={styles.passiveKicker}>YOUR MACHINE MAKES</Text>
        <Text style={styles.passiveValue}>{money(passive)}<Text style={styles.passivePer}> / day</Text></Text>
        <Text style={styles.passiveSub}>Expenses {money(expenses)} · Net passive {money(dailyNet)}</Text>
      </View>

      <Section title="SPONSOR BOOSTS" subtitle="Optional rewarded ads · no daily cap">
        <View style={styles.sponsorNote}><Text style={styles.sponsorNoteTitle}>YOU'RE IN CONTROL</Text><Text style={styles.sponsorNoteText}>Boosts are optional. Watch when you want a push; otherwise keep playing normally.</Text></View>
        <BoostCard icon="⚡" title="Full Recharge" detail="Restore energy to 100 and top up health + happiness." badge={adBusy ? 'LOADING' : 'WATCH AD'} disabled={adBusy} onPress={() => grantReward('restore')} />
        <BoostCard icon="2×" title="Double Next Payout" detail="Your next quick-cash action or job shift pays double." badge={doubleReady ? 'ACTIVE' : adBusy ? 'LOADING' : 'WATCH AD'} disabled={doubleReady || adBusy} onPress={() => grantReward('double')} />
        <BoostCard icon="$" title="Sponsor Cash Drop" detail="Get a cash injection scaled to your current progress." badge={adBusy ? 'LOADING' : 'WATCH AD'} disabled={adBusy} onPress={() => grantReward('cash')} />
      </Section>

      <Section title="BUSINESSES" subtitle="Launch. Upgrade. Compound.">
        {businesses.map(business => {
          const level = state.businesses[business.id] ?? 0;
          const unlocked = !business.requires || business.requires(state);
          const cost = getBusinessUpgradeCost(state, business.id);
          const maxed = level >= business.maxLevel;
          const income = level <= 0 ? business.dailyIncome : business.dailyIncome * level * (1 + Math.max(0, level - 1) * 0.12);
          return <ActionCard key={business.id} title={business.label} detail={!unlocked ? business.requirementText ?? 'Locked' : level > 0 ? `${money(income)}/day · Next upgrade ${money(cost)}` : `${business.description} · Starts at ${money(business.dailyIncome)}/day`} badge={maxed ? 'MAXED' : level > 0 ? `LV ${level}` : `LAUNCH ${money(cost)}`} disabled={!unlocked || maxed || state.cash < cost} reason={unlocked && !maxed && state.cash < cost ? `${money(cost - state.cash)} short` : undefined} onPress={() => commit(upgradeBusiness(state, business.id), level === 0 ? `${business.label} launched. Passive income online.` : `${business.label} upgraded to level ${level + 1}.`, true)} />;
        })}
      </Section>

      <Section title="ACHIEVEMENTS" subtitle={`${state.achievements.length}/${achievements.length} unlocked`}>
        {achievements.map(item => {
          const unlocked = state.achievements.includes(item.id);
          return <View key={item.id} style={[styles.achievement, unlocked && styles.achievementUnlocked]}><Text style={[styles.achievementMark, unlocked && styles.achievementMarkOn]}>{unlocked ? '★' : '○'}</Text><View style={{ flex: 1 }}><Text style={[styles.achievementTitle, !unlocked && styles.disabledText]}>{item.label}</Text><Text style={styles.achievementBody}>{unlocked ? item.description : 'Keep climbing to reveal this milestone.'}</Text></View></View>;
        })}
      </Section>
    </>
  );

  const content = page === 'home' ? renderHome() : page === 'work' ? renderWork() : page === 'life' ? renderLife() : page === 'money' ? renderMoney() : renderEmpire();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar hidden />
      <View style={styles.shell}>
        <View style={styles.topArea}>
          <View style={styles.header}>
            <View><Text style={styles.brand}>BOTTOM <Text style={styles.brandAccent}>DOLLAR</Text></Text><Text style={styles.brandSub}>FROM ZERO TO EMPIRE</Text></View>
            <View style={styles.timeBadge}><Text style={styles.timeMain}>DAY {day}</Text><Text style={styles.timeSub}>{clock}</Text></View>
          </View>
          <View style={styles.vitals}>
            <Vital label="EN" value={state.energy} color={C.lime} />
            <Vital label="HP" value={state.health} color={C.green} />
            <Vital label="HAP" value={state.happiness} color={C.blue} />
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {content}
          <Text style={styles.footer}>MT64 LABS · BOTTOM DOLLAR</Text>
        </ScrollView>

        <View style={styles.nav}>
          <NavItem icon="⌂" label="HOME" active={page === 'home'} onPress={() => setPage('home')} />
          <NavItem icon="$" label="HUSTLE" active={page === 'work'} onPress={() => setPage('work')} />
          <NavItem icon="◆" label="LIFE" active={page === 'life'} onPress={() => setPage('life')} />
          <NavItem icon="▤" label="MONEY" active={page === 'money'} onPress={() => setPage('money')} />
          <NavItem icon="▲" label="EMPIRE" active={page === 'empire'} onPress={() => setPage('empire')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function PageIntro({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) {
  return <View><Text style={styles.pageKicker}>{kicker}</Text><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSub}>{subtitle}</Text></View>;
}
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <View style={styles.section}><View><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}</View>{children}</View>;
}
function Vital({ label, value, color }: { label: string; value: number; color: string }) {
  return <View style={styles.vital}><View style={styles.rowBetween}><Text style={styles.vitalLabel}>{label}</Text><Text style={styles.vitalValue}>{Math.round(value)}</Text></View><View style={styles.vitalTrack}><View style={[styles.vitalFill, { width: `${clamp(value)}%`, backgroundColor: color }]} /></View></View>;
}
function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) { return <View style={styles.kpi}><Text style={styles.kpiLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, { color: tone }]}>{value}</Text></View>; }
function LifeCard({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) { return <View style={styles.lifeCard}><Text style={[styles.lifeIcon, { color: accent }]}>{icon}</Text><View style={{ flex: 1 }}><Text style={styles.lifeLabel}>{label}</Text><Text numberOfLines={1} style={styles.lifeValue}>{value}</Text></View></View>; }
function ActionCard({ title, detail, badge, disabled, reason, onPress }: { title: string; detail: string; badge: string; disabled?: boolean; reason?: string; onPress: () => void }) { return <TouchableOpacity activeOpacity={0.72} disabled={disabled} onPress={onPress} style={[styles.actionCard, disabled && styles.actionDisabled]}><View style={styles.rowBetween}><Text style={[styles.actionTitle, disabled && styles.disabledText]}>{title}</Text><Text style={[styles.badge, disabled && styles.badgeDisabled]}>{badge}</Text></View><Text style={[styles.actionDetail, disabled && styles.disabledText]}>{detail}</Text>{reason ? <Text style={styles.reason}>{reason}</Text> : null}</TouchableOpacity>; }
function BoostCard({ icon, title, detail, badge, disabled, onPress }: { icon: string; title: string; detail: string; badge: string; disabled?: boolean; onPress: () => void }) { return <TouchableOpacity activeOpacity={0.72} disabled={disabled} onPress={onPress} style={[styles.boostCard, disabled && styles.actionDisabled]}><View style={styles.boostIcon}><Text style={styles.boostIconText}>{icon}</Text></View><View style={{ flex: 1 }}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDetail}>{detail}</Text></View><Text style={styles.boostBadge}>{badge}</Text></TouchableOpacity>; }
function FinanceHero({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) { return <View style={[styles.financeHero, { borderColor: `${accent}44` }]}><Text style={[styles.financeLabel, { color: accent }]}>{label}</Text><Text style={styles.financeValue}>{value}</Text><Text style={styles.financeSub}>{sub}</Text></View>; }
function QuickButtons({ amounts, prefix, disabled, onPress }: { amounts: number[]; prefix: string; disabled: (amount: number) => boolean; onPress: (amount: number) => void }) { return <View style={styles.quickRow}>{amounts.map(amount => <TouchableOpacity key={`${prefix}-${amount}`} disabled={disabled(amount)} onPress={() => onPress(amount)} style={[styles.quickButton, disabled(amount) && styles.actionDisabled]}><Text style={[styles.quickText, disabled(amount) && styles.disabledText]}>{prefix} {money(amount)}</Text></TouchableOpacity>)}</View>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <View style={styles.miniStat}><Text style={styles.miniStatLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.miniStatValue}>{value}</Text></View>; }
function NavItem({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) { return <TouchableOpacity onPress={onPress} style={[styles.navItem, active && styles.navItemActive]}><Text style={[styles.navIcon, active && styles.navOn]}>{icon}</Text><Text style={[styles.navLabel, active && styles.navOn]}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, shell: { flex: 1, backgroundColor: C.bg },
  topArea: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: '#090c0e', borderBottomWidth: 1, borderBottomColor: '#1c2428', gap: 11 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: C.text, fontSize: 22, fontWeight: '900', letterSpacing: 1.4 }, brandAccent: { color: C.lime }, brandSub: { color: C.dim, fontSize: 8, fontWeight: '800', letterSpacing: 1.8, marginTop: 2 },
  timeBadge: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'flex-end' }, timeMain: { color: C.text, fontSize: 10, fontWeight: '900' }, timeSub: { color: C.muted, fontSize: 8, marginTop: 1 },
  vitals: { flexDirection: 'row', gap: 9 }, vital: { flex: 1 }, vitalLabel: { color: C.dim, fontSize: 8, fontWeight: '900' }, vitalValue: { color: '#c8d0d4', fontSize: 9, fontWeight: '900' }, vitalTrack: { height: 5, backgroundColor: '#20282c', borderRadius: 99, overflow: 'hidden', marginTop: 4 }, vitalFill: { height: '100%', borderRadius: 99 },
  content: { padding: 16, paddingBottom: 110, gap: 20 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rankCard: { backgroundColor: '#101519', borderWidth: 1, borderRadius: 24, padding: 20 }, rankLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, rankAge: { color: C.dim, fontSize: 9, fontWeight: '800' }, rankSub: { color: C.muted, fontSize: 12, marginTop: 6 }, heroMoney: { color: C.text, fontSize: 45, fontWeight: '900', letterSpacing: -1.8, marginTop: 18 }, heroCaption: { color: C.dim, fontSize: 8, fontWeight: '900', letterSpacing: 1.6, marginTop: 2 }, milestoneTrack: { height: 7, backgroundColor: '#222a2e', borderRadius: 99, overflow: 'hidden', marginTop: 18 }, milestoneFill: { height: '100%', borderRadius: 99 }, trackText: { color: C.dim, fontSize: 9, marginTop: 7 }, trackValue: { color: '#bec7cb', fontSize: 10, fontWeight: '800', marginTop: 7 },
  noticeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#121816', borderWidth: 1, borderColor: '#2b3824', borderRadius: 14, padding: 13 }, noticeIcon: { fontSize: 16 }, noticeText: { color: '#cbd2d5', fontSize: 11.5, flex: 1, lineHeight: 17 },
  kpiRow: { flexDirection: 'row', gap: 8 }, kpi: { flex: 1, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 11, minWidth: 0 }, kpiLabel: { color: C.dim, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 }, kpiValue: { fontSize: 13, fontWeight: '900', marginTop: 5 },
  section: { gap: 10 }, sectionTitle: { color: '#a2adb3', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 }, sectionSub: { color: C.dim, fontSize: 9.5, marginTop: 3 },
  lifeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, lifeCard: { width: '48.6%', flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 72, padding: 12, borderRadius: 15, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border }, lifeIcon: { fontSize: 18, width: 22, textAlign: 'center', fontWeight: '900' }, lifeLabel: { color: C.dim, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 }, lifeValue: { color: '#e1e6e8', fontSize: 12, fontWeight: '800', marginTop: 4 },
  challengeCard: { backgroundColor: '#d7ff45', borderRadius: 20, padding: 18 }, challengeKicker: { color: '#27320d', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 }, challengeTitle: { color: '#11150b', fontSize: 21, fontWeight: '900', marginTop: 6 }, challengeBody: { color: '#3d481c', fontSize: 11, lineHeight: 17, marginTop: 6 },
  pageKicker: { color: C.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, pageTitle: { color: C.text, fontSize: 32, fontWeight: '900', letterSpacing: 0.5, marginTop: 3 }, pageSub: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  boostActive: { backgroundColor: '#253111', borderWidth: 1, borderColor: '#50661f', borderRadius: 13, padding: 12 }, boostActiveText: { color: C.lime, textAlign: 'center', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  actionCard: { backgroundColor: C.panel, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: C.border }, actionDisabled: { opacity: 0.48 }, actionTitle: { color: C.text, fontSize: 15, fontWeight: '900', flex: 1 }, actionDetail: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 6 }, badge: { color: C.lime, backgroundColor: '#273211', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, fontSize: 8.5, fontWeight: '900', overflow: 'hidden' }, badgeDisabled: { color: '#7c888e', backgroundColor: '#252c30' }, reason: { color: '#e5a080', fontSize: 9.5, fontWeight: '800', marginTop: 6 }, disabledText: { color: '#68747a' },
  moneyBoard: { flexDirection: 'row', backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 13, gap: 8 }, miniStat: { flex: 1, minWidth: 0 }, miniStatLabel: { color: C.dim, fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 }, miniStatValue: { color: C.text, fontSize: 13, fontWeight: '900', marginTop: 5 },
  financeHero: { backgroundColor: C.panel, borderWidth: 1, borderRadius: 17, padding: 16 }, financeLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, financeValue: { color: C.text, fontSize: 28, fontWeight: '900', marginTop: 5 }, financeSub: { color: C.muted, fontSize: 10.5, lineHeight: 15, marginTop: 5 }, quickRow: { flexDirection: 'row', gap: 7 }, quickButton: { flex: 1, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 6 }, quickText: { color: '#dbe1e4', textAlign: 'center', fontSize: 9.5, fontWeight: '800' },
  passiveHero: { backgroundColor: '#172113', borderWidth: 1, borderColor: '#394924', borderRadius: 21, padding: 18 }, passiveKicker: { color: '#9fb762', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, passiveValue: { color: C.lime, fontSize: 34, fontWeight: '900', marginTop: 5 }, passivePer: { fontSize: 15, color: '#9fb762' }, passiveSub: { color: '#879866', fontSize: 10.5, marginTop: 6 },
  sponsorNote: { backgroundColor: '#101619', borderWidth: 1, borderColor: C.border, borderRadius: 13, padding: 12 }, sponsorNoteTitle: { color: C.blue, fontSize: 8.5, fontWeight: '900', letterSpacing: 1 }, sponsorNoteText: { color: C.muted, fontSize: 10.5, lineHeight: 15, marginTop: 4 }, boostCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.panel, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border }, boostIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#263111' }, boostIconText: { color: C.lime, fontSize: 15, fontWeight: '900' }, boostBadge: { color: '#11150b', backgroundColor: C.lime, borderRadius: 99, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, fontSize: 8, fontWeight: '900' },
  achievement: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0e1215', borderRadius: 13, padding: 12, borderWidth: 1, borderColor: '#20282c' }, achievementUnlocked: { backgroundColor: '#141b10', borderColor: '#3b4d20' }, achievementMark: { color: C.dim, fontSize: 18, width: 24, textAlign: 'center' }, achievementMarkOn: { color: C.lime }, achievementTitle: { color: C.text, fontSize: 11.5, fontWeight: '900' }, achievementBody: { color: C.dim, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  nav: { flexDirection: 'row', paddingHorizontal: 6, paddingTop: 7, paddingBottom: 8, backgroundColor: '#0a0e10', borderTopWidth: 1, borderTopColor: '#20272b' }, navItem: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, navItemActive: { backgroundColor: '#161f12' }, navIcon: { color: '#59656b', fontSize: 16, fontWeight: '900' }, navLabel: { color: '#59656b', fontSize: 7.5, fontWeight: '900', marginTop: 3, letterSpacing: 0.5 }, navOn: { color: C.lime },
  footer: { color: '#3f484d', fontSize: 8, fontWeight: '800', letterSpacing: 1.3, textAlign: 'center', marginTop: 8 },
  deathScreen: { flex: 1, justifyContent: 'center', padding: 26 }, deathKicker: { color: C.red, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 }, deathTitle: { color: C.text, fontSize: 34, fontWeight: '900', lineHeight: 38, marginTop: 7 }, deathReason: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 10 }, deathStats: { flexDirection: 'row', gap: 8, backgroundColor: C.panel, borderRadius: 15, borderWidth: 1, borderColor: C.border, padding: 13, marginTop: 20 }, deathFlavor: { color: C.dim, fontSize: 11, marginTop: 14 }, primaryButton: { backgroundColor: C.lime, borderRadius: 15, paddingVertical: 15, alignItems: 'center', marginTop: 22 }, primaryButtonText: { color: '#11150b', fontSize: 12, fontWeight: '900', letterSpacing: 1 }
});