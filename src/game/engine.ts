import { actions, education, housing, jobs, recovery } from './data';
import { EducationType, HousingType, LifeState } from './types';

export const MINUTES_PER_DAY = 1440;
export const DAYS_PER_YEAR = 365;

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export const createNewLife = (): LifeState => ({
  ageDays: 18 * DAYS_PER_YEAR,
  cash: 0,
  debt: 0,
  energy: 100,
  health: 100,
  happiness: 45,
  housing: 'Homeless',
  education: 'None',
  currentJobId: null,
  inventory: [],
  stats: { taps: 0, earned: 0, spent: 0, daysLived: 0, shifts: 0, rested: 0 },
  history: [{ id: 'start', title: 'A New Life', body: 'You start with nothing but time.', day: 0 }],
  createdAt: Date.now(),
  lastSavedAt: Date.now()
});

export const normalizeState = (state: Partial<LifeState> | null | undefined): LifeState => {
  const fresh = createNewLife();
  if (!state) return fresh;
  return {
    ...fresh,
    ...state,
    energy: clamp(state.energy ?? fresh.energy),
    health: clamp(state.health ?? fresh.health),
    happiness: clamp(state.happiness ?? fresh.happiness),
    inventory: Array.isArray(state.inventory) ? state.inventory : [],
    history: Array.isArray(state.history) ? state.history : fresh.history,
    stats: { ...fresh.stats, ...(state.stats ?? {}) }
  };
};

export const advanceTime = (state: LifeState, minutes: number): LifeState => {
  const days = minutes / MINUTES_PER_DAY;
  let health = state.health;
  let happiness = state.happiness;

  // Exhaustion and unstable housing matter, but gently enough to avoid early soft-locks.
  if (state.energy <= 10) health -= days * 5;
  if (state.housing === 'Homeless') happiness -= days * 0.8;

  return {
    ...state,
    ageDays: state.ageDays + days,
    health: clamp(health),
    happiness: clamp(happiness),
    stats: { ...state.stats, daysLived: (state.stats.daysLived ?? 0) + days }
  };
};

export const performAction = (state: LifeState, actionId: string): LifeState => {
  const action = actions.find(a => a.id === actionId);
  if (!action || state.energy < action.energyCost || (action.requires && !action.requires(state))) return state;
  const earned = action.minCash + Math.random() * (action.maxCash - action.minCash);
  const timed = advanceTime(state, action.minutes);
  return {
    ...timed,
    cash: timed.cash + earned,
    energy: clamp(timed.energy - action.energyCost),
    happiness: clamp(timed.happiness - (action.happinessCost ?? 0)),
    stats: { ...timed.stats, taps: (timed.stats.taps ?? 0) + 1, earned: (timed.stats.earned ?? 0) + earned }
  };
};

export const workShift = (state: LifeState, jobId: string): LifeState => {
  const job = jobs.find(j => j.id === jobId);
  if (!job || state.energy < job.energyCost || (job.requires && !job.requires(state))) return state;
  const pay = job.hourlyPay * job.shiftHours;
  const timed = advanceTime(state, job.shiftHours * 60);
  return {
    ...timed,
    currentJobId: job.id,
    cash: timed.cash + pay,
    energy: clamp(timed.energy - job.energyCost),
    happiness: clamp(timed.happiness - (job.happinessCost ?? 1)),
    stats: { ...timed.stats, earned: (timed.stats.earned ?? 0) + pay, shifts: (timed.stats.shifts ?? 0) + 1 }
  };
};

export const recover = (state: LifeState, recoveryId: string): LifeState => {
  const option = recovery.find(r => r.id === recoveryId);
  if (!option || state.cash < option.cost || (option.requires && !option.requires(state))) return state;
  const timed = advanceTime(state, option.minutes);
  const home = housing.find(h => h.id === state.housing);
  const isSleep = recoveryId === 'sleep' || recoveryId === 'bench-sleep';
  const energyBonus = isSleep ? (home?.energyBonus ?? 0) : 0;
  const healthBonus = isSleep ? (home?.healthBonus ?? 0) : 0;
  return {
    ...timed,
    cash: timed.cash - option.cost,
    energy: clamp(timed.energy + option.energyGain + energyBonus),
    health: clamp(timed.health + option.healthGain + healthBonus),
    happiness: clamp(timed.happiness + option.happinessGain),
    stats: {
      ...timed.stats,
      spent: (timed.stats.spent ?? 0) + option.cost,
      rested: (timed.stats.rested ?? 0) + (isSleep ? 1 : 0)
    }
  };
};

export const buyItem = (state: LifeState, id: string, cost: number): LifeState => {
  if (state.cash < cost || state.inventory.includes(id)) return state;
  return {
    ...state,
    cash: state.cash - cost,
    inventory: [...state.inventory, id],
    happiness: clamp(state.happiness + 1),
    stats: { ...state.stats, spent: (state.stats.spent ?? 0) + cost }
  };
};

export const buyHousing = (state: LifeState, id: HousingType): LifeState => {
  const option = housing.find(h => h.id === id);
  if (!option || state.cash < option.cost || (option.requires && !option.requires(state))) return state;
  return {
    ...state,
    cash: state.cash - option.cost,
    housing: option.id,
    happiness: clamp(state.happiness + 8),
    health: clamp(state.health + 3),
    stats: { ...state.stats, spent: (state.stats.spent ?? 0) + option.cost }
  };
};

export const enrollEducation = (state: LifeState, id: EducationType): LifeState => {
  const option = education.find(e => e.id === id);
  if (!option || state.cash < option.cost || (option.requires && !option.requires(state))) return state;
  const timed = advanceTime(state, option.days * MINUTES_PER_DAY);
  return {
    ...timed,
    cash: timed.cash - option.cost,
    education: option.id,
    energy: clamp(timed.energy - 10),
    happiness: clamp(timed.happiness + 5),
    stats: { ...timed.stats, spent: (timed.stats.spent ?? 0) + option.cost }
  };
};

export const getAge = (state: LifeState) => state.ageDays / DAYS_PER_YEAR;
export const getNetWorth = (state: LifeState) => state.cash - state.debt;
export const getDayNumber = (state: LifeState) => Math.max(1, Math.floor(state.ageDays - 18 * DAYS_PER_YEAR) + 1);
