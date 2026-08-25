import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { actions, education, housing, jobs, purchases, recovery } from './src/game/data';
import {
  buyHousing,
  buyItem,
  createNewLife,
  enrollEducation,
  getAge,
  getDayNumber,
  getNetWorth,
  normalizeState,
  performAction,
  recover,
  workShift
} from './src/game/engine';
import { LifeState } from './src/game/types';
import { loadGame, saveGame } from './src/storage';

const ACCENT = '#d6ff45';
const money = (value: number) => value.toLocaleString('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: value < 1000 ? 2 : 0,
  maximumFractionDigits: value < 1000 ? 2 : 0
});
const hours = (minutes: number) => minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`;

export default function App() {
  const [state, setState] = useState<LifeState>(createNewLife());
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('You have one life. Start with nothing and build something worth remembering.');

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
  const currentJob = useMemo(() => jobs.find(j => j.id === state.currentJobId), [state.currentJobId]);
  const milestoneProgress = Math.max(0, Math.min(1, netWorth / 1000));

  const commit = (next: LifeState, message: string, haptic: 'light' | 'success' = 'light') => {
    if (next === state) return;
    setState(next);
    setNotice(message);
    if (haptic === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const condition = state.energy < 15
    ? 'You are exhausted. Recover before trying to work.'
    : state.health < 30
      ? 'Your health is becoming a serious problem.'
      : state.happiness < 20
        ? 'You are barely holding it together. A meal or better housing would help.'
        : state.housing === 'Homeless'
          ? 'Survival comes first. Secure food, rest, and a path to stable housing.'
          : 'You are stable enough to start thinking about the next rung of the ladder.';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>BOTTOM DOLLAR</Text>
            <Text style={styles.subBrand}>an MT64 Labs game</Text>
          </View>
          <View style={styles.timeBlock}>
            <Text style={styles.age}>AGE {age.toFixed(1)}</Text>
            <Text style={styles.day}>DAY {day}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>NET WORTH</Text>
          <Text style={styles.netWorth}>{money(netWorth)}</Text>
          <View style={styles.row}>
            <Stat label="CASH" value={money(state.cash)} />
            <Stat label="DEBT" value={money(state.debt)} />
            <Stat label="LIFETIME" value={money(state.stats.earned ?? 0)} />
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeLabel}>RIGHT NOW</Text>
          <Text style={styles.noticeText}>{notice}</Text>
          <Text style={styles.conditionText}>{condition}</Text>
        </View>

        <View style={styles.meters}>
          <Meter label="ENERGY" value={state.energy} />
          <Meter label="HEALTH" value={state.health} />
          <Meter label="HAPPINESS" value={state.happiness} />
        </View>

        <Section title="RECOVER">
          {recovery.map(option => {
            const unlocked = !option.requires || option.requires(state);
            const affordable = state.cash >= option.cost;
            const detail = !unlocked
              ? option.requirementText ?? 'Locked'
              : `${hours(option.minutes)} · ${option.cost > 0 ? money(option.cost) : 'FREE'} · +${option.energyGain} energy${option.healthGain ? ` · +${option.healthGain} health` : ''}${option.happinessGain ? ` · ${option.happinessGain > 0 ? '+' : ''}${option.happinessGain} happiness` : ''}`;
            return (
              <GameButton
                key={option.id}
                title={option.label}
                detail={detail}
                disabled={!unlocked || !affordable}
                accent={option.id.includes('sleep')}
                onPress={() => commit(recover(state, option.id), `${option.label}: you took time to recover.`, option.id.includes('sleep') ? 'success' : 'light')}
              />
            );
          })}
        </Section>

        <Section title="CURRENT LIFE">
          <View style={styles.lifeGrid}>
            <LifeTile label="HOUSING" value={state.housing} />
            <LifeTile label="JOB" value={currentJob?.title ?? 'Unemployed'} />
            <LifeTile label="EDUCATION" value={state.education} />
            <LifeTile label="TRANSPORT" value={state.inventory.includes('bike') ? 'Bicycle' : 'On foot'} />
          </View>
        </Section>

        <Section title="MAKE MONEY">
          {actions.map(action => {
            const unlocked = !action.requires || action.requires(state);
            const enoughEnergy = state.energy >= action.energyCost;
            const detail = !unlocked
              ? action.requirementText ?? 'Locked'
              : !enoughEnergy
                ? `Need ${action.energyCost} energy · Recover first`
                : `${money(action.minCash)}–${money(action.maxCash)} · ${hours(action.minutes)} · -${action.energyCost} energy`;
            return (
              <GameButton
                key={action.id}
                title={action.label}
                detail={detail}
                disabled={!unlocked || !enoughEnergy}
                onPress={() => {
                  const before = state.cash;
                  const next = performAction(state, action.id);
                  commit(next, `${action.label}: +${money(next.cash - before)} earned.`);
                }}
              />
            );
          })}
        </Section>

        <Section title="GEAR & MOBILITY">
          {purchases.map(item => {
            const owned = state.inventory.includes(item.id);
            return (
              <GameButton
                key={item.id}
                title={owned ? `${item.label}  ✓` : `${item.label} · ${money(item.cost)}`}
                detail={owned ? 'Owned' : item.description}
                disabled={owned || state.cash < item.cost}
                accent={!owned && state.cash >= item.cost}
                onPress={() => commit(buyItem(state, item.id, item.cost), `${item.label} acquired. New opportunities may be available.`, 'success')}
              />
            );
          })}
        </Section>

        <Section title="HOUSING">
          {housing.map(option => {
            const isCurrent = state.housing === option.id;
            const unlocked = !option.requires || option.requires(state);
            return (
              <GameButton
                key={option.id}
                title={isCurrent ? `${option.label}  ✓` : `${option.label} · ${money(option.cost)}`}
                detail={isCurrent ? 'Current housing' : unlocked ? option.description : option.requirementText ?? 'Locked'}
                disabled={isCurrent || !unlocked || state.cash < option.cost}
                accent={!isCurrent && unlocked && state.cash >= option.cost}
                onPress={() => commit(buyHousing(state, option.id), `Housing upgraded: ${option.label}. Sleep will be more effective now.`, 'success')}
              />
            );
          })}
        </Section>

        <Section title="EDUCATION">
          {education.map(option => {
            const complete = state.education === option.id || (state.education === 'Trade Certificate' && option.id === 'GED');
            const unlocked = !option.requires || option.requires(state);
            return (
              <GameButton
                key={option.id}
                title={complete ? `${option.label}  ✓` : `${option.label} · ${money(option.cost)}`}
                detail={complete ? 'Completed' : unlocked ? `${option.days} days · ${option.description}` : option.requirementText ?? 'Locked'}
                disabled={complete || !unlocked || state.cash < option.cost}
                accent={!complete && unlocked && state.cash >= option.cost}
                onPress={() => commit(enrollEducation(state, option.id), `${option.label} completed. Your career options just expanded.`, 'success')}
              />
            );
          })}
        </Section>

        <Section title="JOBS">
          {jobs.map(job => {
            const unlocked = !job.requires || job.requires(state);
            const enoughEnergy = state.energy >= job.energyCost;
            const workingHere = state.currentJobId === job.id;
            const detail = !unlocked
              ? job.requirementText ?? 'Locked'
              : !enoughEnergy
                ? `Need ${job.energyCost} energy · Recover before a shift`
                : `${job.shiftHours} hr shift · ${money(job.hourlyPay * job.shiftHours)} gross · -${job.energyCost} energy`;
            return (
              <GameButton
                key={job.id}
                title={`${workingHere ? '● ' : ''}${job.title} · ${money(job.hourlyPay)}/hr`}
                detail={detail}
                disabled={!unlocked || !enoughEnergy}
                accent={workingHere}
                onPress={() => commit(workShift(state, job.id), `Shift complete at ${job.title}: +${money(job.hourlyPay * job.shiftHours)}.`, 'success')}
              />
            );
          })}
        </Section>

        <View style={styles.milestone}>
          <View style={styles.milestoneHeader}>
            <Text style={styles.milestoneTitle}>FIRST MILESTONE</Text>
            <Text style={styles.milestonePercent}>{Math.floor(milestoneProgress * 100)}%</Text>
          </View>
          <Text style={styles.milestoneText}>Get clean clothes, land a real job, and reach $1,000 net worth.</Text>
          <View style={styles.milestoneTrack}><View style={[styles.milestoneFill, { width: `${milestoneProgress * 100}%` }]} /></View>
          <Text style={styles.milestoneMeta}>{money(netWorth)} / $1,000 net worth</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{value}</Text></View>;
}

function LifeTile({ label, value }: { label: string; value: string }) {
  return <View style={styles.lifeTile}><Text style={styles.lifeLabel}>{label}</Text><Text style={styles.lifeValue}>{value}</Text></View>;
}

function Meter({ label, value }: { label: string; value: number }) {
  const status = value < 20 ? 'CRITICAL' : value < 50 ? 'LOW' : value < 80 ? 'OK' : 'GOOD';
  return (
    <View>
      <View style={styles.meterTop}><Text style={styles.meterLabel}>{label}</Text><Text style={styles.meterStatus}>{status} · {Math.round(value)}%</Text></View>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, value))}%`, opacity: value < 20 ? 0.5 : 1 }]} /></View>
    </View>
  );
}

