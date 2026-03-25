import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorBoundaryProps, Stack } from 'expo-router';
import { File } from 'expo-file-system';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import * as SQLite from 'expo-sqlite';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { useGameStore } from '../src/state/gameStore';
import '../src/i18n';
import { setLocalDb } from '../src/providers/providerFactory';
import { colors, spacing, fontSize, fontWeight } from '../src/theme';

// ── DB version ─────────────────────────────────────────────────────────────
// Bump this name (e.g. trivia_v2.db) whenever a new trivia.db is exported and
// copied to assets/. The old on-disk file is cleaned up automatically on the
// user's next launch. The asset filename in assets/ stays trivia.db always.
const TRIVIA_DB_NAME = 'trivia_v1.db';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const handleResetGame = async () => {
    // Layer 1: call the store action
    try {
      useGameStore.getState().quitGame();
    } catch {
      // Layer 2: directly patch store state
      try {
        useGameStore.setState({ game: null, isLoading: false });
      } catch {
        // Layer 3: wipe persisted storage so the next boot starts clean
        try {
          await AsyncStorage.removeItem('@cirquiz/active_game');
        } catch {
          // nothing left to try
        }
      }
    }
    await retry();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>{t('error.somethingWentWrong')}</Text>
      <Text style={styles.message} numberOfLines={5}>
        {error.message}
      </Text>
      <Button
        label={t('error.tryAgain')}
        onPress={retry}
        style={{ width: '100%', marginBottom: spacing.md }}
      />
      <Button
        label={t('error.resetGame')}
        color={colors.error}
        onPress={handleResetGame}
        style={{ width: '100%' }}
      />
    </View>
  );
}

function LocalDbBridge() {
  const db = useSQLiteContext();
  useEffect(() => {
    setLocalDb(db);
    cleanStaleDbFiles(TRIVIA_DB_NAME);
  }, [db]);
  return null;
}

function cleanStaleDbFiles(currentName: string): void {
  const currentVersion = parseInt(currentName.match(/\d+/)?.[0] ?? '1', 10);
  for (let v = 1; v < currentVersion; v++) {
    try {
      const f = new File(SQLite.defaultDatabaseDirectory, `trivia_v${v}.db`);
      if (f.exists) f.delete();
    } catch {
      // Non-critical: stale files left behind are harmless
    }
  }
}

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <SQLiteProvider
        databaseName={TRIVIA_DB_NAME}
        assetSource={{ assetId: require('../assets/trivia.db') }}
      >
        <LocalDbBridge />
        <Stack screenOptions={{ headerShown: false }} />
      </SQLiteProvider>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  icon: { fontSize: 56, marginBottom: spacing.lg },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
    lineHeight: 20,
    fontFamily: 'monospace',
  },
});
