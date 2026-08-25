import AsyncStorage from '@react-native-async-storage/async-storage';
import { LifeState } from './game/types';

const SAVE_KEY = '@bottom-dollar/save-v1';

export async function loadGame(): Promise<LifeState | null> {
  const raw = await AsyncStorage.getItem(SAVE_KEY);
  return raw ? (JSON.parse(raw) as LifeState) : null;
}

export async function saveGame(state: LifeState): Promise<void> {
  await AsyncStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastSavedAt: Date.now() }));
}

export async function clearGame(): Promise<void> {
  await AsyncStorage.removeItem(SAVE_KEY);
}
