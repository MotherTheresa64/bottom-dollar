# Bottom Dollar

A text-first life and money progression game by **MT64 Labs**.

**Premise:** Start with nothing. Live one life. See where you end up.

The first playable loop begins homeless with $0, then unlocks better money-making actions, possessions, and jobs. The longer-term product direction adds education, housing, careers, businesses, investments, random events, endings, achievements, and replayable lives.

## Tech

- Expo SDK 57
- React Native 0.86
- TypeScript
- AsyncStorage for local saves
- Expo Haptics for tactile feedback

## Run locally

Requires Node.js 22.13+ for Expo SDK 57.

```bash
git clone https://github.com/MotherTheresa64/bottom-dollar.git
cd bottom-dollar
npm install
npm start
```

Then scan the Expo QR code with Expo Go on Android or press `a` to launch an Android emulator.

## Current prototype

- Persistent local save
- Cash, debt, net worth, age, energy, health, happiness
- Time-consuming actions instead of pure infinite tapping
- Begging → cans → odd jobs progression
- Purchases that unlock new opportunities
- Starter job progression
- Haptic feedback
- Portrait-first dark UI
- Data-driven content architecture

## Product principles

1. A life should have an ending; infinite numbers are not the only goal.
2. Time is a resource. Better choices should trade money, energy, and years.
3. Progression should remain readable and satisfying with minimal animation.
4. Monetization should preserve the free game's fun; rewarded ads and optional premium upgrades are preferred over forced interruption.
5. Add content through data wherever possible so careers, events, items, and endings can grow quickly after launch.

## Next milestones

- Improve the survival/stability loop and economic balance
- Add sleep/food/housing costs
- Add education and branching careers
- Add random events and consequences
- Add milestone/end-state tracking
- Add analytics hooks before external testing
- Add Play billing / rewarded ads only after retention is proven
