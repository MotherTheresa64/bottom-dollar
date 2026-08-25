import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPassiveIncomePerDay, normalizeState, syncAchievements } from './game/engine';
import { LifeState } from './game/types';

const SAVE_KEY = '@bottom-dollar/save-v1';
const OFFLINE_CAP_HOURS = 8;
const MIN_OFFLINE_MINUTES = 5;

export async function loadGame(): Promise<LifeState | null> {
  const raw = await AsyncStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const state = normalizeState(JSON.parse(raw));
    const now = Date.now();
    const elapsedMs = Math.max(0, now - (state.lastSavedAt || now));
    const elapsedMinutes = elapsedMs / 60000;
    const cappedHours = Math.min(OFFLINE_CAP_HOURS, elapsedMs / 3600000);
    const passivePerDay = getPassiveIncomePerDay(state);

    if (elapsedMinutes < MIN_OFFLINE_MINUTES || passivePerDay <= 0 || cappedHours <= 0) {
      return { ...state, lastSavedAt: now };
    }

    // Offline time does not age the character or charge in-game living expenses.
    // It represents unattended business operations, capped so active play still matters.
    const earned = Math.round(passivePerDay * (cappedHours / 24) * 100) / 100;
    if (earned <= 0) return { ...state, lastSavedAt: now };

    return syncAchievements({
      ...state,
      cash: Math.round((state.cash + earned) * 100) / 100,
      lastSavedAt: now,
      stats: {
        ...state.stats,
        earned: (state.stats.earned ?? 0) + earned,
        passiveEarned: (state.stats.passiveEarned ?? 0) + earned,
        offlineEarned: (state.stats.offlineEarned ?? 0) + earned
      },
      history: [
        ...state.history.slice(-39),
        {
          id: `offline-${now}`,
          title: 'Welcome Back',
          body: `Your businesses earned $${earned.toFixed(2)} while you were away${cappedHours >= OFFLINE_CAP_HOURS ? ' (8-hour cap reached)' : ''}.`,
          day: Math.max(1, Math.floor(state.ageDays - 18 * 365) + 1),
          tone: 'good'
        }
      ]
    });
  } catch {
    return null;
  }
}

export async function saveGame(state: LifeState): Promise<void> {
  await AsyncStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastSavedAt: Date.now() }));
}

export async function clearGame(): Promise<void> {
  await AsyncStorage.removeItem(SAVE_KEY);
}
