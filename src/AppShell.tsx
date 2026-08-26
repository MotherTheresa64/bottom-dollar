import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import BottomDollarAppFinal from './BottomDollarAppFinal';

export default function AppShell() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const hideSystemNavigation = async () => {
      try {
        await NavigationBar.setBehaviorAsync('overlay-swipe');
        await NavigationBar.setVisibilityAsync('hidden');
      } catch {
        // Some gesture-navigation configurations ignore navigation-bar APIs.
      }
    };

    hideSystemNavigation();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') hideSystemNavigation();
    });

    return () => subscription.remove();
  }, []);

  return <BottomDollarAppFinal />;
}
