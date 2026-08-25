import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { achievements, actions, businesses, education, housing, jobs, purchases, recovery } from './src/game/data';
import {
  buyHousing,
  buyItem,
  createNewLife,
  enrollEducation,
  getAge,
  getBusinessUpgradeCost,
  getDailyExpenses,
  getDayNumber,
  getNetWorth,
  getPassiveIncomePerDay,
  investCash,
  normalizeState,
  payDebt,
  performAction,
  recover,
  sellInvestments,
  transferToSavings,
  upgradeBusiness,
  withdrawSavings,
  workShift
} from './src/game/engine';
import { EducationType, HousingType, LifeState } from './src/game/types';
import { loadGame, saveGame } from './src/storage';

type Page = 'home' | 'work' | 'life' | 'money' | 'empire';

const money = (value: number) => value.toLocaleString('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: Math.abs(value) < 1000 ? 2 : 0, maximumFractionDigits: Math.abs(value) < 1000 ? 2 : 0
});
const percent = (value: number) => `${Math.round(Math.max(0, Math.min(100, value)))}%`;
const duration = (minutes: number) => minutes >= 1440 ? `${Math.round(minutes / 1440)} days` : minutes >= 60 ? `${minutes / 60} hr` : `${minutes} min`;

export default function App() {
  const [state, setState] = useState<LifeState>(createNewLife());
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('Build a stable life from absolutely nothing.');
  const [page, setPage] = useState<Page>('home');

  useEffect(() => {
    loadGame().then(saved => {
      if (saved) setState(normalizeState(saved));
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => saveGame(state), 250);
    return () => clearTimeout(timer);
  }, [state, ready]);

  const age = getAge(state);
  const day = getDayNumber(state);
  const netWorth = getNetWorth(state);
  const passive = getPassiveIncomePerDay(state);
  const dailyExpenses = getDailyExpenses(state);
  const dailyNet = passive - dailyExpenses;
  const latestEvent = state.history[state.history.length - 1];
  const currentJob = useMemo(() => jobs.find(j => j.id === state.currentJobId), [state.currentJobId]);
  const businessCount = Object.values(state.businesses).filter(level => level > 0).length;
  const nextMilestone = netWorth < 1000 ? 1000 : netWorth < 10000 ? 10000 : netWorth < 100000 ? 100000 : 1000000;
  const milestoneProgress = Math.max(0, Math.min(100, (netWorth / nextMilestone) * 100));
  const quickAmounts = [50, 250, 1000];

  const commit = (next: LifeState, message: string, haptic: 'light' | 'success' = 'light') => {
    if (next === state) return;
    setState(next);
    setNotice(message);
    if (haptic === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderHome = () => (
    <>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.eyebrow}>NET WORTH</Text>
          <Text style={[styles.statusPill, netWorth >= 0 ? styles.statusPositive : styles.statusNegative]}>{netWorth >= 0 ? 'BUILDING' : 'IN DEBT'}</Text>
        </View>
        <Text style={styles.netWorth}>{money(netWorth)}</Text>
        <View style={styles.row}>
          <Stat label="Cash" value={money(state.cash)} />
          <Stat label="Savings" value={money(state.savings)} />
          <Stat label="Invested" value={money(state.investments)} />
        </View>
        <View style={[styles.row, { marginTop: 13 }]}>
          <Stat label="Debt" value={money(state.debt)} />
          <Stat label="Passive/day" value={money(passive)} />
          <Stat label="Daily net" value={money(dailyNet)} />
        </View>
      </View>

      <View style={styles.noticeCard}><View style={styles.noticeDot} /><Text style={styles.noticeText}>{notice}</Text></View>

      {latestEvent && latestEvent.id !== 'start' ? (
        <View style={[styles.eventCard, latestEvent.tone === 'bad' && styles.eventBad, latestEvent.tone === 'good' && styles.eventGood]}>
          <View style={styles.eventTop}><Text style={styles.eventLabel}>LATEST EVENT</Text><Text style={styles.eventDay}>DAY {latestEvent.day}</Text></View>
          <Text style={styles.eventTitle}>{latestEvent.title}</Text>
          <Text style={styles.eventBody}>{latestEvent.body}</Text>
        </View>
      ) : null}

      <View style={styles.meters}>
        <Meter label="ENERGY" value={state.energy} tone="energy" />
        <Meter label="HEALTH" value={state.health} tone="health" />
        <Meter label="HAPPINESS" value={state.happiness} tone="happy" />
      </View>

      <Section title="CURRENT LIFE" subtitle="Your snapshot">
        <View style={styles.lifeGrid}>
          <LifeCard icon="⌂" label="Housing" value={state.housing} />
          <LifeCard icon="●" label="Job" value={currentJob?.title ?? 'Unemployed'} />
          <LifeCard icon="◆" label="Education" value={state.education} />
          <LifeCard icon="▣" label="Businesses" value={`${businessCount} active`} />
        </View>
      </Section>

      <View style={styles.milestone}>
        <View style={styles.milestoneTop}><Text style={styles.milestoneLabel}>NEXT WEALTH MILESTONE</Text><Text style={styles.milestonePct}>{Math.round(milestoneProgress)}%</Text></View>
        <Text style={styles.milestoneText}>Reach {money(nextMilestone)} net worth.</Text>
        <View style={styles.milestoneTrack}><View style={[styles.milestoneFill, { width: `${milestoneProgress}%` }]} /></View>
      </View>
    </>
  );

  const renderWork = () => (
    <>
      <PageIntro title="WORK" subtitle="Earn actively, recover, and climb the career ladder." />
      <Section title="RECOVER" subtitle="Keep your condition high enough to work">
        {recovery.map(option => {
          const unlocked = !option.requires || option.requires(state);
          const affordable = state.cash >= option.cost;
          const gains = [`+${option.energyGain} energy`];
          if (option.healthGain) gains.push(`+${option.healthGain} health`);
          if (option.happinessGain) gains.push(`${option.happinessGain > 0 ? '+' : ''}${option.happinessGain} happiness`);
          return <GameButton key={option.id} badge={option.cost > 0 ? money(option.cost) : 'FREE'} title={option.label} detail={unlocked ? `${duration(option.minutes)} · ${gains.join(' · ')}` : option.requirementText ?? 'Locked'} disabled={!unlocked || !affordable} disabledReason={unlocked && !affordable ? `${money(option.cost - state.cash)} short` : undefined} onPress={() => commit(recover(state, option.id), `${option.label}: you took care of yourself.`)} />;
        })}
      </Section>
      <Section title="QUICK MONEY" subtitle="Flexible work when you need cash now">
        {actions.map(action => {
          const unlocked = !action.requires || action.requires(state);
          const enoughEnergy = state.energy >= action.energyCost;
          return <GameButton key={action.id} badge={duration(action.minutes).toUpperCase()} title={action.label} detail={unlocked ? `${money(action.minCash)}–${money(action.maxCash)} · -${action.energyCost} energy` : action.requirementText ?? 'Locked'} disabled={!unlocked || !enoughEnergy} disabledReason={unlocked && !enoughEnergy ? `Need ${action.energyCost} energy` : undefined} onPress={() => { const before = state.cash; const next = performAction(state, action.id); commit(next, `${action.label}: +${money(Math.max(0, next.cash - before))} earned.`); }} />;
        })}
      </Section>
      <Section title="JOBS" subtitle="Build experience and unlock better pay">
        {jobs.map(job => {
          const unlocked = !job.requires || job.requires(state);
          const enoughEnergy = state.energy >= job.energyCost;
          const active = state.currentJobId === job.id;
          return <GameButton key={job.id} badge={active ? 'CURRENT' : `${money(job.hourlyPay)}/HR`} title={job.title} detail={unlocked ? `${job.shiftHours} hr shift · ${money(job.hourlyPay * job.shiftHours)} gross · -${job.energyCost} energy` : job.requirementText ?? 'Locked'} disabled={!unlocked || !enoughEnergy} disabledReason={unlocked && !enoughEnergy ? `Need ${job.energyCost} energy` : undefined} onPress={() => commit(workShift(state, job.id), `${job.shiftHours}-hour ${job.title} shift complete.`, 'success')} />;
        })}
      </Section>
    </>
  );

  const renderLife = () => (
    <>
      <PageIntro title="LIFE" subtitle="Upgrade the things that unlock better opportunities." />
      <Section title="ESSENTIALS" subtitle="Gear and mobility">
        {purchases.map(item => { const owned = state.inventory.includes(item.id); return <GameButton key={item.id} badge={owned ? 'OWNED' : money(item.cost)} title={item.label} detail={item.description} disabled={owned || state.cash < item.cost} disabledReason={!owned && state.cash < item.cost ? `${money(item.cost - state.cash)} short` : undefined} onPress={() => commit(buyItem(state, item.id, item.cost), `${item.label} purchased.`, 'success')} />; })}
      </Section>
      <Section title="HOUSING" subtitle="Stability versus ongoing expense">
        {housing.map(option => { const current = state.housing === option.id; const unlocked = !option.requires || option.requires(state); return <GameButton key={option.id} badge={current ? 'CURRENT' : money(option.cost)} title={option.label} detail={current ? `${money(option.dailyCost)}/day ongoing cost` : unlocked ? `${option.description} · ${money(option.dailyCost)}/day` : option.requirementText ?? 'Locked'} disabled={current || !unlocked || state.cash < option.cost} disabledReason={!current && unlocked && state.cash < option.cost ? `${money(option.cost - state.cash)} short` : undefined} onPress={() => commit(buyHousing(state, option.id as HousingType), `Moved into ${option.label}.`, 'success')} />; })}
      </Section>
      <Section title="EDUCATION" subtitle="Trade time and money for better careers">
        {education.map(option => { const complete = state.education === option.id || (state.education === 'Trade Certificate' && option.id === 'GED'); const unlocked = !option.requires || option.requires(state); return <GameButton key={option.id} badge={complete ? 'COMPLETE' : money(option.cost)} title={option.label} detail={complete ? 'Completed.' : unlocked ? `${option.days} days · ${option.description}` : option.requirementText ?? 'Locked'} disabled={complete || !unlocked || state.cash < option.cost} disabledReason={!complete && unlocked && state.cash < option.cost ? `${money(option.cost - state.cash)} short` : undefined} onPress={() => commit(enrollEducation(state, option.id as EducationType), `${option.label} completed.`, 'success')} />; })}
      </Section>
    </>
  );

  const renderMoney = () => (
    <>
      <PageIntro title="MONEY" subtitle="Manage cash flow, savings, investing, and debt." />
      <View style={styles.financeSummary}><Stat label="Cash" value={money(state.cash)} /><Stat label="Savings" value={money(state.savings)} /><Stat label="Invested" value={money(state.investments)} /><Stat label="Debt" value={money(state.debt)} /></View>
      <Section title="SAVINGS" subtitle="Low growth, easy access">
        <FinanceCard label="SAVINGS BALANCE" value={money(state.savings)} sub="Savings earn a small amount of interest as game time passes." />
        <View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`save-${amount}`} label={`Save ${money(amount)}`} disabled={state.cash < amount} onPress={() => commit(transferToSavings(state, amount), `${money(amount)} moved into savings.`)} />)}</View>
        <View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`withdraw-${amount}`} label={`Withdraw ${money(amount)}`} disabled={state.savings < amount} onPress={() => commit(withdrawSavings(state, amount), `${money(amount)} moved back to cash.`)} />)}</View>
      </Section>
      <Section title="INVESTMENTS" subtitle="Higher long-term growth">
        <FinanceCard label="INVESTED" value={money(state.investments)} sub="Investments grow as game time passes and count toward net worth." />
        <View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`invest-${amount}`} label={`Invest ${money(amount)}`} disabled={state.cash < amount} onPress={() => commit(investCash(state, amount), `${money(amount)} invested.`)} />)}</View>
        <View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`sell-${amount}`} label={`Sell ${money(amount)}`} disabled={state.investments < amount} onPress={() => commit(sellInvestments(state, amount), `${money(amount)} sold.`)} />)}</View>
      </Section>
      {state.debt > 0 ? <Section title="DEBT" subtitle="Get back above water"><FinanceCard label="DEBT" value={money(state.debt)} sub="Pay this down to improve net worth." /><View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`debt-${amount}`} label={`Pay ${money(amount)}`} disabled={state.cash <= 0} onPress={() => commit(payDebt(state, amount), 'Debt payment made.')} />)}</View></Section> : null}
    </>
  );

  const renderEmpire = () => (
    <>
      <PageIntro title="EMPIRE" subtitle="Make money without trading every hour of your life." />
      <View style={styles.passiveHero}><Text style={styles.passiveLabel}>PASSIVE INCOME</Text><Text style={styles.passiveValue}>{money(passive)}/day</Text><Text style={styles.passiveSub}>Living costs: {money(dailyExpenses)}/day · Net passive: {money(dailyNet)}/day</Text></View>
      <Section title="BUSINESSES" subtitle="Launch, automate, and scale">
        {businesses.map(business => { const level = state.businesses[business.id] ?? 0; const unlocked = !business.requires || business.requires(state); const cost = getBusinessUpgradeCost(state, business.id); const maxed = level >= business.maxLevel; const income = level <= 0 ? business.dailyIncome : business.dailyIncome * level * (1 + Math.max(0, level - 1) * 0.12); return <GameButton key={business.id} badge={maxed ? 'MAX' : level > 0 ? `LV ${level}` : 'NEW'} title={business.label} detail={!unlocked ? business.requirementText ?? 'Locked' : level > 0 ? `${money(income)}/day current income · Next upgrade ${money(cost)}` : `${business.description} · Starts at ${money(business.dailyIncome)}/day · ${money(cost)} to launch`} disabled={!unlocked || maxed || state.cash < cost} disabledReason={unlocked && !maxed && state.cash < cost ? `${money(cost - state.cash)} short` : undefined} onPress={() => commit(upgradeBusiness(state, business.id), level === 0 ? `${business.label} launched.` : `${business.label} upgraded to level ${level + 1}.`, 'success')} />; })}
      </Section>
      <Section title="ACHIEVEMENTS" subtitle={`${state.achievements.length} of ${achievements.length} unlocked`}>
        <View style={styles.achievementGrid}>{achievements.map(item => { const unlocked = state.achievements.includes(item.id); return <View key={item.id} style={[styles.achievement, unlocked && styles.achievementUnlocked]}><Text style={[styles.achievementName, !unlocked && styles.textDisabled]}>{unlocked ? '✓ ' : '○ '}{item.label}</Text><Text style={styles.achievementDesc}>{unlocked ? item.description : 'Keep playing to discover this milestone.'}</Text></View>; })}</View>
      </Section>
    </>
  );

  const pageContent = page === 'home' ? renderHome() : page === 'work' ? renderWork() : page === 'life' ? renderLife() : page === 'money' ? renderMoney() : renderEmpire();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" backgroundColor="#090b0d" />
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.brand}>BOTTOM DOLLAR</Text><Text style={styles.subBrand}>an MT64 Labs game</Text></View><View style={styles.dateBadge}><Text style={styles.dateMain}>AGE {age.toFixed(1)}</Text><Text style={styles.dateSub}>DAY {day}</Text></View></View>
          {pageContent}
          <Text style={styles.build}>BOTTOM DOLLAR · EARLY BUILD 0.4</Text>
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

