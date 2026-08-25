import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { actions, jobs, purchases } from './src/game/data';
import { buyItem, createNewLife, getAge, getNetWorth, performAction, workShift } from './src/game/engine';
import { LifeState } from './src/game/types';
import { loadGame, saveGame } from './src/storage';

const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: value < 1000 ? 2 : 0, maximumFractionDigits: value < 1000 ? 2 : 0 });

export default function App() {
  const [state, setState] = useState<LifeState>(createNewLife());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadGame().then(saved => {
      if (saved) setState(saved);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => saveGame(state), 250);
    return () => clearTimeout(timer);
  }, [state, ready]);

  const age = getAge(state);
  const netWorth = getNetWorth(state);
  const currentJob = useMemo(() => jobs.find(j => j.id === state.currentJobId), [state.currentJobId]);

  const commit = (next: LifeState, haptic: 'light' | 'success' = 'light') => {
    if (next === state) return;
    setState(next);
    if (haptic === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>BOTTOM DOLLAR</Text>
            <Text style={styles.subBrand}>an MT64 Labs game</Text>
          </View>
          <Text style={styles.age}>AGE {age.toFixed(1)}</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>NET WORTH</Text>
          <Text style={styles.netWorth}>{money(netWorth)}</Text>
          <View style={styles.row}>
            <Stat label="Cash" value={money(state.cash)} />
            <Stat label="Debt" value={money(state.debt)} />
          </View>
        </View>

        <View style={styles.meters}>
          <Meter label="ENERGY" value={state.energy} />
          <Meter label="HEALTH" value={state.health} />
          <Meter label="HAPPINESS" value={state.happiness} />
        </View>

        <Section title="CURRENT LIFE">
          <Text style={styles.lifeLine}>Housing  ·  {state.housing}</Text>
          <Text style={styles.lifeLine}>Job  ·  {currentJob?.title ?? 'Unemployed'}</Text>
          <Text style={styles.lifeLine}>Education  ·  {state.education}</Text>
        </Section>

        <Section title="MAKE MONEY">
          {actions.map(action => {
            const unlocked = !action.requires || action.requires(state);
            const enoughEnergy = state.energy >= action.energyCost;
            return (
              <GameButton
                key={action.id}
                title={action.label}
                detail={unlocked ? `${money(action.minCash)}–${money(action.maxCash)} · ${action.minutes} min · -${action.energyCost} energy` : action.requirementText ?? 'Locked'}
                disabled={!unlocked || !enoughEnergy}
                onPress={() => commit(performAction(state, action.id))}
              />
            );
          })}
        </Section>

        <Section title="BUY YOUR WAY UP">
          {purchases.map(item => {
            const owned = state.inventory.includes(item.id);
            return (
              <GameButton
                key={item.id}
                title={owned ? `${item.label} ✓` : `${item.label} · ${money(item.cost)}`}
                detail={item.description}
                disabled={owned || state.cash < item.cost}
                onPress={() => commit(buyItem(state, item.id, item.cost), 'success')}
              />
            );
          })}
        </Section>

        <Section title="JOBS">
          {jobs.map(job => {
            const unlocked = !job.requires || job.requires(state);
            const enoughEnergy = state.energy >= job.energyCost;
            return (
              <GameButton
                key={job.id}
                title={`${job.title} · ${money(job.hourlyPay)}/hr`}
                detail={unlocked ? `${job.shiftHours} hr shift · ${money(job.hourlyPay * job.shiftHours)} gross · -${job.energyCost} energy` : job.requirementText ?? 'Locked'}
                disabled={!unlocked || !enoughEnergy}
                onPress={() => commit(workShift(state, job.id), 'success')}
              />
            );
          })}
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>FIRST MILESTONE</Text>
          <Text style={styles.footerText}>Get clean clothes, land a real job, and reach $1,000 net worth.</Text>
          <Text style={styles.footerMeta}>Lifetime earned: {money(state.stats.earned ?? 0)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

function Meter({ label, value }: { label: string; value: number }) {
  return <View style={styles.meterRow}><Text style={styles.meterLabel}>{label}</Text><View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View><Text style={styles.meterValue}>{Math.round(value)}%</Text></View>;
}

function GameButton({ title, detail, disabled, onPress }: { title: string; detail: string; disabled?: boolean; onPress: () => void }) {
  return <TouchableOpacity activeOpacity={0.75} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.buttonDisabled]}><Text style={[styles.buttonTitle, disabled && styles.textDisabled]}>{title}</Text><Text style={[styles.buttonDetail, disabled && styles.textDisabled]}>{detail}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0d0f' },
  content: { padding: 18, paddingBottom: 48, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 6 },
  brand: { color: '#f5f7f8', fontSize: 24, fontWeight: '900', letterSpacing: 1.5 },
  subBrand: { color: '#6f787f', marginTop: 2, fontSize: 12 },
  age: { color: '#9ba4aa', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  hero: { backgroundColor: '#121619', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#20262a' },
  eyebrow: { color: '#7f8a91', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  netWorth: { color: '#f5f7f8', fontSize: 42, fontWeight: '900', marginTop: 4, marginBottom: 18 },
  row: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1 }, statLabel: { color: '#707a81', fontSize: 11 }, statValue: { color: '#dbe1e5', fontWeight: '700', marginTop: 3 },
  meters: { backgroundColor: '#101316', borderRadius: 14, padding: 14, gap: 10 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, meterLabel: { color: '#8b959c', width: 76, fontSize: 10, fontWeight: '800' }, meterValue: { color: '#aab2b7', width: 34, textAlign: 'right', fontSize: 11 },
  track: { flex: 1, height: 7, backgroundColor: '#20262a', borderRadius: 99, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: '#d6ff45', borderRadius: 99 },
  section: { gap: 9 }, sectionTitle: { color: '#687279', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginLeft: 2, marginBottom: 2 },
  lifeLine: { backgroundColor: '#121619', borderColor: '#20262a', borderWidth: 1, borderRadius: 12, padding: 13, color: '#cbd2d6', fontWeight: '600' },
  button: { backgroundColor: '#151a1d', borderRadius: 13, borderWidth: 1, borderColor: '#293137', padding: 14 },
  buttonDisabled: { opacity: 0.42 }, buttonTitle: { color: '#f0f3f4', fontWeight: '800', fontSize: 15 }, buttonDetail: { color: '#7f898f', fontSize: 12, marginTop: 5, lineHeight: 17 }, textDisabled: { color: '#667077' },
  footer: { marginTop: 4, backgroundColor: '#d6ff45', borderRadius: 16, padding: 18 }, footerTitle: { color: '#161a12', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }, footerText: { color: '#161a12', fontWeight: '800', fontSize: 17, marginTop: 6, lineHeight: 23 }, footerMeta: { color: '#46501d', marginTop: 12, fontSize: 12, fontWeight: '700' }
});
