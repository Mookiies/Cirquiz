import { Stack } from 'expo-router';
import { useEffect } from 'react';
import '../src/i18n';

export default function RootLayout() {
  useEffect(() => {
    // i18n is initialized via import side-effect above
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
