export type LifeState = {
  ageDays: number;
  cash: number;
  debt: number;
  energy: number;
  health: number;
  happiness: number;
  housing: 'Homeless' | 'Shelter' | 'Rented Room' | 'Apartment';
  education: 'None' | 'GED' | 'Trade Certificate';
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
  requires?: (state: LifeState) => boolean;
  requirementText?: string;
};

export type JobDefinition = {
  id: string;
  title: string;
  hourlyPay: number;
  shiftHours: number;
  energyCost: number;
  requires?: (state: LifeState) => boolean;
  requirementText?: string;
};
