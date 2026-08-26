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
import { preloadRewardedAd, rewardedAdUsesTestInventory, showRewardedAd } from './ads';

type Page = 'home' | 'work' | 'life' | 'money' | 'empire';
type RewardKind = 'restore' | 'double' | 'cash';

const money = (value: number) => value.toLocaleString('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: Math.abs(value) < 1000 ? 2 : 0, maximumFractionDigits: Math.abs(value) < 1000 ? 2 : 0
});
const duration = (minutes: number) => minutes >= 1440 ? `${Math.round(minutes / 1440)} days` : minutes >= 60 ? `${minutes / 60} hr` : `${minutes} min`;
const clamp = (value: number) => Math.max(0, Math.min(100, value));

export default function BottomDollarApp() {
  const [state, setState] = useState<LifeState>(createNewLife());
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('Start small. Every choice costs time.');
  const [page, setPage] = useState<Page>('home');
  const [adBusy, setAdBusy] = useState(false);

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
  const dailyExpenses = getDailyExpenses(state);
  const dailyNet = passive - dailyExpenses;
  const currentJob = useMemo(() => jobs.find(j => j.id === state.currentJobId), [state.currentJobId]);
  const businessCount = Object.values(state.businesses).filter(level => level > 0).length;
  const nextMilestone = netWorth < 1000 ? 1000 : netWorth < 10000 ? 10000 : netWorth < 100000 ? 100000 : 1000000;
  const progress = Math.max(0, Math.min(100, (netWorth / nextMilestone) * 100));
  const quickAmounts = [50, 250, 1000];
  const doubleReady = (state.stats.doubleNextPay ?? 0) > 0;
  const rewardAdDay = state.stats.rewardAdDay ?? day;
  const rewardAdsUsed = rewardAdDay === day ? (state.stats.rewardAdsUsed ?? 0) : 0;
  const rewardAdsLeft = Math.max(0, 3 - rewardAdsUsed);
  const boostCredits = state.stats.boostCredits ?? 0;

  const commit = (next: LifeState, message: string, success = false) => {
    if (next === state) return;
    setState(next);
    setNotice(message);
    if (success) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const consumeDouble = (before: LifeState, next: LifeState) => {
    if ((before.stats.doubleNextPay ?? 0) <= 0 || next === before) return next;
    const activeGain = Math.max(0, next.cash - before.cash);
    if (activeGain <= 0) return { ...next, stats: { ...next.stats, doubleNextPay: 0 } };
    return {
      ...next,
      cash: Math.round((next.cash + activeGain) * 100) / 100,
      stats: { ...next.stats, doubleNextPay: 0, earned: (next.stats.earned ?? 0) + activeGain }
    };
  };

  const doAction = (actionId: string, label: string) => {
    const next = consumeDouble(state, performAction(state, actionId));
    const gain = Math.max(0, next.cash - state.cash);
    commit(next, `${label}: +${money(gain)}${doubleReady ? ' (2× boost used)' : ''}`, true);
  };

  const doShift = (jobId: string, title: string, hours: number) => {
    const next = consumeDouble(state, workShift(state, jobId));
    commit(next, `${hours}-hour ${title} shift complete${doubleReady ? ' · 2× boost used' : ''}.`, true);
  };

  const applyReward = (kind: RewardKind) => {
    const baseStats = {
      ...state.stats,
      rewardAdDay: day,
      rewardAdsUsed: rewardAdsUsed + 1
    };
    let next: LifeState = { ...state, stats: baseStats };
    let message = '';

    if (kind === 'restore') {
      next = { ...next, energy: clamp(state.energy + 45), health: clamp(state.health + 12), happiness: clamp(state.happiness + 10) };
      message = 'Reward earned: condition restored.';
    } else if (kind === 'double') {
      next = { ...next, stats: { ...baseStats, doubleNextPay: 1 } };
      message = 'Reward earned: your next active payout is doubled.';
    } else {
      const bonus = Math.max(25, Math.min(5000, Math.round(Math.max(50, Math.abs(netWorth) * 0.02))));
      next = { ...next, cash: state.cash + bonus, stats: { ...baseStats, earned: (state.stats.earned ?? 0) + bonus } };
      message = `Reward earned: sponsor bonus +${money(bonus)}.`;
    }
    commit(next, message, true);
  };

  const grantReward = async (kind: RewardKind) => {
    if (rewardAdsLeft <= 0 || adBusy) {
      if (rewardAdsLeft <= 0) setNotice('Rewarded boost limit reached for this in-game day.');
      return;
    }

    setAdBusy(true);
    setNotice('Loading rewarded ad...');
    const earned = await showRewardedAd();
    setAdBusy(false);

    if (!earned) {
      setNotice('Ad not ready or reward not completed. Try again in a moment.');
      preloadRewardedAd().catch(() => undefined);
      return;
    }

    applyReward(kind);
  };

  const spendBoostCredit = (kind: 'restore' | 'double') => {
    if (boostCredits <= 0) return;
    if (kind === 'restore') {
      commit({ ...state, energy: 100, health: clamp(state.health + 20), happiness: clamp(state.happiness + 15), stats: { ...state.stats, boostCredits: boostCredits - 1 } }, 'Boost Credit used: full energy and recovery.', true);
    } else {
      commit({ ...state, stats: { ...state.stats, boostCredits: boostCredits - 1, doubleNextPay: 1 } }, 'Boost Credit used: next active payout is doubled.', true);
    }
  };

  if (state.dead) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar hidden />
        <View style={styles.deathScreen}>
          <Text style={styles.deathKicker}>LIFE OVER</Text>
          <Text style={styles.deathTitle}>That run is over.</Text>
          <Text style={styles.deathReason}>{state.deathReason}</Text>
          <View style={styles.statRow}>
            <Stat label="Age" value={age.toFixed(1)} />
            <Stat label="Net worth" value={money(netWorth)} />
            <Stat label="Best" value={money(state.bestNetWorth)} />
          </View>
          <Text style={styles.muted}>Lives completed: {state.livesCompleted}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => { setState(restartLife(state)); setPage('home'); setNotice('New life started.'); }}>
            <Text style={styles.primaryButtonText}>START A NEW LIFE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderHome = () => (
    <>
      <View style={styles.hero}>
        <View style={styles.rowBetween}><Text style={styles.eyebrow}>NET WORTH</Text><Pill text={netWorth >= 0 ? 'BUILDING' : 'IN DEBT'} danger={netWorth < 0} /></View>
        <Text style={styles.netWorth}>{money(netWorth)}</Text>
        <View style={styles.statRow}>
          <Stat label="Cash" value={money(state.cash)} />
          <Stat label="Savings" value={money(state.savings)} />
          <Stat label="Invested" value={money(state.investments)} />
        </View>
        <View style={[styles.statRow, { marginTop: 14 }]}>
          <Stat label="Debt" value={money(state.debt)} />
          <Stat label="Passive/day" value={money(passive)} />
          <Stat label="Daily net" value={money(dailyNet)} />
        </View>
      </View>

      <View style={styles.notice}><View style={styles.noticeDot} /><Text style={styles.noticeText}>{notice}</Text></View>

      <Section title="CURRENT LIFE" subtitle="Everything important at a glance">
        <View style={styles.lifeGrid}>
          <LifeCard icon="⌂" label="Housing" value={state.housing} />
          <LifeCard icon="●" label="Job" value={currentJob?.title ?? 'Unemployed'} />
          <LifeCard icon="◆" label="Education" value={state.education} />
          <LifeCard icon="▣" label="Businesses" value={`${businessCount} active`} />
        </View>
      </Section>

      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>SURVIVAL RULES</Text>
        <Text style={styles.rulesText}>Health at 0 ends the life. Energy at 0 causes a 12-hour collapse. Happiness at 0 causes burnout and costs a full day.</Text>
        <Text style={styles.rulesText}>Nearly every useful action advances in-game time, so housing costs, passive income, exhaustion, and bad events matter.</Text>
      </View>

      <View style={styles.milestone}>
        <View style={styles.rowBetween}><Text style={styles.milestoneLabel}>NEXT MILESTONE</Text><Text style={styles.milestonePct}>{Math.round(progress)}%</Text></View>
        <Text style={styles.milestoneText}>Reach {money(nextMilestone)} net worth.</Text>
        <View style={styles.trackDark}><View style={[styles.fillDark, { width: `${progress}%` }]} /></View>
      </View>
    </>
  );

  const renderWork = () => (
    <>
      <PageIntro title="WORK" subtitle="Earn actively, recover, and climb the career ladder." />
      {doubleReady ? <View style={styles.activeBoost}><Text style={styles.activeBoostText}>2× NEXT ACTIVE PAYOUT READY</Text></View> : null}
      <Section title="RECOVER" subtitle="Manage your condition before it manages you">
        {recovery.map(option => {
          const unlocked = !option.requires || option.requires(state);
          const affordable = state.cash >= option.cost;
          const gains = [`+${option.energyGain} energy`];
          if (option.healthGain) gains.push(`+${option.healthGain} health`);
          if (option.happinessGain) gains.push(`${option.happinessGain > 0 ? '+' : ''}${option.happinessGain} happiness`);
          return <GameButton key={option.id} badge={option.cost > 0 ? money(option.cost) : 'FREE'} title={option.label} detail={unlocked ? `${duration(option.minutes)} · ${gains.join(' · ')}` : option.requirementText ?? 'Locked'} disabled={!unlocked || !affordable} disabledReason={unlocked && !affordable ? `${money(option.cost - state.cash)} short` : undefined} onPress={() => commit(recover(state, option.id), `${option.label}: recovered.`, true)} />;
        })}
      </Section>
      <Section title="QUICK MONEY" subtitle="Low barrier work for immediate cash">
        {actions.map(action => {
          const unlocked = !action.requires || action.requires(state);
          const enoughEnergy = state.energy >= action.energyCost;
          return <GameButton key={action.id} badge={duration(action.minutes).toUpperCase()} title={action.label} detail={unlocked ? `${money(action.minCash)}–${money(action.maxCash)} · -${action.energyCost} energy` : action.requirementText ?? 'Locked'} disabled={!unlocked || !enoughEnergy} disabledReason={unlocked && !enoughEnergy ? `Need ${action.energyCost} energy` : undefined} onPress={() => doAction(action.id, action.label)} />;
        })}
      </Section>
      <Section title="JOBS" subtitle="Better requirements, better pay">
        {jobs.map(job => {
          const unlocked = !job.requires || job.requires(state);
          const enoughEnergy = state.energy >= job.energyCost;
          return <GameButton key={job.id} badge={state.currentJobId === job.id ? 'CURRENT' : `${money(job.hourlyPay)}/HR`} title={job.title} detail={unlocked ? `${job.shiftHours} hr · ${money(job.hourlyPay * job.shiftHours)} gross · -${job.energyCost} energy` : job.requirementText ?? 'Locked'} disabled={!unlocked || !enoughEnergy} disabledReason={unlocked && !enoughEnergy ? `Need ${job.energyCost} energy` : undefined} onPress={() => doShift(job.id, job.title, job.shiftHours)} />;
        })}
      </Section>
    </>
  );

  const renderLife = () => (
    <>
      <PageIntro title="LIFE" subtitle="Upgrade stability, mobility, and education." />
      <Section title="ESSENTIALS" subtitle="Small upgrades unlock bigger opportunities">
        {purchases.map(item => {
          const owned = state.inventory.includes(item.id);
          return <GameButton key={item.id} badge={owned ? 'OWNED' : money(item.cost)} title={item.label} detail={item.description} disabled={owned || state.cash < item.cost} disabledReason={!owned && state.cash < item.cost ? `${money(item.cost - state.cash)} short` : undefined} onPress={() => commit(buyItem(state, item.id, item.cost), `${item.label} purchased.`, true)} />;
        })}
      </Section>
      <Section title="HOUSING" subtitle="Stability comes with ongoing cost">
        {housing.map(option => {
          const current = state.housing === option.id;
          const unlocked = !option.requires || option.requires(state);
          return <GameButton key={option.id} badge={current ? 'CURRENT' : money(option.cost)} title={option.label} detail={current ? `${money(option.dailyCost)}/day ongoing cost` : unlocked ? `${option.description} · ${money(option.dailyCost)}/day` : option.requirementText ?? 'Locked'} disabled={current || !unlocked || state.cash < option.cost} disabledReason={!current && unlocked && state.cash < option.cost ? `${money(option.cost - state.cash)} short` : undefined} onPress={() => commit(buyHousing(state, option.id as HousingType), `Moved into ${option.label}.`, true)} />;
        })}
      </Section>
      <Section title="EDUCATION" subtitle="Spend time now to unlock better careers">
        {education.map(option => {
          const complete = state.education === option.id || (state.education === 'Trade Certificate' && option.id === 'GED');
          const unlocked = !option.requires || option.requires(state);
          return <GameButton key={option.id} badge={complete ? 'COMPLETE' : money(option.cost)} title={option.label} detail={complete ? 'Completed.' : unlocked ? `${option.days} days · ${option.description}` : option.requirementText ?? 'Locked'} disabled={complete || !unlocked || state.cash < option.cost} disabledReason={!complete && unlocked && state.cash < option.cost ? `${money(option.cost - state.cash)} short` : undefined} onPress={() => commit(enrollEducation(state, option.id as EducationType), `${option.label} completed.`, true)} />;
        })}
      </Section>
    </>
  );

  const renderMoney = () => (
    <>
      <PageIntro title="MONEY" subtitle="Protect cash, grow assets, and control debt." />
      <View style={styles.financeSummary}><Stat label="Cash" value={money(state.cash)} /><Stat label="Savings" value={money(state.savings)} /><Stat label="Invested" value={money(state.investments)} /><Stat label="Debt" value={money(state.debt)} /></View>
      <Section title="SAVINGS" subtitle="Low growth, immediate access">
        <FinanceCard label="SAVINGS BALANCE" value={money(state.savings)} sub="Savings earn a small amount of interest as game time advances." />
        <View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`save-${amount}`} label={`Save ${money(amount)}`} disabled={state.cash < amount} onPress={() => commit(transferToSavings(state, amount), `${money(amount)} moved to savings.`)} />)}</View>
        <View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`withdraw-${amount}`} label={`Withdraw ${money(amount)}`} disabled={state.savings < amount} onPress={() => commit(withdrawSavings(state, amount), `${money(amount)} withdrawn.`)} />)}</View>
      </Section>
      <Section title="INVESTMENTS" subtitle="Higher long-term growth">
        <FinanceCard label="INVESTED" value={money(state.investments)} sub="Investments grow over time and count toward net worth." />
        <View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`invest-${amount}`} label={`Invest ${money(amount)}`} disabled={state.cash < amount} onPress={() => commit(investCash(state, amount), `${money(amount)} invested.`)} />)}</View>
        <View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`sell-${amount}`} label={`Sell ${money(amount)}`} disabled={state.investments < amount} onPress={() => commit(sellInvestments(state, amount), `${money(amount)} sold.`)} />)}</View>
      </Section>
      {state.debt > 0 ? <Section title="DEBT" subtitle="Every payment improves net worth"><FinanceCard label="DEBT" value={money(state.debt)} sub="Pay this down before it becomes a permanent drag." /><View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`debt-${amount}`} label={`Pay ${money(amount)}`} disabled={state.cash <= 0} onPress={() => commit(payDebt(state, amount), 'Debt payment made.')} />)}</View></Section> : null}
    </>
  );

  const renderEmpire = () => (
    <>
      <PageIntro title="EMPIRE" subtitle="Build passive income, then accelerate carefully." />
      <View style={styles.passiveHero}><Text style={styles.passiveLabel}>PASSIVE INCOME</Text><Text style={styles.passiveValue}>{money(passive)}/day</Text><Text style={styles.passiveSub}>Living costs {money(dailyExpenses)}/day · Net passive {money(dailyNet)}/day</Text></View>

      <Section title="BOOST CENTER" subtitle="Optional acceleration; never required to play">
        <View style={styles.boostSummary}>
          <View><Text style={styles.boostKicker}>REWARDED ADS</Text><Text style={styles.boostBig}>{rewardAdsLeft}/3 left today</Text></View>
          <View style={styles.boostRight}><Text style={styles.boostKicker}>BOOST CREDITS</Text><Text style={styles.boostBig}>{boostCredits}</Text></View>
        </View>
        <BoostButton title="Recovery Boost" detail="Restore +45 energy, +12 health, +10 happiness." badge={adBusy ? 'LOADING' : rewardedAdUsesTestInventory ? 'TEST AD' : 'WATCH AD'} disabled={adBusy || rewardAdsLeft <= 0} onPress={() => grantReward('restore')} />
        <BoostButton title="2× Next Payout" detail="Double the next quick-money action or job payout." badge={doubleReady ? 'ACTIVE' : adBusy ? 'LOADING' : rewardedAdUsesTestInventory ? 'TEST AD' : 'WATCH AD'} disabled={doubleReady || adBusy || rewardAdsLeft <= 0} onPress={() => grantReward('double')} />
        <BoostButton title="Sponsor Bonus" detail="Receive a small cash injection scaled to your progress." badge={adBusy ? 'LOADING' : rewardedAdUsesTestInventory ? 'TEST AD' : 'WATCH AD'} disabled={adBusy || rewardAdsLeft <= 0} onPress={() => grantReward('cash')} />
        <View style={styles.divider} />
        <BoostButton title="Use Boost Credit: Full Recovery" detail="Premium consumable. Restores energy and improves health/happiness." badge="1 CREDIT" disabled={boostCredits < 1} onPress={() => spendBoostCredit('restore')} />
        <BoostButton title="Use Boost Credit: 2× Payout" detail="Premium consumable. Doubles your next active payout." badge="1 CREDIT" disabled={boostCredits < 1 || doubleReady} onPress={() => spendBoostCredit('double')} />
        {__DEV__ ? <MiniButton label="DEV: add 5 Boost Credits" onPress={() => commit({ ...state, stats: { ...state.stats, boostCredits: boostCredits + 5 } }, 'Added 5 development Boost Credits.', true)} /> : null}
        <View style={styles.storeNote}><Text style={styles.storeNoteTitle}>MONETIZATION</Text><Text style={styles.storeNoteText}>Rewarded video is wired through AdMob. Development builds use Google test inventory; release builds use the live Bottom Dollar rewarded unit. Paid Boost Credits will be connected through Google Play Billing before launch.</Text></View>
      </Section>

      <Section title="BUSINESSES" subtitle="Launch, automate, and scale">
        {businesses.map(business => {
          const level = state.businesses[business.id] ?? 0;
          const unlocked = !business.requires || business.requires(state);
          const cost = getBusinessUpgradeCost(state, business.id);
          const maxed = level >= business.maxLevel;
          const income = level <= 0 ? business.dailyIncome : business.dailyIncome * level * (1 + Math.max(0, level - 1) * 0.12);
          return <GameButton key={business.id} badge={maxed ? 'MAX' : level > 0 ? `LV ${level}` : 'NEW'} title={business.label} detail={!unlocked ? business.requirementText ?? 'Locked' : level > 0 ? `${money(income)}/day · Next ${money(cost)}` : `${business.description} · ${money(business.dailyIncome)}/day · ${money(cost)} launch`} disabled={!unlocked || maxed || state.cash < cost} disabledReason={unlocked && !maxed && state.cash < cost ? `${money(cost - state.cash)} short` : undefined} onPress={() => commit(upgradeBusiness(state, business.id), level === 0 ? `${business.label} launched.` : `${business.label} upgraded.`, true)} />;
        })}
      </Section>

      <Section title="ACHIEVEMENTS" subtitle={`${state.achievements.length} of ${achievements.length} unlocked`}>
        <View style={styles.achievementGrid}>{achievements.map(item => { const unlocked = state.achievements.includes(item.id); return <View key={item.id} style={[styles.achievement, unlocked && styles.achievementUnlocked]}><Text style={[styles.achievementName, !unlocked && styles.textDisabled]}>{unlocked ? '✓ ' : '○ '}{item.label}</Text><Text style={styles.achievementDesc}>{unlocked ? item.description : 'Keep playing to discover this milestone.'}</Text></View>; })}</View>
      </Section>
    </>
  );

  const pageContent = page === 'home' ? renderHome() : page === 'work' ? renderWork() : page === 'life' ? renderLife() : page === 'money' ? renderMoney() : renderEmpire();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar hidden />
      <View style={styles.shell}>
        <View style={styles.topShell}>
          <View style={styles.header}>
            <View style={styles.headerCopy}><Text style={styles.brand}>BOTTOM DOLLAR</Text><Text style={styles.subBrand}>MT64 Labs</Text></View>
            <View style={styles.dateBadge}><Text style={styles.dateMain}>AGE {age.toFixed(1)}</Text><Text style={styles.dateSub}>DAY {day} · {clock}</Text></View>
          </View>
          <VitalsHud cash={state.cash} energy={state.energy} health={state.health} happiness={state.happiness} doubleReady={doubleReady} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {pageContent}
          <Text style={styles.build}>BOTTOM DOLLAR · PRE-RELEASE BUILD 0.7</Text>
        </ScrollView>

        <View style={styles.nav}>
          <NavItem label="HOME" icon="⌂" active={page === 'home'} onPress={() => setPage('home')} />
          <NavItem label="WORK" icon="$" active={page === 'work'} onPress={() => setPage('work')} />
          <NavItem label="LIFE" icon="◆" active={page === 'life'} onPress={() => setPage('life')} />
          <NavItem label="MONEY" icon="▤" active={page === 'money'} onPress={() => setPage('money')} />
          <NavItem label="EMPIRE" icon="▲" active={page === 'empire'} onPress={() => setPage('empire')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function VitalsHud({ cash, energy, health, happiness, doubleReady }: { cash: number; energy: number; health: number; happiness: number; doubleReady: boolean }) {
  return <View style={styles.vitalsHud}><View style={styles.cashHud}><Text style={styles.hudLabel}>CASH</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.cashHudValue}>{money(cash)}</Text></View><HudVital label="EN" value={energy} tone="energy" /><HudVital label="HP" value={health} tone="health" /><HudVital label="HAP" value={happiness} tone="happy" />{doubleReady ? <View style={styles.hudBoost}><Text style={styles.hudBoostText}>2×</Text></View> : null}</View>;
}
function HudVital({ label, value, tone }: { label: string; value: number; tone: 'energy' | 'health' | 'happy' }) { const danger = value <= 25; return <View style={styles.hudVital}><View style={styles.rowBetween}><Text style={styles.hudLabel}>{label}</Text><Text style={[styles.hudValue, danger && styles.hudDanger]}>{Math.round(value)}</Text></View><View style={styles.hudTrack}><View style={[styles.hudFill, styles[`fill_${tone}`], { width: `${clamp(value)}%` }]} /></View></View>; }
function PageIntro({ title, subtitle }: { title: string; subtitle: string }) { return <View style={styles.pageIntro}><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSubtitle}>{subtitle}</Text></View>; }
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) { return <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>{children}</View>; }
function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{value}</Text></View>; }
function Pill({ text, danger }: { text: string; danger?: boolean }) { return <Text style={[styles.pill, danger && styles.pillDanger]}>{text}</Text>; }
function LifeCard({ icon, label, value }: { icon: string; label: string; value: string }) { return <View style={styles.lifeCard}><Text style={styles.lifeIcon}>{icon}</Text><View style={{ flex: 1 }}><Text style={styles.lifeLabel}>{label}</Text><Text numberOfLines={1} style={styles.lifeValue}>{value}</Text></View></View>; }
function NavItem({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) { return <TouchableOpacity onPress={onPress} style={styles.navItem}><Text style={[styles.navIcon, active && styles.navActive]}>{icon}</Text><Text style={[styles.navLabel, active && styles.navActive]}>{label}</Text>{active ? <View style={styles.navDot} /> : null}</TouchableOpacity>; }
function GameButton({ title, detail, badge, disabled, disabledReason, onPress }: { title: string; detail: string; badge?: string; disabled?: boolean; disabledReason?: string; onPress: () => void }) { return <TouchableOpacity activeOpacity={0.74} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.buttonDisabled]}><View style={styles.rowBetween}><Text style={[styles.buttonTitle, disabled && styles.textDisabled]}>{title}</Text>{badge ? <Text style={[styles.buttonBadge, disabled && styles.badgeDisabled]}>{badge}</Text> : null}</View><Text style={[styles.buttonDetail, disabled && styles.textDisabled]}>{detail}</Text>{disabledReason ? <Text style={styles.disabledReason}>{disabledReason}</Text> : null}</TouchableOpacity>; }
function BoostButton(props: { title: string; detail: string; badge: string; disabled?: boolean; onPress: () => void }) { return <GameButton {...props} />; }
function FinanceCard({ label, value, sub }: { label: string; value: string; sub: string }) { return <View style={styles.financeCard}><Text style={styles.financeLabel}>{label}</Text><Text style={styles.financeValue}>{value}</Text><Text style={styles.financeSub}>{sub}</Text></View>; }
function MiniButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) { return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.miniButton, disabled && styles.buttonDisabled]}><Text style={[styles.miniText, disabled && styles.textDisabled]}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080a0c' }, shell: { flex: 1, backgroundColor: '#080a0c' },
  topShell: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 9, backgroundColor: '#090b0d', borderBottomWidth: 1, borderBottomColor: '#1b2226' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 120, gap: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, headerCopy: { flex: 1, minWidth: 0 }, brand: { color: '#f7f8f9', fontSize: 23, fontWeight: '900', letterSpacing: 1.4 }, subBrand: { color: '#737d84', marginTop: 1, fontSize: 10 },
  dateBadge: { backgroundColor: '#111518', borderWidth: 1, borderColor: '#283036', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, alignItems: 'flex-end' }, dateMain: { color: '#e5eaec', fontSize: 10, fontWeight: '900' }, dateSub: { color: '#778187', fontSize: 8, fontWeight: '800', marginTop: 2 },
  vitalsHud: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#101416', borderWidth: 1, borderColor: '#232b30', borderRadius: 14, padding: 10 }, cashHud: { width: 86, justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#293136', paddingRight: 8 }, cashHudValue: { color: '#f5f7f8', fontSize: 14, fontWeight: '900', marginTop: 3 }, hudVital: { flex: 1, minWidth: 0 }, hudLabel: { color: '#748087', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }, hudValue: { color: '#b6bfc4', fontSize: 9, fontWeight: '900' }, hudDanger: { color: '#ff9b79' }, hudTrack: { height: 4, backgroundColor: '#242b2f', borderRadius: 99, overflow: 'hidden', marginTop: 4 }, hudFill: { height: '100%', borderRadius: 99 }, fill_energy: { backgroundColor: '#d7ff45' }, fill_health: { backgroundColor: '#74e4a3' }, fill_happy: { backgroundColor: '#82b8ff' }, hudBoost: { backgroundColor: '#d7ff45', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 7 }, hudBoostText: { color: '#15190f', fontSize: 9, fontWeight: '900' },
  hero: { backgroundColor: '#12171a', borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#252d32' }, eyebrow: { color: '#869198', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, pill: { color: '#d7ff45', backgroundColor: '#263112', overflow: 'hidden', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900' }, pillDanger: { color: '#ff9999', backgroundColor: '#35181a' }, netWorth: { color: '#f7f9fa', fontSize: 44, fontWeight: '900', marginTop: 9, marginBottom: 20, letterSpacing: -1 },
  statRow: { flexDirection: 'row', gap: 10 }, stat: { flex: 1, minWidth: 0 }, statLabel: { color: '#727e85', fontSize: 10, fontWeight: '700' }, statValue: { color: '#dde3e6', fontSize: 14, fontWeight: '800', marginTop: 4 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#101416', borderRadius: 13, padding: 14, borderWidth: 1, borderColor: '#20272b' }, noticeDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#d7ff45' }, noticeText: { color: '#b1bac0', fontSize: 12, flex: 1, lineHeight: 17 },
  pageIntro: { marginTop: 2 }, pageTitle: { color: '#f6f8f9', fontSize: 28, fontWeight: '900', letterSpacing: 1.2 }, pageSubtitle: { color: '#737d84', fontSize: 12, marginTop: 4, lineHeight: 18 }, section: { gap: 10 }, sectionHeading: { marginLeft: 2, marginBottom: 2 }, sectionTitle: { color: '#8d989f', fontSize: 12, fontWeight: '900', letterSpacing: 1.6 }, sectionSubtitle: { color: '#5f6970', fontSize: 10, marginTop: 3 },
  lifeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, lifeCard: { width: '48.5%', minHeight: 72, backgroundColor: '#12171a', borderColor: '#252d32', borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, lifeIcon: { color: '#d7ff45', fontSize: 17, width: 20, textAlign: 'center' }, lifeLabel: { color: '#6e797f', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }, lifeValue: { color: '#dde2e5', fontSize: 12, fontWeight: '800', marginTop: 4 },
  rulesCard: { backgroundColor: '#111518', borderWidth: 1, borderColor: '#30373b', borderRadius: 16, padding: 16 }, rulesTitle: { color: '#d7ff45', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, rulesText: { color: '#909aa0', fontSize: 11, lineHeight: 17, marginTop: 7 },
  milestone: { backgroundColor: '#d7ff45', borderRadius: 20, padding: 19 }, milestoneLabel: { color: '#171b12', fontSize: 10, fontWeight: '900' }, milestonePct: { color: '#35400e', fontSize: 12, fontWeight: '900' }, milestoneText: { color: '#171b12', fontSize: 18, fontWeight: '900', marginTop: 7 }, trackDark: { backgroundColor: '#abc933', height: 7, borderRadius: 99, overflow: 'hidden', marginTop: 15 }, fillDark: { backgroundColor: '#151a11', height: '100%', borderRadius: 99 },
  activeBoost: { backgroundColor: '#1b2511', borderColor: '#3f5222', borderWidth: 1, borderRadius: 12, padding: 11 }, activeBoostText: { color: '#d7ff45', fontSize: 10, fontWeight: '900', textAlign: 'center', letterSpacing: 0.8 },
  button: { backgroundColor: '#14191c', borderRadius: 15, borderWidth: 1, borderColor: '#2a3338', padding: 15 }, buttonDisabled: { opacity: 0.62, backgroundColor: '#101417' }, buttonTitle: { color: '#f1f4f5', fontWeight: '800', fontSize: 15, flex: 1 }, buttonBadge: { color: '#d7ff45', backgroundColor: '#273111', overflow: 'hidden', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900' }, badgeDisabled: { color: '#8b9499', backgroundColor: '#252a2d' }, buttonDetail: { color: '#899399', fontSize: 11.5, marginTop: 6, lineHeight: 17 }, textDisabled: { color: '#7b858b' }, disabledReason: { color: '#d49b7e', fontSize: 10, fontWeight: '700', marginTop: 6 },
  financeSummary: { flexDirection: 'row', backgroundColor: '#12171a', borderRadius: 16, borderWidth: 1, borderColor: '#252d32', padding: 15, gap: 8 }, financeCard: { backgroundColor: '#12171a', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#252d32' }, financeLabel: { color: '#77838a', fontSize: 9, fontWeight: '900' }, financeValue: { color: '#f3f6f7', fontSize: 24, fontWeight: '900', marginTop: 4 }, financeSub: { color: '#737e84', fontSize: 10, lineHeight: 15, marginTop: 5 }, quickRow: { flexDirection: 'row', gap: 8 }, miniButton: { flex: 1, backgroundColor: '#151b1f', borderWidth: 1, borderColor: '#2b353a', borderRadius: 11, paddingVertical: 11, paddingHorizontal: 8 }, miniText: { color: '#dce2e5', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  passiveHero: { backgroundColor: '#172014', borderWidth: 1, borderColor: '#32411f', borderRadius: 18, padding: 18 }, passiveLabel: { color: '#a8bd64', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, passiveValue: { color: '#d7ff45', fontSize: 32, fontWeight: '900', marginTop: 5 }, passiveSub: { color: '#84925f', fontSize: 10, marginTop: 6 },
  boostSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111619', borderWidth: 1, borderColor: '#2a3236', borderRadius: 14, padding: 14 }, boostKicker: { color: '#78838a', fontSize: 9, fontWeight: '900' }, boostBig: { color: '#eef2f3', fontSize: 15, fontWeight: '900', marginTop: 4 }, boostRight: { alignItems: 'flex-end' }, divider: { height: 1, backgroundColor: '#232b30', marginVertical: 2 }, storeNote: { backgroundColor: '#0e1214', borderWidth: 1, borderColor: '#242c31', borderRadius: 13, padding: 13 }, storeNoteTitle: { color: '#d7ff45', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 }, storeNoteText: { color: '#778188', fontSize: 10, lineHeight: 15, marginTop: 5 },
  achievementGrid: { gap: 8 }, achievement: { backgroundColor: '#101416', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#21292d' }, achievementUnlocked: { borderColor: '#3c5021', backgroundColor: '#131a10' }, achievementName: { color: '#d7ff45', fontWeight: '900', fontSize: 12 }, achievementDesc: { color: '#737e84', fontSize: 10, marginTop: 4, lineHeight: 15 },
  nav: { flexDirection: 'row', backgroundColor: '#0d1113', borderTopWidth: 1, borderTopColor: '#20272b', paddingTop: 9, paddingBottom: 22, paddingHorizontal: 5 }, navItem: { flex: 1, alignItems: 'center', minHeight: 50, justifyContent: 'center' }, navIcon: { color: '#5e676d', fontSize: 16, fontWeight: '900' }, navLabel: { color: '#5e676d', fontSize: 8, fontWeight: '900', marginTop: 3, letterSpacing: 0.6 }, navActive: { color: '#d7ff45' }, navDot: { width: 4, height: 4, borderRadius: 99, backgroundColor: '#d7ff45', marginTop: 4 }, build: { color: '#485157', textAlign: 'center', fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginTop: 2 },
  deathScreen: { flex: 1, justifyContent: 'center', padding: 28 }, deathKicker: { color: '#ff9191', fontSize: 11, fontWeight: '900', letterSpacing: 1.8 }, deathTitle: { color: '#f7f9fa', fontSize: 34, fontWeight: '900', marginTop: 8 }, deathReason: { color: '#929ca2', fontSize: 14, lineHeight: 21, marginTop: 10 }, muted: { color: '#727c82', fontSize: 11, marginTop: 12 }, primaryButton: { backgroundColor: '#d7ff45', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 }, primaryButtonText: { color: '#141810', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 }
});
