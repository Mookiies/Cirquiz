const env = process.env.APP_ENV ?? 'development';
const suffixes = {
  development: { name: ' (Dev)', bundleId: '.dev' },
  staging: { name: ' (Staging)', bundleId: '.staging' },
  production: { name: '', bundleId: '' },
};
const s = suffixes[env] ?? suffixes.development;

module.exports = {
  name: `Cirquiz${s.name}`,
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
  },
  android: {
    package: `com.cirquiz.app${s.bundleId}`,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
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
  },
};
