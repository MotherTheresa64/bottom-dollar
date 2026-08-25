import { ActionDefinition, EducationDefinition, HousingDefinition, JobDefinition, PurchaseDefinition, RecoveryDefinition } from './types';

export const actions: ActionDefinition[] = [
  { id: 'beg', label: 'Ask for Change', description: 'Try your luck with passersby.', minCash: 0.05, maxCash: 1.5, minutes: 30, energyCost: 2, happinessCost: 0.5 },
  { id: 'cans', label: 'Collect Cans', description: 'Search for recyclables and cash them in.', minCash: 3, maxCash: 12, minutes: 120, energyCost: 10, happinessCost: 1, requires: s => s.inventory.includes('backpack'), requirementText: 'Requires a backpack' },
  { id: 'oddjob', label: 'Take an Odd Job', description: 'Do a quick local job for cash.', minCash: 15, maxCash: 45, minutes: 180, energyCost: 18, happinessCost: 1, requires: s => s.inventory.includes('clean-clothes'), requirementText: 'Requires clean clothes' },
  { id: 'delivery', label: 'Make Deliveries', description: 'Use your bike to make local deliveries.', minCash: 24, maxCash: 58, minutes: 180, energyCost: 15, requires: s => s.inventory.includes('bike'), requirementText: 'Requires a used bicycle' }
];

export const jobs: JobDefinition[] = [
  { id: 'dishwasher', title: 'Dishwasher', hourlyPay: 11, shiftHours: 8, energyCost: 35, happinessCost: 2, requires: s => s.inventory.includes('clean-clothes'), requirementText: 'Requires clean clothes' },
  { id: 'retail', title: 'Retail Associate', hourlyPay: 14, shiftHours: 8, energyCost: 30, happinessCost: 2, requires: s => s.inventory.includes('clean-clothes'), requirementText: 'Requires clean clothes' },
  { id: 'warehouse', title: 'Warehouse Associate', hourlyPay: 16, shiftHours: 8, energyCost: 42, happinessCost: 2.5, requires: s => s.inventory.includes('clean-clothes'), requirementText: 'Requires clean clothes' },
  { id: 'maintenance', title: 'Maintenance Tech', hourlyPay: 20, shiftHours: 8, energyCost: 36, happinessCost: 1.5, requires: s => s.education === 'GED' || s.education === 'Trade Certificate', requirementText: 'Requires a GED' },
  { id: 'apprentice', title: 'Electrical Apprentice', hourlyPay: 22, shiftHours: 8, energyCost: 38, happinessCost: 1, requires: s => s.education === 'Trade Certificate', requirementText: 'Requires a trade certificate' }
];

export const purchases: PurchaseDefinition[] = [
  { id: 'backpack', label: 'Used Backpack', cost: 8, description: 'Unlocks collecting cans.' },
  { id: 'clean-clothes', label: 'Clean Clothes', cost: 25, description: 'Unlocks entry-level jobs.' },
  { id: 'phone', label: 'Prepaid Phone', cost: 60, description: 'A basic phone. Future opportunities will require it.' },
  { id: 'bike', label: 'Used Bicycle', cost: 110, description: 'Unlocks delivery work and better mobility.' }
];

export const recovery: RecoveryDefinition[] = [
  { id: 'breather', label: 'Catch Your Breath', description: 'Sit down for a while and recover a little energy.', minutes: 60, cost: 0, energyGain: 18, healthGain: 0, happinessGain: 0 },
  { id: 'bench-sleep', label: 'Sleep Rough', description: 'Get some sleep wherever you can. Free, but not exactly comfortable.', minutes: 480, cost: 0, energyGain: 64, healthGain: 1, happinessGain: -2, requires: s => s.housing === 'Homeless', requirementText: 'Only while homeless' },
  { id: 'sleep', label: 'Get a Full Night’s Sleep', description: 'Recover properly in your current housing.', minutes: 480, cost: 0, energyGain: 72, healthGain: 4, happinessGain: 2, requires: s => s.housing !== 'Homeless', requirementText: 'Requires housing' },
  { id: 'snack', label: 'Cheap Meal', description: 'Something filling enough to keep you going.', minutes: 30, cost: 4.5, energyGain: 14, healthGain: 2, happinessGain: 1 },
  { id: 'meal', label: 'Hot Meal', description: 'A proper meal restores more than just energy.', minutes: 60, cost: 12, energyGain: 24, healthGain: 6, happinessGain: 4 }
];

export const housing: HousingDefinition[] = [
  { id: 'Shelter', label: 'Shelter Bed', cost: 18, description: 'A safer place to sleep tonight. Improves recovery.', energyBonus: 4, healthBonus: 1, requires: s => s.housing === 'Homeless', requirementText: 'Available while homeless' },
  { id: 'Rented Room', label: 'Rented Room', cost: 350, description: 'Your own room. Better sleep and a major step toward stability.', energyBonus: 8, healthBonus: 2, requires: s => s.housing === 'Homeless' || s.housing === 'Shelter', requirementText: 'Requires a lower housing tier' },
  { id: 'Apartment', label: 'Small Apartment', cost: 1200, description: 'A real place of your own with the best recovery in this build.', energyBonus: 12, healthBonus: 3, requires: s => s.housing === 'Rented Room', requirementText: 'Requires a rented room' }
];

export const education: EducationDefinition[] = [
  { id: 'GED', label: 'Earn Your GED', cost: 150, days: 30, description: 'Unlocks better jobs and future education.', requires: s => s.education === 'None', requirementText: 'No prior education required' },
  { id: 'Trade Certificate', label: 'Trade Certificate', cost: 900, days: 120, description: 'Unlocks skilled trade work with much better pay.', requires: s => s.education === 'GED', requirementText: 'Requires a GED' }
];
