export type HousingType = 'Homeless' | 'Shelter' | 'Rented Room' | 'Apartment';
export type EducationType = 'None' | 'GED' | 'Trade Certificate';

export type LifeState = {
  ageDays: number;
  cash: number;
  debt: number;
  energy: number;
  health: number;
  happiness: number;
  housing: HousingType;
  education: EducationType;
  currentJobId: string | null;
  inventory: string[];
  stats: Record<string, number>;
  history: LifeEvent[];
  createdAt: number;
  lastSavedAt: number;
};

export type LifeEvent = {
  id: string;
  title: string;
  body: string;
  day: number;
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
