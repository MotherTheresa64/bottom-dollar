import Constants from 'expo-constants';
import mobileAds, {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds
} from 'react-native-google-mobile-ads';

const productionRewardedId =
  (Constants.expoConfig?.extra?.admobRewardedAdUnitId as string | undefined) ??
  'ca-app-pub-2371910035366454/4232226723';

// EAS Updates are production JS bundles even when they run inside a development
// client, so __DEV__ is not a reliable way to choose test inventory here.
// Keep live ads explicitly opt-in until we're ready for Play Store release.
const useLiveAds = Constants.expoConfig?.extra?.admobUseLiveAds === true;
const rewardedAdUnitId = useLiveAds ? productionRewardedId : TestIds.REWARDED;

let initialized = false;
let rewarded: RewardedAd | null = null;
let loaded = false;
let loadPromise: Promise<boolean> | null = null;

async function ensureInitialized() {
  if (initialized) return;
  await mobileAds().initialize();
  initialized = true;
}

function createRewarded() {
  rewarded = RewardedAd.createForAdRequest(rewardedAdUnitId);
  loaded = false;
  return rewarded;
}

async function loadRewardedAd(): Promise<boolean> {
  await ensureInitialized();

  if (loaded && rewarded) return true;
  if (loadPromise) return loadPromise;

  const ad = rewarded ?? createRewarded();

  loadPromise = new Promise<boolean>(resolve => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      unsubscribeLoaded();
      unsubscribeError();
    };

    const finish = (success: boolean) => {
      if (settled) return;
      settled = true;
      loaded = success;
      if (!success) rewarded = null;
      cleanup();
      resolve(success);
    };

    const unsubscribeLoaded = ad.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => finish(true)
    );

    const unsubscribeError = ad.addAdEventListener(
      AdEventType.ERROR,
      () => finish(false)
    );

    const timeout = setTimeout(() => finish(false), 12000);
    ad.load();
  });

  const result = await loadPromise;
  loadPromise = null;
  return result;
}

export async function preloadRewardedAd() {
  await loadRewardedAd();
}

export function isRewardedAdReady() {
  return loaded;
}

export async function showRewardedAd(): Promise<boolean> {
  const isReady = await loadRewardedAd();
  if (!isReady || !rewarded) return false;

  const ad = rewarded;

  return new Promise(resolve => {
    let earned = false;
    let settled = false;

    const cleanup = () => {
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
    };

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      rewarded = null;
      loaded = false;
      preloadRewardedAd().catch(() => undefined);
      resolve(value);
    };

    const unsubscribeEarned = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        earned = true;
      }
    );

    const unsubscribeClosed = ad.addAdEventListener(
      AdEventType.CLOSED,
      () => finish(earned)
    );

    const unsubscribeError = ad.addAdEventListener(
      AdEventType.ERROR,
      () => finish(false)
    );

    loaded = false;
    ad.show().catch(() => finish(false));
  });
}

export const rewardedAdUsesTestInventory = !useLiveAds;
