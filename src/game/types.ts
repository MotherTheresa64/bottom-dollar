export type HousingType = 'Homeless' | 'Shelter' | 'Rented Room' | 'Apartment' | 'House';
export type EducationType = 'None' | 'GED' | 'Trade Certificate';

export type LifeState = {
  ageDays: number;
  cash: number;
  savings: number;
  investments: number;
  debt: number;
  energy: number;
  health: number;
  happiness: number;
  housing: HousingType;
  education: EducationType;
  currentJobId: string | null;
  inventory: string[];
  businesses: Record<string, number>;
  achievements: string[];
  stats: Record<string, number>;
  history: LifeEvent[];
  createdAt: number;
  lastSavedAt: number;
  dead: boolean;
  deathReason: string | null;
  livesCompleted: number;
  bestNetWorth: number;
};

export type LifeEvent = {
  id: string;
  title: string;
  body: string;
  day: number;
  tone?: 'good' | 'bad' | 'neutral';
};

export type ActionDefinition = {
  id: string;
  label: string;
  description: string;
  minCash: number;
  maxCash: number;
  minutes: number;
  energyCost: number;
  happinessCost?: number;
  requires?: (state: LifeState) => boolean;
  requirementText?: string;
};

export type JobDefinition = {
  id: string;
  title: string;
  hourlyPay: number;
  shiftHours: number;
  energyCost: number;
  happinessCost?: number;
  requires?: (state: LifeState) => boolean;
  requirementText?: string;
};

export type PurchaseDefinition = {
  id: string;
  label: string;
  cost: number;
  description: string;
};

export type RecoveryDefinition = {
  id: string;
  label: string;
  description: string;
  minutes: number;
  cost: number;
  energyGain: number;
  healthGain: number;
  happinessGain: number;
  requires?: (state: LifeState) => boolean;
  requirementText?: string;
};

export type HousingDefinition = {
  id: HousingType;
  label: string;
  cost: number;
  dailyCost: number;
  description: string;
  energyBonus: number;
  healthBonus: number;
  requires?: (state: LifeState) => boolean;
  requirementText?: string;
};

export type EducationDefinition = {
  id: EducationType;
  label: string;
  cost: number;
  days: number;
  description: string;
  requires?: (state: LifeState) => boolean;
  requirementText?: string;
};

export type BusinessDefinition = {
  id: string;
  label: string;
  description: string;
  baseCost: number;
  dailyIncome: number;
  maxLevel: number;
  requires?: (state: LifeState) => boolean;
  requirementText?: string;
};

export type AchievementDefinition = {
  id: string;
  label: string;
  description: string;
  test: (state: LifeState) => boolean;
};