function PageIntro({ title, subtitle }: { title: string; subtitle: string }) { return <View style={styles.pageIntro}><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSubtitle}>{subtitle}</Text></View>; }
function NavItem({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) { return <TouchableOpacity onPress={onPress} style={styles.navItem}><Text style={[styles.navIcon, active && styles.navActive]}>{icon}</Text><Text style={[styles.navLabel, active && styles.navActive]}>{label}</Text>{active ? <View style={styles.navDot} /> : null}</TouchableOpacity>; }
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) { return <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>{children}</View>; }
function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{value}</Text></View>; }
function LifeCard({ icon, label, value }: { icon: string; label: string; value: string }) { return <View style={styles.lifeCard}><Text style={styles.lifeIcon}>{icon}</Text><View style={styles.lifeCopy}><Text style={styles.lifeLabel}>{label}</Text><Text numberOfLines={1} style={styles.lifeValue}>{value}</Text></View></View>; }
function Meter({ label, value, tone }: { label: string; value: number; tone: 'energy' | 'health' | 'happy' }) { const warning = value <= 25; return <View style={styles.meterRow}><View style={styles.meterLabelWrap}><Text style={styles.meterLabel}>{label}</Text><Text style={[styles.meterValue, warning && styles.meterWarning]}>{percent(value)}</Text></View><View style={styles.track}><View style={[styles.fill, styles[`fill_${tone}`], { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View></View>; }
function GameButton({ title, detail, badge, disabled, disabledReason, onPress }: { title: string; detail: string; badge?: string; disabled?: boolean; disabledReason?: string; onPress: () => void }) { return <TouchableOpacity activeOpacity={0.72} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.buttonDisabled]}><View style={styles.buttonTop}><Text style={[styles.buttonTitle, disabled && styles.textDisabled]}>{title}</Text>{badge ? <Text style={[styles.buttonBadge, disabled && styles.badgeDisabled]}>{badge}</Text> : null}</View><Text style={[styles.buttonDetail, disabled && styles.textDisabled]}>{detail}</Text>{disabledReason ? <Text style={styles.disabledReason}>{disabledReason}</Text> : null}</TouchableOpacity>; }
function FinanceCard({ label, value, sub }: { label: string; value: string; sub: string }) { return <View style={styles.financeCard}><Text style={styles.financeLabel}>{label}</Text><Text style={styles.financeValue}>{value}</Text><Text style={styles.financeSub}>{sub}</Text></View>; }
function MiniButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) { return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.miniButton, disabled && styles.buttonDisabled]}><Text style={[styles.miniText, disabled && styles.textDisabled]}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#090b0d' }, shell: { flex: 1 }, content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 34, gap: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, headerCopy: { flex: 1 }, brand: { color: '#f6f8f9', fontSize: 25, fontWeight: '900', letterSpacing: 1.6 }, subBrand: { color: '#737d84', marginTop: 3, fontSize: 12 }, dateBadge: { backgroundColor: '#111518', borderWidth: 1, borderColor: '#242b30', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'flex-end' }, dateMain: { color: '#d5dce0', fontSize: 11, fontWeight: '900' }, dateSub: { color: '#6f7a81', fontSize: 9, fontWeight: '800', marginTop: 2 },
  hero: { backgroundColor: '#121619', borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#242b30' }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { color: '#828d94', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, statusPill: { overflow: 'hidden', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900' }, statusPositive: { color: '#d6ff45', backgroundColor: '#273113' }, statusNegative: { color: '#ff8c8c', backgroundColor: '#36191b' }, netWorth: { color: '#f7f9fa', fontSize: 44, fontWeight: '900', marginTop: 8, marginBottom: 20, letterSpacing: -1 }, row: { flexDirection: 'row', gap: 10 }, stat: { flex: 1, minWidth: 0 }, statLabel: { color: '#717c83', fontSize: 10, fontWeight: '700' }, statValue: { color: '#dce2e5', fontWeight: '800', fontSize: 14, marginTop: 4 },
  noticeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#101416', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1d2428' }, noticeDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#d6ff45' }, noticeText: { color: '#aeb7bc', fontSize: 12, flex: 1, lineHeight: 17 }, eventCard: { backgroundColor: '#111518', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#273037' }, eventGood: { borderColor: '#294b34' }, eventBad: { borderColor: '#4a2c2c' }, eventTop: { flexDirection: 'row', justifyContent: 'space-between' }, eventLabel: { color: '#778289', fontSize: 9, fontWeight: '900' }, eventDay: { color: '#5f686e', fontSize: 9 }, eventTitle: { color: '#eef1f2', fontSize: 16, fontWeight: '900', marginTop: 8 }, eventBody: { color: '#89939a', fontSize: 11, lineHeight: 17, marginTop: 5 },
  meters: { backgroundColor: '#101416', borderRadius: 18, padding: 16, gap: 13, borderWidth: 1, borderColor: '#1d2428' }, meterRow: { gap: 7 }, meterLabelWrap: { flexDirection: 'row', justifyContent: 'space-between' }, meterLabel: { color: '#929ca2', fontSize: 10, fontWeight: '900' }, meterValue: { color: '#b8c0c4', fontSize: 10, fontWeight: '800' }, meterWarning: { color: '#ff9c75' }, track: { height: 8, backgroundColor: '#23292d', borderRadius: 99, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 99 }, fill_energy: { backgroundColor: '#d6ff45' }, fill_health: { backgroundColor: '#73e7a2' }, fill_happy: { backgroundColor: '#7cb5ff' },
  pageIntro: { marginTop: 2 }, pageTitle: { color: '#f5f7f8', fontSize: 27, fontWeight: '900', letterSpacing: 1.2 }, pageSubtitle: { color: '#6e7880', fontSize: 12, marginTop: 4, lineHeight: 18 }, section: { gap: 10 }, sectionHeading: { marginLeft: 2, marginBottom: 2 }, sectionTitle: { color: '#8a959c', fontSize: 12, fontWeight: '900', letterSpacing: 1.6 }, sectionSubtitle: { color: '#59636a', fontSize: 10, marginTop: 3 },
  lifeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, lifeCard: { width: '48.5%', minHeight: 68, backgroundColor: '#121619', borderColor: '#232a2f', borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, lifeIcon: { color: '#d6ff45', fontSize: 17, width: 20, textAlign: 'center' }, lifeCopy: { flex: 1 }, lifeLabel: { color: '#68737a', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }, lifeValue: { color: '#d9dfe2', fontSize: 12, fontWeight: '800', marginTop: 4 },
  button: { backgroundColor: '#14191c', borderRadius: 15, borderWidth: 1, borderColor: '#293137', padding: 15 }, buttonDisabled: { opacity: 0.46, backgroundColor: '#101416' }, buttonTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, buttonTitle: { color: '#f0f3f4', fontWeight: '800', fontSize: 15, flex: 1 }, buttonBadge: { color: '#d6ff45', backgroundColor: '#263011', overflow: 'hidden', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900' }, badgeDisabled: { color: '#7e878c', backgroundColor: '#23282b' }, buttonDetail: { color: '#828c92', fontSize: 11.5, marginTop: 6, lineHeight: 17 }, textDisabled: { color: '#667077' }, disabledReason: { color: '#c88e73', fontSize: 10, fontWeight: '700', marginTop: 6 },
  financeSummary: { flexDirection: 'row', backgroundColor: '#121619', borderRadius: 16, borderWidth: 1, borderColor: '#242b30', padding: 15, gap: 8 }, financeCard: { backgroundColor: '#121619', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#242b30' }, financeLabel: { color: '#748087', fontSize: 9, fontWeight: '900' }, financeValue: { color: '#f2f5f6', fontSize: 24, fontWeight: '900', marginTop: 4 }, financeSub: { color: '#6c777e', fontSize: 10, lineHeight: 15, marginTop: 5 }, quickRow: { flexDirection: 'row', gap: 8 }, miniButton: { flex: 1, backgroundColor: '#151b1f', borderWidth: 1, borderColor: '#2a3338', borderRadius: 11, paddingVertical: 11, paddingHorizontal: 8 }, miniText: { color: '#dce2e5', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  passiveHero: { backgroundColor: '#172014', borderWidth: 1, borderColor: '#31401f', borderRadius: 18, padding: 18 }, passiveLabel: { color: '#a5bd62', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, passiveValue: { color: '#d6ff45', fontSize: 32, fontWeight: '900', marginTop: 5 }, passiveSub: { color: '#81905b', fontSize: 10, marginTop: 6 }, achievementGrid: { gap: 8 }, achievement: { backgroundColor: '#101416', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#20272b' }, achievementUnlocked: { borderColor: '#3a4e20', backgroundColor: '#131a10' }, achievementName: { color: '#d6ff45', fontWeight: '900', fontSize: 12 }, achievementDesc: { color: '#6f7a81', fontSize: 10, marginTop: 4, lineHeight: 15 },
  milestone: { backgroundColor: '#d6ff45', borderRadius: 20, padding: 19 }, milestoneTop: { flexDirection: 'row', justifyContent: 'space-between' }, milestoneLabel: { color: '#161a12', fontSize: 10, fontWeight: '900' }, milestonePct: { color: '#34400c', fontSize: 12, fontWeight: '900' }, milestoneText: { color: '#161a12', fontWeight: '900', fontSize: 18, marginTop: 7 }, milestoneTrack: { backgroundColor: '#a9cb31', height: 7, borderRadius: 99, overflow: 'hidden', marginTop: 15 }, milestoneFill: { backgroundColor: '#151a11', height: '100%', borderRadius: 99 },
  nav: { flexDirection: 'row', backgroundColor: '#0d1113', borderTopWidth: 1, borderTopColor: '#20272b', paddingTop: 8, paddingBottom: 8, paddingHorizontal: 5 }, navItem: { flex: 1, alignItems: 'center', minHeight: 48, justifyContent: 'center' }, navIcon: { color: '#596269', fontSize: 16, fontWeight: '900' }, navLabel: { color: '#596269', fontSize: 8, fontWeight: '900', marginTop: 3, letterSpacing: 0.6 }, navActive: { color: '#d6ff45' }, navDot: { width: 4, height: 4, borderRadius: 99, backgroundColor: '#d6ff45', marginTop: 4 }, build: { color: '#3f474c', textAlign: 'center', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 }
});