import { achievements, actions, businesses, education, housing, jobs, recovery } from './data';
import { EducationType, HousingType, LifeEvent, LifeState } from './types';

export const MINUTES_PER_DAY = 1440;
export const DAYS_PER_YEAR = 365;

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const createNewLife = (): LifeState => ({
  ageDays: 18 * DAYS_PER_YEAR,
  cash: 0,
  savings: 0,
  investments: 0,
  debt: 0,
  energy: 100,
  health: 100,
  happiness: 45,
  housing: 'Homeless',
  education: 'None',
  currentJobId: null,
  inventory: [],
  businesses: {},
  achievements: [],
  stats: { taps: 0, earned: 0, passiveEarned: 0, spent: 0, daysLived: 0, shifts: 0, rested: 0, events: 0 },
  history: [{ id: 'start', title: 'A New Life', body: 'You start with nothing but time.', day: 0, tone: 'neutral' }],
  createdAt: Date.now(),
  lastSavedAt: Date.now()
});

export const normalizeState = (state: Partial<LifeState> | null | undefined): LifeState => {
  const fresh = createNewLife();
  if (!state) return fresh;
  const merged: LifeState = {
    ...fresh,
    ...state,
    savings: Math.max(0, state.savings ?? 0),
    investments: Math.max(0, state.investments ?? 0),
    energy: clamp(state.energy ?? fresh.energy),
    health: clamp(state.health ?? fresh.health),
    happiness: clamp(state.happiness ?? fresh.happiness),
    inventory: Array.isArray(state.inventory) ? state.inventory : [],
    businesses: state.businesses && typeof state.businesses === 'object' ? state.businesses : {},
    achievements: Array.isArray(state.achievements) ? state.achievements : [],
    history: Array.isArray(state.history) ? state.history : fresh.history,
    stats: { ...fresh.stats, ...(state.stats ?? {}) }
  };
  return syncAchievements(merged);
};

export const getPassiveIncomePerDay = (state: LifeState) => businesses.reduce((total, business) => {
  const level = state.businesses[business.id] ?? 0;
  if (level <= 0) return total;
  return total + business.dailyIncome * level * (1 + Math.max(0, level - 1) * 0.12);
}, 0);

export const getDailyExpenses = (state: LifeState) => housing.find(h => h.id === state.housing)?.dailyCost ?? 0;

const pushEvent = (state: LifeState, event: LifeEvent): LifeState => ({
  ...state,
  history: [...state.history.slice(-39), event],
  stats: { ...state.stats, events: (state.stats.events ?? 0) + 1 }
});

const maybeRandomEvent = (state: LifeState, elapsedDays: number): LifeState => {
  if (elapsedDays <= 0) return state;
  const chance = Math.min(0.35, elapsedDays * 0.07);
  if (Math.random() > chance) return state;

  const day = getDayNumber(state);
  const roll = Math.random();
  if (roll < 0.22) {
    const found = roundMoney(8 + Math.random() * 42);
    return pushEvent({ ...state, cash: state.cash + found, stats: { ...state.stats, earned: (state.stats.earned ?? 0) + found } }, {
      id: `windfall-${Date.now()}`, title: 'Small Break', body: `A little unexpected luck put $${found.toFixed(2)} in your pocket.`, day, tone: 'good'
    });
  }
  if (roll < 0.44) {
    const cost = roundMoney(12 + Math.random() * 88);
    const paid = Math.min(state.cash, cost);
    const shortfall = Math.max(0, cost - paid);
    return pushEvent({ ...state, cash: state.cash - paid, debt: state.debt + shortfall, stats: { ...state.stats, spent: (state.stats.spent ?? 0) + cost } }, {
      id: `expense-${Date.now()}`, title: 'Unexpected Expense', body: `Life happened. An unplanned expense cost you $${cost.toFixed(2)}.`, day, tone: 'bad'
    });
  }
  if (roll < 0.64) {
    return pushEvent({ ...state, health: clamp(state.health - 7), energy: clamp(state.energy - 8) }, {
      id: `sick-${Date.now()}`, title: 'Feeling Rough', body: 'You lost some energy and health to a rough couple of days.', day, tone: 'bad'
    });
  }
  if (roll < 0.82) {
    return pushEvent({ ...state, happiness: clamp(state.happiness + 8) }, {
      id: `goodday-${Date.now()}`, title: 'A Good Day', body: 'Something finally went your way. Happiness improved.', day, tone: 'good'
    });
  }
  if (getPassiveIncomePerDay(state) > 0) {
    const bonus = roundMoney(getPassiveIncomePerDay(state) * (1 + Math.random() * 2));
    return pushEvent({ ...state, cash: state.cash + bonus, stats: { ...state.stats, earned: (state.stats.earned ?? 0) + bonus, passiveEarned: (state.stats.passiveEarned ?? 0) + bonus } }, {
      id: `customer-${Date.now()}`, title: 'Great Customer', body: `One of your businesses had a great day and brought in an extra $${bonus.toFixed(2)}.`, day, tone: 'good'
    });
  }
  return state;
};

