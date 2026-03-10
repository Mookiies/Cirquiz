import { ConfigContext, ExpoConfig } from 'expo/config';

const env = process.env.APP_ENV ?? 'development';
const suffixes = {
  development: { name: ' (Dev)', bundleId: '.dev' },
  preview: { name: ' (preview)', bundleId: '.preview' },
  production: { name: '', bundleId: '' },
};
const s = suffixes[env as keyof typeof suffixes] ?? suffixes.development;

export default ({ config }: ConfigContext): ExpoConfig => ({
  name: `Circle Quiz${s.name}`,
  slug: 'cirquiz',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'cirquiz',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: `com.cirquiz.app${s.bundleId}`,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: `com.cirquiz.app${s.bundleId}`,
    adaptiveIcon: {
      backgroundColor: '#EBF5FB',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-router', 'expo-localization'],
  extra: {
    appEnv: env,
    eas: {
      projectId: 'a2892fd8-8cdd-4acd-b703-3c8e0be93327',
    },
  },
});
