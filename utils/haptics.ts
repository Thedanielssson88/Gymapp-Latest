
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { UserProfile } from '../types';

const isAndroid = Capacitor.getPlatform() === 'android';

// På Android är 'Light' ofta för svagt för att märkas. Vi kör 'Medium' som default för bättre feedback.
const DEFAULT_IMPACT = isAndroid ? ImpactStyle.Medium : ImpactStyle.Light;

export const haptics = {
  impact: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (e) {
      // Ignore
    }
  },
  selection: async () => {
    try {
      await Haptics.selectionChanged();
    } catch (e) {
      // Ignore
    }
  },
};

export const triggerHaptic = {
  light: async () => {
    try {
      await Haptics.impact({ style: DEFAULT_IMPACT });
    } catch (e) {
      // Ignore
    }
  },
  
  tick: async (user: UserProfile | null) => {
    if (user?.settings?.vibrateButtons === false) return;
    try {
      await Haptics.impact({ style: DEFAULT_IMPACT });
    } catch (e) {
      // Ignore
    }
  },

  success: async (user: UserProfile | null) => {
    if (user?.settings?.vibrateButtons === false) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (e) {
      // Ignore
    }
  },

  double: async (user: UserProfile | null) => {
    if (user?.settings?.vibrateButtons === false) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
      setTimeout(async () => {
        await Haptics.notification({ type: NotificationType.Success });
      }, 150);
    } catch (e) {
      // Ignore
    }
  },
};
