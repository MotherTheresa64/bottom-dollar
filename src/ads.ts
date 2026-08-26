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

const rewardedAdUnitId = __DEV__ ? TestIds.REWARDED : productionRewardedId;

let initialized = false;
let rewarded: RewardedAd | null = null;
let loaded = false;
let loading = false;

async function ensureInitialized() {
  if (initialized) return;
  await mobileAds().initialize();
  initialized = true;
}

function createRewarded() {
  rewarded = RewardedAd.createForAdRequest(rewardedAdUnitId, {
    requestNonPersonalizedAdsOnly: false
  });
  loaded = false;
  loading = false;
  return rewarded;
}

export async function preloadRewardedAd() {
  await ensureInitialized();
  const ad = rewarded ?? createRewarded();
  if (loaded || loading) return;

  loading = true;

  const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    loaded = true;
    loading = false;
    unsubscribeLoaded();
    unsubscribeError();
  });

  const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
    loaded = false;
    loading = false;
    unsubscribeLoaded();
    unsubscribeError();
  });

  ad.load();
}

export function isRewardedAdReady() {
  return loaded;
}

export async function showRewardedAd(): Promise<boolean> {
  await ensureInitialized();
  const ad = rewarded ?? createRewarded();

  if (!loaded) {
    await preloadRewardedAd();
    return false;
  }

  return new Promise(resolve => {
    let earned = false;

    const unsubscribeEarned = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        earned = true;
      }
    );

    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      cleanup();
      rewarded = null;
      loaded = false;
      preloadRewardedAd().catch(() => undefined);
      resolve(earned);
    });

    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
      cleanup();
      rewarded = null;
      loaded = false;
      preloadRewardedAd().catch(() => undefined);
      resolve(false);
    });

    const cleanup = () => {
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
    };

    loaded = false;
    ad.show().catch(() => {
      cleanup();
      rewarded = null;
      loaded = false;
      resolve(false);
    });
  });
}

export const rewardedAdUsesTestInventory = __DEV__;
