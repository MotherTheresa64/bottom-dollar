import { actions, jobs } from './data';
import { LifeState } from './types';

export const MINUTES_PER_DAY = 1440;
export const DAYS_PER_YEAR = 365;

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
  stats: { taps: 0, earned: 0, spent: 0, daysLived: 0 },
  history: [{ id: 'start', title: 'A New Life', body: 'You start with nothing but time.', day: 0 }],
  createdAt: Date.now(),
  lastSavedAt: Date.now()
});

export const advanceTime = (state: LifeState, minutes: number): LifeState => {
  const days = minutes / MINUTES_PER_DAY;
  return {
    ...state,
    ageDays: state.ageDays + days,
    energy: Math.max(0, Math.min(100, state.energy + days * 35)),
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
    energy: Math.max(0, timed.energy - action.energyCost),
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
    energy: Math.max(0, timed.energy - job.energyCost),
    happiness: Math.max(0, timed.happiness - 1),
    stats: { ...timed.stats, earned: (timed.stats.earned ?? 0) + pay }
  };
};

export const buyItem = (state: LifeState, id: string, cost: number): LifeState => {
  if (state.cash < cost || state.inventory.includes(id)) return state;
  return {
    ...state,
    cash: state.cash - cost,
    inventory: [...state.inventory, id],
    stats: { ...state.stats, spent: (state.stats.spent ?? 0) + cost }
  };
};

export const getAge = (state: LifeState) => state.ageDays / DAYS_PER_YEAR;
export const getNetWorth = (state: LifeState) => state.cash - state.debt;