export const syncAchievements = (state: LifeState): LifeState => {
  const unlocked = [...state.achievements];
  achievements.forEach(achievement => {
    if (!unlocked.includes(achievement.id) && achievement.test(state)) unlocked.push(achievement.id);
  });
  return unlocked.length === state.achievements.length ? state : { ...state, achievements: unlocked };
};

export const advanceTime = (state: LifeState, minutes: number): LifeState => {
  const days = minutes / MINUTES_PER_DAY;
  let health = state.health;
  let happiness = state.happiness;

  if (state.energy <= 10) health -= days * 5;
  if (state.housing === 'Homeless') happiness -= days * 0.8;
  if (state.housing === 'Shelter') happiness -= days * 0.2;

  const passive = getPassiveIncomePerDay(state) * days;
  const expenses = getDailyExpenses(state) * days;
  const savingsInterest = state.savings * 0.00008 * days;
  const investmentGrowth = state.investments * 0.00021 * days;
  let cash = state.cash + passive - expenses;
  let debt = state.debt;
  if (cash < 0) {
    debt += Math.abs(cash);
    cash = 0;
  }

  let next: LifeState = {
    ...state,
    ageDays: state.ageDays + days,
    cash: roundMoney(cash),
    savings: roundMoney(state.savings + savingsInterest),
    investments: roundMoney(state.investments + investmentGrowth),
    debt: roundMoney(debt),
    health: clamp(health),
    happiness: clamp(happiness),
    stats: {
      ...state.stats,
      daysLived: (state.stats.daysLived ?? 0) + days,
      earned: (state.stats.earned ?? 0) + passive,
      passiveEarned: (state.stats.passiveEarned ?? 0) + passive,
      spent: (state.stats.spent ?? 0) + expenses
    }
  };
  next = maybeRandomEvent(next, days);
  return syncAchievements(next);
};

export const performAction = (state: LifeState, actionId: string): LifeState => {
  const action = actions.find(a => a.id === actionId);
  if (!action || state.energy < action.energyCost || (action.requires && !action.requires(state))) return state;
  const earned = roundMoney(action.minCash + Math.random() * (action.maxCash - action.minCash));
  const timed = advanceTime(state, action.minutes);
  return syncAchievements({
    ...timed,
    cash: roundMoney(timed.cash + earned),
    energy: clamp(timed.energy - action.energyCost),
    happiness: clamp(timed.happiness - (action.happinessCost ?? 0)),
    stats: { ...timed.stats, taps: (timed.stats.taps ?? 0) + 1, earned: (timed.stats.earned ?? 0) + earned }
  });
};

export const workShift = (state: LifeState, jobId: string): LifeState => {
  const job = jobs.find(j => j.id === jobId);
  if (!job || state.energy < job.energyCost || (job.requires && !job.requires(state))) return state;
  const pay = roundMoney(job.hourlyPay * job.shiftHours);
  const timed = advanceTime(state, job.shiftHours * 60);
  return syncAchievements({
    ...timed,
    currentJobId: job.id,
    cash: roundMoney(timed.cash + pay),
    energy: clamp(timed.energy - job.energyCost),
    happiness: clamp(timed.happiness - (job.happinessCost ?? 1)),
    stats: { ...timed.stats, earned: (timed.stats.earned ?? 0) + pay, shifts: (timed.stats.shifts ?? 0) + 1 }
  });
};

export const recover = (state: LifeState, recoveryId: string): LifeState => {
  const option = recovery.find(r => r.id === recoveryId);
  if (!option || state.cash < option.cost || (option.requires && !option.requires(state))) return state;
  const timed = advanceTime(state, option.minutes);
  const home = housing.find(h => h.id === state.housing);
  const isSleep = recoveryId === 'sleep' || recoveryId === 'bench-sleep';
  const energyBonus = isSleep ? (home?.energyBonus ?? 0) : 0;
  const healthBonus = isSleep ? (home?.healthBonus ?? 0) : 0;
  return syncAchievements({
    ...timed,
    cash: roundMoney(Math.max(0, timed.cash - option.cost)),
    energy: clamp(timed.energy + option.energyGain + energyBonus),
    health: clamp(timed.health + option.healthGain + healthBonus),
    happiness: clamp(timed.happiness + option.happinessGain),
    stats: { ...timed.stats, spent: (timed.stats.spent ?? 0) + option.cost, rested: (timed.stats.rested ?? 0) + (isSleep ? 1 : 0) }
  });
};

