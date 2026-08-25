# Bottom Dollar

A text-first life and money progression game by **MT64 Labs**.

**Premise:** Start with nothing. Build stability, wealth, and eventually a life worth remembering.

Bottom Dollar is designed around short readable actions, meaningful resource tradeoffs, and long progression without needing heavy animation. The player starts homeless with $0 and works upward through survival, employment, education, housing, investing, and business ownership.

## Tech

- Expo SDK 54
- React Native
- TypeScript
- AsyncStorage for local saves
- Expo Haptics for tactile feedback

## Run locally

```bash
git clone https://github.com/MotherTheresa64/bottom-dollar.git
cd bottom-dollar
npm install
npm start
```

Scan the QR code with Expo Go on Android.

## Current build — 0.3

- Persistent local saves with migration-friendly state normalization
- Cash, savings, investments, debt, and full net-worth tracking
- Energy, health, and happiness systems
- Recovery through rest, sleep, food, and days off
- Game-time progression and aging
- Housing progression with ongoing living costs
- Education and skilled-career progression
- Multiple jobs with experience-based unlocks
- Gear and mobility unlocks including phone, bicycle, laptop, and car
- Savings interest and long-term investment growth
- Passive-income businesses with multiple upgrade levels
- Random positive and negative life events
- Automatic achievement tracking
- Dynamic wealth milestones
- Haptic feedback
- Portrait-first dark UI
- Data-driven content architecture

## Product principles

1. Time matters. Better choices trade money, energy, and years.
2. Progress should stay readable and satisfying with minimal animation.
3. The player should always have a next rung of the ladder to chase.
4. Wealth should eventually shift from active labor to assets and businesses.
5. Monetization must preserve the free game's fun. Rewarded ads and optional premium upgrades are preferred over forced interruption.
6. New jobs, businesses, events, achievements, and endings should be inexpensive to add after launch.

## Next production milestones

- Playtest and rebalance early-game pacing
- Add end-of-life / retirement outcomes and replayable legacy runs
- Add more random events and career branches
- Add offline passive-income handling
- Add sound settings, reset/new-life controls, and accessibility polish
- Add analytics hooks before external testing
- Add Play billing and rewarded ads only after retention is proven
- Prepare store assets, privacy policy, testing track, and Android App Bundle