function GameButton({ title, detail, disabled, accent, onPress }: { title: string; detail: string; disabled?: boolean; accent?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.72}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, accent && !disabled && styles.buttonAccent, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonTitle, accent && !disabled && styles.buttonTitleAccent, disabled && styles.textDisabled]}>{title}</Text>
      <Text style={[styles.buttonDetail, accent && !disabled && styles.buttonDetailAccent, disabled && styles.textDisabled]}>{detail}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080a0b' },
  content: { padding: 18, paddingBottom: 56, gap: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 6 },
  brand: { color: '#f6f7f7', fontSize: 24, fontWeight: '900', letterSpacing: 1.5 },
  subBrand: { color: '#626b71', marginTop: 3, fontSize: 12 },
  timeBlock: { alignItems: 'flex-end' },
  age: { color: '#a1a9ae', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  day: { color: '#596269', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 3 },

  hero: { backgroundColor: '#111517', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#242b2f' },
  eyebrow: { color: '#7c878e', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  netWorth: { color: '#f7f8f8', fontSize: 43, fontWeight: '900', marginTop: 4, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1 },
  statLabel: { color: '#687279', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  statValue: { color: '#dbe1e4', fontWeight: '800', marginTop: 4, fontSize: 14 },

  notice: { borderLeftWidth: 3, borderLeftColor: ACCENT, backgroundColor: '#101416', borderRadius: 12, padding: 14 },
  noticeLabel: { color: ACCENT, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  noticeText: { color: '#eef1f2', marginTop: 5, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  conditionText: { color: '#737e84', marginTop: 6, fontSize: 11, lineHeight: 16 },

  meters: { backgroundColor: '#101416', borderRadius: 16, padding: 15, gap: 14, borderWidth: 1, borderColor: '#181e21' },
  meterTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  meterLabel: { color: '#a7afb4', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  meterStatus: { color: '#717c82', fontSize: 9, fontWeight: '800' },
  track: { height: 7, backgroundColor: '#23292d', borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: ACCENT, borderRadius: 99 },

  section: { gap: 9 },
  sectionTitle: { color: '#647078', fontSize: 11, fontWeight: '900', letterSpacing: 1.6, marginLeft: 2, marginBottom: 1 },
  lifeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  lifeTile: { width: '48.5%', backgroundColor: '#111517', borderColor: '#232a2e', borderWidth: 1, borderRadius: 13, padding: 13 },
  lifeLabel: { color: '#657078', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  lifeValue: { color: '#d7dcdf', fontWeight: '800', fontSize: 13, marginTop: 5 },

  button: { backgroundColor: '#13181b', borderRadius: 14, borderWidth: 1, borderColor: '#283137', padding: 15 },
  buttonAccent: { borderColor: '#708526', backgroundColor: '#18200f' },
  buttonDisabled: { opacity: 0.38 },
  buttonTitle: { color: '#f0f3f4', fontWeight: '900', fontSize: 15 },
  buttonTitleAccent: { color: '#e7ff98' },
  buttonDetail: { color: '#7d888f', fontSize: 12, marginTop: 5, lineHeight: 17 },
  buttonDetailAccent: { color: '#9eae6a' },
  textDisabled: { color: '#5d666c' },

  milestone: { marginTop: 2, backgroundColor: ACCENT, borderRadius: 18, padding: 18 },
  milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  milestoneTitle: { color: '#161a12', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  milestonePercent: { color: '#46501d', fontSize: 11, fontWeight: '900' },
  milestoneText: { color: '#161a12', fontWeight: '900', fontSize: 17, marginTop: 7, lineHeight: 23 },
  milestoneTrack: { height: 8, backgroundColor: '#a8cc2d', borderRadius: 99, marginTop: 14, overflow: 'hidden' },
  milestoneFill: { height: '100%', backgroundColor: '#222713', borderRadius: 99 },
  milestoneMeta: { color: '#46501d', marginTop: 7, fontSize: 11, fontWeight: '800' }
});