export const buyItem = (state: LifeState, id: string, cost: number): LifeState => {
  if (state.cash < cost || state.inventory.includes(id)) return state;
  return syncAchievements({
    ...state,
    cash: roundMoney(state.cash - cost),
    inventory: [...state.inventory, id],
    happiness: clamp(state.happiness + 1),
    stats: { ...state.stats, spent: (state.stats.spent ?? 0) + cost }
  });
};

export const buyHousing = (state: LifeState, id: HousingType): LifeState => {
  const option = housing.find(h => h.id === id);
  if (!option || state.cash < option.cost || (option.requires && !option.requires(state))) return state;
  return syncAchievements({
    ...state,
    cash: roundMoney(state.cash - option.cost),
    housing: option.id,
    happiness: clamp(state.happiness + 8),
    health: clamp(state.health + 3),
    stats: { ...state.stats, spent: (state.stats.spent ?? 0) + option.cost }
  });
};

export const enrollEducation = (state: LifeState, id: EducationType): LifeState => {
  const option = education.find(e => e.id === id);
  if (!option || state.cash < option.cost || (option.requires && !option.requires(state))) return state;
  const paid = { ...state, cash: roundMoney(state.cash - option.cost), stats: { ...state.stats, spent: (state.stats.spent ?? 0) + option.cost } };
  const timed = advanceTime(paid, option.days * MINUTES_PER_DAY);
  return syncAchievements({ ...timed, education: option.id, energy: clamp(timed.energy - 10), happiness: clamp(timed.happiness + 5) });
};

export const transferToSavings = (state: LifeState, amount: number): LifeState => {
  const actual = Math.min(state.cash, Math.max(0, amount));
  if (actual <= 0) return state;
  return syncAchievements({ ...state, cash: roundMoney(state.cash - actual), savings: roundMoney(state.savings + actual) });
};

export const withdrawSavings = (state: LifeState, amount: number): LifeState => {
  const actual = Math.min(state.savings, Math.max(0, amount));
  if (actual <= 0) return state;
  return { ...state, savings: roundMoney(state.savings - actual), cash: roundMoney(state.cash + actual) };
};

export const investCash = (state: LifeState, amount: number): LifeState => {
  const actual = Math.min(state.cash, Math.max(0, amount));
  if (actual <= 0) return state;
  return syncAchievements({ ...state, cash: roundMoney(state.cash - actual), investments: roundMoney(state.investments + actual) });
};

export const sellInvestments = (state: LifeState, amount: number): LifeState => {
  const actual = Math.min(state.investments, Math.max(0, amount));
  if (actual <= 0) return state;
  return { ...state, investments: roundMoney(state.investments - actual), cash: roundMoney(state.cash + actual) };
};

export const payDebt = (state: LifeState, amount: number): LifeState => {
  const actual = Math.min(state.cash, state.debt, Math.max(0, amount));
  if (actual <= 0) return state;
  return { ...state, cash: roundMoney(state.cash - actual), debt: roundMoney(state.debt - actual) };
};

export const getBusinessUpgradeCost = (state: LifeState, businessId: string) => {
  const business = businesses.find(b => b.id === businessId);
  if (!business) return Infinity;
  const level = state.businesses[businessId] ?? 0;
  return roundMoney(business.baseCost * Math.pow(1.85, level));
};

export const upgradeBusiness = (state: LifeState, businessId: string): LifeState => {
  const business = businesses.find(b => b.id === businessId);
  if (!business) return state;
  const level = state.businesses[businessId] ?? 0;
  const cost = getBusinessUpgradeCost(state, businessId);
  if (level >= business.maxLevel || state.cash < cost || (business.requires && !business.requires(state))) return state;
  return syncAchievements({
    ...state,
    cash: roundMoney(state.cash - cost),
    businesses: { ...state.businesses, [businessId]: level + 1 },
    happiness: clamp(state.happiness + (level === 0 ? 6 : 2)),
    stats: { ...state.stats, spent: (state.stats.spent ?? 0) + cost }
  });
};

export const getAge = (state: LifeState) => state.ageDays / DAYS_PER_YEAR;
export const getNetWorth = (state: LifeState) => state.cash + state.savings + state.investments - state.debt;
export const getDayNumber = (state: LifeState) => Math.max(1, Math.floor(state.ageDays - 18 * DAYS_PER_YEAR) + 1);
