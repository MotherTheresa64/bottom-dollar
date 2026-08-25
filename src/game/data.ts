import { ActionDefinition, JobDefinition } from './types';

export const actions: ActionDefinition[] = [
  { id: 'beg', label: 'Ask for Change', description: 'Try your luck with passersby.', minCash: 0.05, maxCash: 1.5, minutes: 30, energyCost: 2 },
  { id: 'cans', label: 'Collect Cans', description: 'Search for recyclables and cash them in.', minCash: 3, maxCash: 12, minutes: 120, energyCost: 10, requires: s => s.inventory.includes('backpack'), requirementText: 'Requires a backpack' },
  { id: 'oddjob', label: 'Take an Odd Job', description: 'Do a quick local job for cash.', minCash: 15, maxCash: 45, minutes: 180, energyCost: 18, requires: s => s.inventory.includes('clean-clothes'), requirementText: 'Requires clean clothes' }
];

export const jobs: JobDefinition[] = [
  { id: 'dishwasher', title: 'Dishwasher', hourlyPay: 11, shiftHours: 8, energyCost: 35, requires: s => s.inventory.includes('clean-clothes'), requirementText: 'Requires clean clothes' },
  { id: 'warehouse', title: 'Warehouse Associate', hourlyPay: 16, shiftHours: 8, energyCost: 42, requires: s => s.inventory.includes('clean-clothes'), requirementText: 'Requires clean clothes' },
  { id: 'apprentice', title: 'Electrical Apprentice', hourlyPay: 22, shiftHours: 8, energyCost: 38, requires: s => s.education === 'Trade Certificate', requirementText: 'Requires a trade certificate' }
];

export const purchases = [
  { id: 'backpack', label: 'Used Backpack', cost: 8, description: 'Unlocks collecting cans.' },
  { id: 'clean-clothes', label: 'Clean Clothes', cost: 25, description: 'Unlocks entry-level jobs.' }
];
