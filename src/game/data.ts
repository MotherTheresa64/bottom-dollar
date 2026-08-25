import {
  ActionDefinition,
  AchievementDefinition,
  BusinessDefinition,
  EducationDefinition,
  HousingDefinition,
  JobDefinition,
  PurchaseDefinition,
  RecoveryDefinition
} from './types';

export const actions: ActionDefinition[] = [
  { id: 'beg', label: 'Ask for Change', description: 'Try your luck with passersby.', minCash: 0.05, maxCash: 1.5, minutes: 30, energyCost: 2, happinessCost: 0.5 },
  { id: 'cans', label: 'Collect Cans', description: 'Search for recyclables and cash them in.', minCash: 3, maxCash: 12, minutes: 120, energyCost: 10, happinessCost: 1, requires: s => s.inventory.includes('backpack'), requirementText: 'Requires a backpack' },
  { id: 'oddjob', label: 'Take an Odd Job', description: 'Do a quick local job for cash.', minCash: 15, maxCash: 45, minutes: 180, energyCost: 18, happinessCost: 1, requires: s => s.inventory.includes('clean-clothes'), requirementText: 'Requires clean clothes' },
  { id: 'delivery', label: 'Make Deliveries', description: 'Use your bike to make local deliveries.', minCash: 24, maxCash: 58, minutes: 180, energyCost: 15, requires: s => s.inventory.includes('bike'), requirementText: 'Requires a used bicycle' },
  { id: 'freelance', label: 'Freelance Online', description: 'Use a laptop and internet access to pick up small online gigs.', minCash: 45, maxCash: 120, minutes: 240, energyCost: 16, happinessCost: 0.5, requires: s => s.inventory.includes('laptop') && s.inventory.includes('phone'), requirementText: 'Requires a phone and laptop' }
];

export const jobs: JobDefinition[] = [
  { id: 'dishwasher', title: 'Dishwasher', hourlyPay: 11, shiftHours: 8, energyCost: 35, happinessCost: 2, requires: s => s.inventory.includes('clean-clothes'), requirementText: 'Requires clean clothes' },
  { id: 'retail', title: 'Retail Associate', hourlyPay: 14, shiftHours: 8, energyCost: 30, happinessCost: 2, requires: s => s.inventory.includes('clean-clothes'), requirementText: 'Requires clean clothes' },
  { id: 'warehouse', title: 'Warehouse Associate', hourlyPay: 16, shiftHours: 8, energyCost: 42, happinessCost: 2.5, requires: s => s.inventory.includes('clean-clothes'), requirementText: 'Requires clean clothes' },
  { id: 'courier', title: 'Courier', hourlyPay: 18, shiftHours: 8, energyCost: 34, happinessCost: 1.5, requires: s => s.inventory.includes('bike') && s.inventory.includes('phone'), requirementText: 'Requires a bicycle and phone' },
  { id: 'maintenance', title: 'Maintenance Tech', hourlyPay: 20, shiftHours: 8, energyCost: 36, happinessCost: 1.5, requires: s => s.education === 'GED' || s.education === 'Trade Certificate', requirementText: 'Requires a GED' },
  { id: 'support', title: 'Remote Support Rep', hourlyPay: 23, shiftHours: 8, energyCost: 24, happinessCost: 1.5, requires: s => s.education !== 'None' && s.inventory.includes('laptop') && s.housing !== 'Homeless' && s.housing !== 'Shelter', requirementText: 'Requires GED, laptop, and stable housing' },
  { id: 'apprentice', title: 'Electrical Apprentice', hourlyPay: 22, shiftHours: 8, energyCost: 38, happinessCost: 1, requires: s => s.education === 'Trade Certificate', requirementText: 'Requires a trade certificate' },
  { id: 'electrician', title: 'Licensed Electrician', hourlyPay: 34, shiftHours: 8, energyCost: 34, happinessCost: 0.5, requires: s => s.education === 'Trade Certificate' && (s.stats.shifts ?? 0) >= 25, requirementText: 'Requires trade certificate and 25 total shifts' },
  { id: 'supervisor', title: 'Operations Supervisor', hourlyPay: 31, shiftHours: 8, energyCost: 27, happinessCost: 1, requires: s => s.education !== 'None' && (s.stats.shifts ?? 0) >= 40, requirementText: 'Requires GED and 40 total shifts' }
];

export const purchases: PurchaseDefinition[] = [
  { id: 'backpack', label: 'Used Backpack', cost: 8, description: 'Unlocks collecting cans.' },
  { id: 'clean-clothes', label: 'Clean Clothes', cost: 25, description: 'Unlocks entry-level jobs.' },
  { id: 'phone', label: 'Prepaid Phone', cost: 60, description: 'Unlocks more jobs, businesses, and online opportunities.' },
  { id: 'bike', label: 'Used Bicycle', cost: 110, description: 'Unlocks delivery work and better mobility.' },
  { id: 'laptop', label: 'Used Laptop', cost: 650, description: 'Unlocks remote work, freelancing, and digital businesses.' },
  { id: 'car', label: 'Used Car', cost: 4200, description: 'A major mobility upgrade and requirement for larger businesses.' }
];

