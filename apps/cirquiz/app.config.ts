import { ConfigContext, ExpoConfig } from 'expo/config';

const env = process.env.APP_ENV ?? 'development';
const suffixes = {
  development: { name: ' (Dev)', bundleId: '.dev' },
  preview: { name: ' (preview)', bundleId: '.preview' },
  production: { name: '', bundleId: '' },
};
const s = suffixes[env as keyof typeof suffixes] ?? suffixes.development;

export default ({ config }: ConfigContext): ExpoConfig => ({
  name: `Circle Q${s.name}`,
  slug: 'cirquiz',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'cirquiz',
  icon: './assets/icon/adaptive-icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/icon/splash-icon-light.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: `com.cirquiz.app${s.bundleId}`,
    icon: './assets/icon/circlequiz.icon',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: `com.cirquiz.app${s.bundleId}`,
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/icon/adaptive-icon.png',
      monochromeImage: './assets/icon/adaptive-icon.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/icon/favicon.png',
  },
  plugins: ['expo-router', 'expo-localization', 'expo-sqlite'],
  extra: {
    appEnv: env,
    eas: {
      projectId: 'a2892fd8-8cdd-4acd-b703-3c8e0be93327',
    },
  },
});
