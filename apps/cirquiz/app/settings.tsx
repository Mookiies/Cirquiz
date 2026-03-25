import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientScreen } from '../src/components/GradientScreen';
import { IconButton } from '../src/components/IconButton';
import { SelectableRow } from '../src/components/SelectableRow';
import { useSettingsStore } from '../src/state/settingsStore';
import { colors, fontSize, fontWeight, spacing } from '../src/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const questionSource = useSettingsStore((s) => s.questionSource);
  const setQuestionSource = useSettingsStore((s) => s.setQuestionSource);

  return (
    <GradientScreen>
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <IconButton icon="arrow-back" onPress={() => router.back()} color={colors.text} />
          <Text style={styles.headerTitle}>{t('settings.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionLabel}>{t('settings.questionSource')}</Text>
          <SelectableRow
            label={t('settings.otdb')}
            active={questionSource === 'otdb'}
            onPress={() => setQuestionSource('otdb')}
          />
          <SelectableRow
            label={t('settings.theTriviaApi')}
            active={questionSource === 'the-trivia-api'}
            onPress={() => setQuestionSource('the-trivia-api')}
          />
          <SelectableRow
            label={t('settings.local')}
            active={questionSource === 'local'}
            onPress={() => setQuestionSource('local')}
          />
        </View>
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerSpacer: { width: 44 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
});
