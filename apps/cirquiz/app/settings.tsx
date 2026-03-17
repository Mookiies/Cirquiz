import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientScreen } from '../src/components/GradientScreen';
import { IconButton } from '../src/components/IconButton';
import { SelectableRow } from '../src/components/SelectableRow';
import { useModelStore } from '../src/state/modelStore';
import { useSettingsStore } from '../src/state/settingsStore';
import { modelDownloadService } from '../src/services/modelDownloadService';
import { colors, fontSize, fontWeight, spacing } from '../src/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const questionSource = useSettingsStore((s) => s.questionSource);
  const setQuestionSource = useSettingsStore((s) => s.setQuestionSource);

  const modelStatus = useModelStore((s) => s.status);
  const downloadProgress = useModelStore((s) => s.downloadProgress);
  const isInitializing = useModelStore((s) => s.isInitializing);
  const initModel = useModelStore((s) => s.initModel);
  const releaseModel = useModelStore((s) => s.releaseModel);

  const handleSelectSource = async (source: typeof questionSource) => {
    if (source === questionSource) return;

    if (questionSource === 'ai-generated') {
      await releaseModel();
    }

    setQuestionSource(source);

    if (source === 'ai-generated' && modelStatus === 'available') {
      initModel();
    }
  };

  const renderModelStatus = () => {
    if (isInitializing) {
      return (
        <View style={styles.modelStatusRow}>
          <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
          <Text style={styles.modelStatusText}>{t('settings.modelStatus.initializing')}</Text>
        </View>
      );
    }

    switch (modelStatus) {
      case 'not_downloaded':
        return (
          <View style={styles.modelStatusRow}>
            <Text style={styles.modelStatusText}>{t('settings.modelStatus.notDownloaded')}</Text>
            <Pressable style={styles.actionButton} onPress={modelDownloadService.startDownload}>
              <Text style={styles.actionButtonText}>{t('settings.downloadModel')}</Text>
            </Pressable>
          </View>
        );
      case 'downloading':
        return (
          <View style={styles.modelStatusRow}>
            <Text style={styles.modelStatusText}>
              {t('settings.modelStatus.downloading', {
                percent: Math.round(downloadProgress * 100),
              })}
            </Text>
            <Pressable style={styles.actionButton} onPress={modelDownloadService.cancelDownload}>
              <Text style={styles.actionButtonText}>{t('settings.cancelDownload')}</Text>
            </Pressable>
          </View>
        );
      case 'available':
        return (
          <View style={styles.modelStatusRow}>
            <Text style={[styles.modelStatusText, styles.modelStatusAvailable]}>
              {t('settings.modelStatus.available')}
            </Text>
          </View>
        );
      case 'error':
        return (
          <View style={styles.modelStatusRow}>
            <Text style={[styles.modelStatusText, styles.modelStatusError]}>
              {t('settings.modelStatus.error')}
            </Text>
            <Pressable style={styles.actionButton} onPress={modelDownloadService.retryDownload}>
              <Text style={styles.actionButtonText}>{t('settings.retryDownload')}</Text>
            </Pressable>
          </View>
        );
    }
  };

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
            onPress={() => handleSelectSource('otdb')}
          />
          <SelectableRow
            label={t('settings.theTriviaApi')}
            active={questionSource === 'the-trivia-api'}
            onPress={() => handleSelectSource('the-trivia-api')}
          />
          <SelectableRow
            label={t('settings.aiGenerated')}
            active={questionSource === 'ai-generated'}
            onPress={() => handleSelectSource('ai-generated')}
          />
          {questionSource === 'ai-generated' && (
            <View style={styles.modelStatusContainer}>{renderModelStatus()}</View>
          )}
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
  modelStatusContainer: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modelStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  modelStatusText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  modelStatusAvailable: {
    color: colors.success,
  },
  modelStatusError: {
    color: colors.error,
  },
  actionButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primaryFaint,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  spinner: {
    marginRight: spacing.xs,
  },
});
