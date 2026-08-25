import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeState } from './game/engine';
import { LifeState } from './game/types';

const SAVE_KEY = '@bottom-dollar/save-v1';

export async function loadGame(): Promise<LifeState | null> {
  const raw = await AsyncStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return normalizeState(JSON.parse(raw));
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