export const recovery: RecoveryDefinition[] = [
  { id: 'breather', label: 'Catch Your Breath', description: 'Sit down for a while and recover a little energy.', minutes: 60, cost: 0, energyGain: 18, healthGain: 0, happinessGain: 0 },
  { id: 'bench-sleep', label: 'Sleep Rough', description: 'Get some sleep wherever you can. Free, but uncomfortable.', minutes: 480, cost: 0, energyGain: 64, healthGain: 1, happinessGain: -2, requires: s => s.housing === 'Homeless', requirementText: 'Only while homeless' },
  { id: 'sleep', label: 'Get a Full Night’s Sleep', description: 'Recover properly in your current housing.', minutes: 480, cost: 0, energyGain: 72, healthGain: 4, happinessGain: 2, requires: s => s.housing !== 'Homeless', requirementText: 'Requires housing' },
  { id: 'snack', label: 'Cheap Meal', description: 'Something filling enough to keep you going.', minutes: 30, cost: 4.5, energyGain: 14, healthGain: 2, happinessGain: 1 },
  { id: 'meal', label: 'Hot Meal', description: 'A proper meal restores more than just energy.', minutes: 60, cost: 12, energyGain: 24, healthGain: 6, happinessGain: 4 },
  { id: 'day-off', label: 'Take a Day Off', description: 'Spend a quiet day recovering mentally and physically.', minutes: 1440, cost: 18, energyGain: 40, healthGain: 8, happinessGain: 12, requires: s => s.housing !== 'Homeless', requirementText: 'Requires housing' }
];

export const housing: HousingDefinition[] = [
  { id: 'Shelter', label: 'Shelter Bed', cost: 18, dailyCost: 0, description: 'A safer place to sleep tonight. Improves recovery.', energyBonus: 4, healthBonus: 1, requires: s => s.housing === 'Homeless', requirementText: 'Available while homeless' },
  { id: 'Rented Room', label: 'Rented Room', cost: 350, dailyCost: 12, description: 'Your own room. Better sleep and a major step toward stability.', energyBonus: 8, healthBonus: 2, requires: s => s.housing === 'Homeless' || s.housing === 'Shelter', requirementText: 'Requires a lower housing tier' },
  { id: 'Apartment', label: 'Small Apartment', cost: 1200, dailyCost: 40, description: 'A real place of your own. Expensive, but stable and comfortable.', energyBonus: 12, healthBonus: 3, requires: s => s.housing === 'Rented Room', requirementText: 'Requires a rented room' },
  { id: 'House', label: 'Starter House', cost: 22000, dailyCost: 24, description: 'A modest home with lower ongoing costs than renting an apartment.', energyBonus: 16, healthBonus: 4, requires: s => s.housing === 'Apartment' && s.inventory.includes('car'), requirementText: 'Requires an apartment and a car' }
];

export const education: EducationDefinition[] = [
  { id: 'GED', label: 'Earn Your GED', cost: 150, days: 30, description: 'Unlocks better jobs and future education.', requires: s => s.education === 'None', requirementText: 'No prior education required' },
  { id: 'Trade Certificate', label: 'Trade Certificate', cost: 900, days: 120, description: 'Unlocks skilled trade work with much better pay.', requires: s => s.education === 'GED', requirementText: 'Requires a GED' }
];

export const businesses: BusinessDefinition[] = [
  { id: 'lawn', label: 'Lawn Care Hustle', description: 'A tiny local service business you can grow one customer at a time.', baseCost: 750, dailyIncome: 24, maxLevel: 5, requires: s => s.inventory.includes('phone') && s.inventory.includes('bike'), requirementText: 'Requires a phone and bicycle' },
  { id: 'cleaning', label: 'Cleaning Company', description: 'Hire help and turn odd jobs into recurring contracts.', baseCost: 3500, dailyIncome: 110, maxLevel: 5, requires: s => s.inventory.includes('phone') && s.housing !== 'Homeless' && s.housing !== 'Shelter', requirementText: 'Requires phone and stable housing' },
  { id: 'online', label: 'Online Store', description: 'Build a small digital storefront that earns while you are away.', baseCost: 6000, dailyIncome: 190, maxLevel: 5, requires: s => s.inventory.includes('laptop') && s.inventory.includes('phone'), requirementText: 'Requires a laptop and phone' },
  { id: 'contracting', label: 'Electrical Contracting', description: 'Turn your trade experience into a real company.', baseCost: 18000, dailyIncome: 620, maxLevel: 5, requires: s => s.education === 'Trade Certificate' && (s.stats.shifts ?? 0) >= 35 && s.inventory.includes('car'), requirementText: 'Requires trade certificate, 35 shifts, and a car' }
];

export const achievements: AchievementDefinition[] = [
  { id: 'first-dollar', label: 'First Dollar', description: 'Earn your first dollar.', test: s => (s.stats.earned ?? 0) >= 1 },
  { id: 'off-street', label: 'Off the Street', description: 'Secure any form of housing.', test: s => s.housing !== 'Homeless' },
  { id: 'real-job', label: 'Clocked In', description: 'Work your first proper shift.', test: s => (s.stats.shifts ?? 0) >= 1 },
  { id: 'one-k', label: 'Four Digits', description: 'Reach $1,000 net worth.', test: s => (s.cash + s.savings + s.investments - s.debt) >= 1000 },
  { id: 'ten-k', label: 'Five Digits', description: 'Reach $10,000 net worth.', test: s => (s.cash + s.savings + s.investments - s.debt) >= 10000 },
  { id: 'business-owner', label: 'Owner, Not Employee', description: 'Start your first business.', test: s => Object.values(s.businesses).some(level => level > 0) },
  { id: 'investor', label: 'Money Working for You', description: 'Build at least $1,000 in investments.', test: s => s.investments >= 1000 },
  { id: 'hundred-k', label: 'Six Digits', description: 'Reach $100,000 net worth.', test: s => (s.cash + s.savings + s.investments - s.debt) >= 100000 }
];
