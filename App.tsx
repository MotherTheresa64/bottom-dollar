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

const money = (value: number) => value.toLocaleString('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: Math.abs(value) < 1000 ? 2 : 0, maximumFractionDigits: Math.abs(value) < 1000 ? 2 : 0
});
const percent = (value: number) => `${Math.round(Math.max(0, Math.min(100, value)))}%`;
const duration = (minutes: number) => minutes >= 1440 ? `${Math.round(minutes / 1440)} days` : minutes >= 60 ? `${minutes / 60} hr` : `${minutes} min`;

export default function App() {
  const [state, setState] = useState<LifeState>(createNewLife());
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('Build a stable life from absolutely nothing.');

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

  const commit = (next: LifeState, message: string, haptic: 'light' | 'success' = 'light') => {
    if (next === state) return;
    setState(next);
    setNotice(message);
    if (haptic === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const quickAmounts = [50, 250, 1000];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" backgroundColor="#090b0d" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.brand}>BOTTOM DOLLAR</Text>
            <Text style={styles.subBrand}>an MT64 Labs game</Text>
          </View>
          <View style={styles.dateBadge}>
            <Text style={styles.dateMain}>AGE {age.toFixed(1)}</Text>
            <Text style={styles.dateSub}>DAY {day}</Text>
          </View>
        </View>

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

        <View style={styles.noticeCard}>
          <View style={styles.noticeDot} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>

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
          <Text style={styles.meterHint}>Low energy blocks work. Poor health and unstable housing make long-term progress harder.</Text>
        </View>

        <Section title="CURRENT LIFE" subtitle="Where you stand right now">
          <View style={styles.lifeGrid}>
            <LifeCard icon="⌂" label="Housing" value={state.housing} />
            <LifeCard icon="●" label="Job" value={currentJob?.title ?? 'Unemployed'} />
            <LifeCard icon="◆" label="Education" value={state.education} />
            <LifeCard icon="▣" label="Businesses" value={`${businessCount} active`} />
          </View>
        </Section>

        <Section title="RECOVER" subtitle="You cannot grind forever">
          {recovery.map(option => {
            const unlocked = !option.requires || option.requires(state);
            const affordable = state.cash >= option.cost;
            const gains = [`+${option.energyGain} energy`];
            if (option.healthGain) gains.push(`+${option.healthGain} health`);
            if (option.happinessGain) gains.push(`${option.happinessGain > 0 ? '+' : ''}${option.happinessGain} happiness`);
            return <GameButton key={option.id} badge={option.cost > 0 ? money(option.cost) : 'FREE'} title={option.label} detail={unlocked ? `${duration(option.minutes)} · ${gains.join(' · ')}` : option.requirementText ?? 'Locked'} disabled={!unlocked || !affordable} disabledReason={unlocked && !affordable ? `${money(option.cost - state.cash)} short` : undefined} onPress={() => commit(recover(state, option.id), `${option.label}: you took care of yourself.`)} />;
          })}
        </Section>

        <Section title="MAKE MONEY" subtitle="Every dollar costs time and energy">
          {actions.map(action => {
            const unlocked = !action.requires || action.requires(state);
            const enoughEnergy = state.energy >= action.energyCost;
            return <GameButton key={action.id} badge={duration(action.minutes).toUpperCase()} title={action.label} detail={unlocked ? `${money(action.minCash)}–${money(action.maxCash)} · -${action.energyCost} energy` : action.requirementText ?? 'Locked'} disabled={!unlocked || !enoughEnergy} disabledReason={unlocked && !enoughEnergy ? `Need ${action.energyCost} energy` : undefined} onPress={() => { const before = state.cash; const next = performAction(state, action.id); commit(next, `${action.label}: +${money(Math.max(0, next.cash - before))} earned.`); }} />;
          })}
        </Section>

        <Section title="ESSENTIALS" subtitle="Small purchases unlock bigger opportunities">
          {purchases.map(item => {
            const owned = state.inventory.includes(item.id);
            return <GameButton key={item.id} badge={owned ? 'OWNED' : money(item.cost)} title={item.label} detail={item.description} disabled={owned || state.cash < item.cost} disabledReason={!owned && state.cash < item.cost ? `${money(item.cost - state.cash)} short` : undefined} onPress={() => commit(buyItem(state, item.id, item.cost), `${item.label} purchased. New opportunities may be available.`, 'success')} />;
          })}
        </Section>

        <Section title="HOUSING" subtitle="Better housing improves recovery but can add daily costs">
          {housing.map(option => {
            const current = state.housing === option.id;
            const unlocked = !option.requires || option.requires(state);
            return <GameButton key={option.id} badge={current ? 'CURRENT' : money(option.cost)} title={option.label} detail={current ? `${money(option.dailyCost)}/day ongoing cost` : unlocked ? `${option.description} · ${money(option.dailyCost)}/day` : option.requirementText ?? 'Locked'} disabled={current || !unlocked || state.cash < option.cost} disabledReason={!current && unlocked && state.cash < option.cost ? `${money(option.cost - state.cash)} short` : undefined} onPress={() => commit(buyHousing(state, option.id as HousingType), `Moved into ${option.label}. Watch the ongoing cost.`, 'success')} />;
          })}
        </Section>

        <Section title="EDUCATION" subtitle="Spend money and time now to earn more later">
          {education.map(option => {
            const complete = state.education === option.id || (state.education === 'Trade Certificate' && option.id === 'GED');
            const unlocked = !option.requires || option.requires(state);
            return <GameButton key={option.id} badge={complete ? 'COMPLETE' : money(option.cost)} title={option.label} detail={complete ? 'Completed.' : unlocked ? `${option.days} days · ${option.description}` : option.requirementText ?? 'Locked'} disabled={complete || !unlocked || state.cash < option.cost} disabledReason={!complete && unlocked && state.cash < option.cost ? `${money(option.cost - state.cash)} short` : undefined} onPress={() => commit(enrollEducation(state, option.id as EducationType), `${option.label} completed. Better career paths unlocked.`, 'success')} />;
          })}
        </Section>

        <Section title="JOBS" subtitle="Work shifts, build experience, and unlock better pay">
          {jobs.map(job => {
            const unlocked = !job.requires || job.requires(state);
            const enoughEnergy = state.energy >= job.energyCost;
            const active = state.currentJobId === job.id;
            return <GameButton key={job.id} badge={active ? 'CURRENT' : `${money(job.hourlyPay)}/HR`} title={job.title} detail={unlocked ? `${job.shiftHours} hr shift · ${money(job.hourlyPay * job.shiftHours)} gross · -${job.energyCost} energy` : job.requirementText ?? 'Locked'} disabled={!unlocked || !enoughEnergy} disabledReason={unlocked && !enoughEnergy ? `Need ${job.energyCost} energy` : undefined} onPress={() => commit(workShift(state, job.id), `${job.shiftHours}-hour ${job.title} shift complete.`, 'success')} />;
          })}
        </Section>

        <Section title="MONEY MANAGEMENT" subtitle="Protect cash, invest, and keep debt under control">
          <FinanceCard label="SAVINGS" value={money(state.savings)} sub="Savings earn a small amount of interest as game time passes." />
          <View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`save-${amount}`} label={`Save ${money(amount)}`} disabled={state.cash < amount} onPress={() => commit(transferToSavings(state, amount), `${money(amount)} moved into savings.`)} />)}</View>
          <View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`withdraw-${amount}`} label={`Withdraw ${money(amount)}`} disabled={state.savings < amount} onPress={() => commit(withdrawSavings(state, amount), `${money(amount)} moved back to cash.`)} />)}</View>

          <FinanceCard label="INVESTMENTS" value={money(state.investments)} sub="Investments grow slowly over time and still count toward net worth." />
          <View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`invest-${amount}`} label={`Invest ${money(amount)}`} disabled={state.cash < amount} onPress={() => commit(investCash(state, amount), `${money(amount)} invested for the long term.`)} />)}</View>
          <View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`sell-${amount}`} label={`Sell ${money(amount)}`} disabled={state.investments < amount} onPress={() => commit(sellInvestments(state, amount), `${money(amount)} of investments sold.`)} />)}</View>

          {state.debt > 0 ? <><FinanceCard label="DEBT" value={money(state.debt)} sub="Unexpected costs can push you into debt when cash runs out." /><View style={styles.quickRow}>{quickAmounts.map(amount => <MiniButton key={`debt-${amount}`} label={`Pay ${money(amount)}`} disabled={state.cash <= 0 || state.debt <= 0} onPress={() => commit(payDebt(state, amount), `Debt payment made.`)} />)}</View></> : null}
        </Section>

        <Section title="BUSINESSES" subtitle="Build income that keeps flowing while you do other things">
          {businesses.map(business => {
            const level = state.businesses[business.id] ?? 0;
            const unlocked = !business.requires || business.requires(state);
            const cost = getBusinessUpgradeCost(state, business.id);
            const maxed = level >= business.maxLevel;
            const income = level <= 0 ? business.dailyIncome : business.dailyIncome * level * (1 + Math.max(0, level - 1) * 0.12);
            return <GameButton key={business.id} badge={maxed ? 'MAX' : level > 0 ? `LV ${level}` : 'NEW'} title={business.label} detail={!unlocked ? business.requirementText ?? 'Locked' : level > 0 ? `${money(income)}/day current income · Next upgrade ${money(cost)}` : `${business.description} · Starts at ${money(business.dailyIncome)}/day · ${money(cost)} to launch`} disabled={!unlocked || maxed || state.cash < cost} disabledReason={unlocked && !maxed && state.cash < cost ? `${money(cost - state.cash)} short` : undefined} onPress={() => commit(upgradeBusiness(state, business.id), level === 0 ? `${business.label} launched. You now have passive income.` : `${business.label} upgraded to level ${level + 1}.`, 'success')} />;
          })}
        </Section>

        <Section title="ACHIEVEMENTS" subtitle={`${state.achievements.length} of ${achievements.length} unlocked`}>
          <View style={styles.achievementGrid}>
            {achievements.map(item => {
              const unlocked = state.achievements.includes(item.id);
              return <View key={item.id} style={[styles.achievement, unlocked && styles.achievementUnlocked]}><Text style={[styles.achievementName, !unlocked && styles.textDisabled]}>{unlocked ? '✓ ' : '○ '}{item.label}</Text><Text style={styles.achievementDesc}>{unlocked ? item.description : 'Keep playing to discover this milestone.'}</Text></View>;
            })}
          </View>
        </Section>

        <View style={styles.milestone}>
          <View style={styles.milestoneTop}><Text style={styles.milestoneLabel}>NEXT WEALTH MILESTONE</Text><Text style={styles.milestonePct}>{Math.round(milestoneProgress)}%</Text></View>
          <Text style={styles.milestoneText}>Reach {money(nextMilestone)} net worth.</Text>
          <View style={styles.milestoneTrack}><View style={[styles.milestoneFill, { width: `${milestoneProgress}%` }]} /></View>
          <View style={styles.milestoneStats}><Text style={styles.milestoneMeta}>{money(netWorth)} current</Text><Text style={styles.milestoneMeta}>{Math.round(state.stats.shifts ?? 0)} shifts · {businessCount} businesses</Text></View>
        </View>

        <Text style={styles.build}>BOTTOM DOLLAR · EARLY BUILD 0.3</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>{children}</View>;
}
function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{value}</Text></View>; }
function LifeCard({ icon, label, value }: { icon: string; label: string; value: string }) { return <View style={styles.lifeCard}><Text style={styles.lifeIcon}>{icon}</Text><View style={styles.lifeCopy}><Text style={styles.lifeLabel}>{label}</Text><Text numberOfLines={1} style={styles.lifeValue}>{value}</Text></View></View>; }
function FinanceCard({ label, value, sub }: { label: string; value: string; sub: string }) { return <View style={styles.financeCard}><Text style={styles.financeLabel}>{label}</Text><Text style={styles.financeValue}>{value}</Text><Text style={styles.financeSub}>{sub}</Text></View>; }
function Meter({ label, value, tone }: { label: string; value: number; tone: 'energy' | 'health' | 'happy' }) { const warning = value <= 25; return <View style={styles.meterRow}><View style={styles.meterLabelWrap}><Text style={styles.meterLabel}>{label}</Text><Text style={[styles.meterValue, warning && styles.meterWarning]}>{percent(value)}</Text></View><View style={styles.track}><View style={[styles.fill, styles[`fill_${tone}`], { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View></View>; }
function MiniButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) { return <TouchableOpacity disabled={disabled} activeOpacity={0.7} onPress={onPress} style={[styles.miniButton, disabled && styles.buttonDisabled]}><Text style={[styles.miniButtonText, disabled && styles.textDisabled]}>{label}</Text></TouchableOpacity>; }
function GameButton({ title, detail, badge, disabled, disabledReason, onPress }: { title: string; detail: string; badge?: string; disabled?: boolean; disabledReason?: string; onPress: () => void }) { return <TouchableOpacity activeOpacity={0.72} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.buttonDisabled]}><View style={styles.buttonTop}><Text style={[styles.buttonTitle, disabled && styles.textDisabled]}>{title}</Text>{badge ? <Text style={[styles.buttonBadge, disabled && styles.badgeDisabled]}>{badge}</Text> : null}</View><Text style={[styles.buttonDetail, disabled && styles.textDisabled]}>{detail}</Text>{disabledReason ? <Text style={styles.disabledReason}>{disabledReason}</Text> : null}</TouchableOpacity>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#090b0d' }, content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 60, gap: 20 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, headerCopy: { flex: 1 }, brand: { color: '#f6f8f9', fontSize: 25, fontWeight: '900', letterSpacing: 1.6 }, subBrand: { color: '#737d84', marginTop: 3, fontSize: 12 }, dateBadge: { backgroundColor: '#111518', borderWidth: 1, borderColor: '#242b30', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'flex-end' }, dateMain: { color: '#d5dce0', fontSize: 11, fontWeight: '900' }, dateSub: { color: '#6f7a81', fontSize: 9, fontWeight: '800', marginTop: 2 },
  hero: { backgroundColor: '#121619', borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#242b30' }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { color: '#828d94', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, statusPill: { overflow: 'hidden', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900' }, statusPositive: { color: '#d6ff45', backgroundColor: '#273113' }, statusNegative: { color: '#ff8c8c', backgroundColor: '#36191b' }, netWorth: { color: '#f7f9fa', fontSize: 44, fontWeight: '900', marginTop: 8, marginBottom: 20, letterSpacing: -1 }, row: { flexDirection: 'row', gap: 10 }, stat: { flex: 1, minWidth: 0 }, statLabel: { color: '#717c83', fontSize: 10, fontWeight: '700' }, statValue: { color: '#dce2e5', fontWeight: '800', fontSize: 14, marginTop: 4 },
  noticeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#101416', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#1d2428' }, noticeDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#d6ff45' }, noticeText: { color: '#aeb7bc', fontSize: 12, flex: 1, lineHeight: 17 },
  eventCard: { backgroundColor: '#111518', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#293137' }, eventGood: { borderColor: '#315b3d' }, eventBad: { borderColor: '#61393b' }, eventTop: { flexDirection: 'row', justifyContent: 'space-between' }, eventLabel: { color: '#7d888f', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, eventDay: { color: '#626c72', fontSize: 9, fontWeight: '800' }, eventTitle: { color: '#f0f3f4', fontSize: 15, fontWeight: '900', marginTop: 7 }, eventBody: { color: '#879198', fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  meters: { backgroundColor: '#101416', borderRadius: 18, padding: 16, gap: 13, borderWidth: 1, borderColor: '#1d2428' }, meterRow: { gap: 7 }, meterLabelWrap: { flexDirection: 'row', justifyContent: 'space-between' }, meterLabel: { color: '#929ca2', fontSize: 10, fontWeight: '900' }, meterValue: { color: '#b8c0c4', fontSize: 10, fontWeight: '800' }, meterWarning: { color: '#ff9c75' }, meterHint: { color: '#616b71', fontSize: 10, lineHeight: 15 }, track: { height: 8, backgroundColor: '#23292d', borderRadius: 99, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 99 }, fill_energy: { backgroundColor: '#d6ff45' }, fill_health: { backgroundColor: '#73e7a2' }, fill_happy: { backgroundColor: '#7cb5ff' },
  section: { gap: 10 }, sectionHeading: { marginLeft: 2, marginBottom: 2 }, sectionTitle: { color: '#8a959c', fontSize: 12, fontWeight: '900', letterSpacing: 1.6 }, sectionSubtitle: { color: '#59636a', fontSize: 10, marginTop: 3 }, lifeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, lifeCard: { width: '48.5%', minHeight: 68, backgroundColor: '#121619', borderColor: '#232a2f', borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, lifeIcon: { color: '#d6ff45', fontSize: 17, width: 20, textAlign: 'center' }, lifeCopy: { flex: 1, minWidth: 0 }, lifeLabel: { color: '#68737a', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }, lifeValue: { color: '#d9dfe2', fontSize: 12, fontWeight: '800', marginTop: 4 },
  button: { backgroundColor: '#14191c', borderRadius: 15, borderWidth: 1, borderColor: '#293137', padding: 15 }, buttonDisabled: { opacity: 0.46, backgroundColor: '#101416' }, buttonTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, buttonTitle: { color: '#f0f3f4', fontWeight: '800', fontSize: 15, flex: 1 }, buttonBadge: { color: '#d6ff45', backgroundColor: '#263011', overflow: 'hidden', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900' }, badgeDisabled: { color: '#7e878c', backgroundColor: '#23282b' }, buttonDetail: { color: '#828c92', fontSize: 11.5, marginTop: 6, lineHeight: 17 }, textDisabled: { color: '#667077' }, disabledReason: { color: '#c88e73', fontSize: 10, fontWeight: '700', marginTop: 6 },
  financeCard: { backgroundColor: '#111518', borderWidth: 1, borderColor: '#232b30', borderRadius: 15, padding: 15 }, financeLabel: { color: '#7f8a91', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, financeValue: { color: '#f2f4f5', fontSize: 24, fontWeight: '900', marginTop: 4 }, financeSub: { color: '#667077', fontSize: 10.5, lineHeight: 15, marginTop: 4 }, quickRow: { flexDirection: 'row', gap: 8 }, miniButton: { flex: 1, backgroundColor: '#171d20', borderWidth: 1, borderColor: '#2a3338', paddingHorizontal: 8, paddingVertical: 11, borderRadius: 11, alignItems: 'center' }, miniButtonText: { color: '#d9e0e3', fontSize: 10, fontWeight: '800' },
  achievementGrid: { gap: 8 }, achievement: { borderWidth: 1, borderColor: '#20272b', borderRadius: 12, padding: 12, backgroundColor: '#101416' }, achievementUnlocked: { borderColor: '#3a4a20', backgroundColor: '#151b10' }, achievementName: { color: '#d6ff45', fontWeight: '900', fontSize: 12 }, achievementDesc: { color: '#707a80', fontSize: 10, lineHeight: 14, marginTop: 4 },
  milestone: { marginTop: 2, backgroundColor: '#d6ff45', borderRadius: 20, padding: 19 }, milestoneTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, milestoneLabel: { color: '#161a12', fontSize: 11, fontWeight: '900' }, milestonePct: { color: '#34400c', fontSize: 12, fontWeight: '900' }, milestoneText: { color: '#161a12', fontWeight: '900', fontSize: 18, marginTop: 7, lineHeight: 24 }, milestoneTrack: { backgroundColor: '#a9cb31', height: 7, borderRadius: 99, overflow: 'hidden', marginTop: 15 }, milestoneFill: { backgroundColor: '#151a11', height: '100%', borderRadius: 99 }, milestoneStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 10 }, milestoneMeta: { color: '#46501d', fontSize: 10, fontWeight: '800' }, build: { color: '#3f474c', textAlign: 'center', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 }
});
