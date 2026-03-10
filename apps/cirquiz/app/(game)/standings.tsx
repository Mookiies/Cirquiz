import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Difficulty } from '../../src/providers/types';
import { AvatarIcon } from '../../src/components/AvatarIcon';
import { Button } from '../../src/components/Button';
import { CategorySelector } from '../../src/components/CategorySelector';
import { DifficultySelector } from '../../src/components/DifficultySelector';
import { useCategoryLoader } from '../../src/hooks/useCategoryLoader';
import { useGameStore } from '../../src/state/gameStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, fontWeight, radius } from '../../src/theme';

export default function StandingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const ordinal = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    let rule: string;
    if (mod100 >= 11 && mod100 <= 13) rule = 'other';
    else if (mod10 === 1) rule = 'one';
    else if (mod10 === 2) rule = 'two';
    else if (mod10 === 3) rule = 'few';
    else rule = 'other';
    return t(`game.standings.ordinal_ordinal_${rule}`, { count: n });
  };
  const game = useGameStore((s) => s.game);
  const quitGame = useGameStore((s) => s.quitGame);
  const startNextRound = useGameStore((s) => s.startNextRound);
  const isLoading = useGameStore((s) => s.isLoading);
  const updateRoundConfig = useGameStore((s) => s.updateRoundConfig);

  const [showSettings, setShowSettings] = useState(false);
  const [localCategory, setLocalCategory] = useState<string | undefined>(
    game?.category ?? undefined
  );
  const [localDifficulty, setLocalDifficulty] = useState<Difficulty | undefined>(
    game?.difficulty ?? undefined
  );
  const { categories, loading: loadingCategories, load: loadCategories } = useCategoryLoader();

  if (!game) return null;

  const handleDifficultyChange = (d: Difficulty | undefined) => {
    setLocalDifficulty(d);
    updateRoundConfig({ difficulty: d ?? null, mode: d || localCategory ? 'configured' : 'quick' });
  };

  const handleCategoryChange = (c: string | undefined) => {
    setLocalCategory(c);
    updateRoundConfig({ category: c ?? null, mode: c || localDifficulty ? 'configured' : 'quick' });
  };

  const sorted = [...game.players].sort((a, b) => b.cumulativeScore - a.cumulativeScore);

  // Rounds won: player with the highest score in a round wins it (ties count for all tied players)
  const roundsWon = Object.fromEntries(game.players.map((p) => [p.id, 0]));
  game.rounds.forEach((round) => {
    const scoreByPlayer = Object.fromEntries(
      game.players.map((p) => [
        p.id,
        round.turns.filter((t) => t.playerId === p.id && t.isCorrect).length,
      ])
    );
    const max = Math.max(...Object.values(scoreByPlayer));
    if (max > 0) {
      Object.entries(scoreByPlayer).forEach(([id, score]) => {
        if (score === max) roundsWon[id]++;
      });
    }
  });

  const handleEndSession = () => {
    quitGame();
    router.replace('/');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
    >
      <Text style={styles.title}>{t('game.standings.title')}</Text>

      {sorted.map((player, index) => {
        const place = index + 1;
        const roundScores = game.rounds.map(
          (round) => round.turns.filter((t) => t.playerId === player.id && t.isCorrect).length
        );
        return (
          <View key={player.id} style={[styles.row, { borderLeftColor: player.color }]}>
            <View style={styles.topRow}>
              <AvatarIcon avatarKey={player.avatar} size={40} style={styles.rowAvatar} />
              <Text style={styles.place} maxFontSizeMultiplier={1.5}>
                {ordinal(place)}
              </Text>
              <Text
                style={styles.playerName}
                numberOfLines={1}
                maxFontSizeMultiplier={1.5}
                ellipsizeMode="tail"
              >
                {player.name}
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue} maxFontSizeMultiplier={1}>
                    {player.cumulativeScore}
                  </Text>
                  <Text style={styles.statLabel} maxFontSizeMultiplier={1}>
                    {t('game.standings.correct')}
                  </Text>
                </View>
                {game.rounds.length > 1 && (
                  <View style={styles.stat}>
                    <Text style={styles.statValue} maxFontSizeMultiplier={1}>
                      {roundsWon[player.id]}
                    </Text>
                    <Text style={styles.statLabel} maxFontSizeMultiplier={1}>
                      {t('game.standings.roundsWon')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {game.rounds.length > 1 && (
              <View style={styles.roundGrid}>
                {roundScores.map((s, i) => (
                  <View key={i} style={styles.roundCell}>
                    <Text style={styles.roundCellLabel}>
                      {t('game.standings.roundLabel', { n: i + 1 })}
                    </Text>
                    <Text style={styles.roundCellValue}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      <Button
        variant="text"
        label={showSettings ? t('game.standings.hideSettings') : t('game.standings.changeSettings')}
        onPress={async () => {
          if (!showSettings && categories.length === 0) await loadCategories();
          setShowSettings((v) => !v);
        }}
        color={colors.primary}
        style={{ alignSelf: 'center', marginTop: spacing.xl, marginBottom: spacing.xs }}
      />

      {showSettings && (
        <View style={styles.settingsPanel}>
          <Text style={styles.settingsLabel}>{t('common.difficulty')}</Text>
          <DifficultySelector
            value={localDifficulty}
            onChange={handleDifficultyChange}
            style={{ marginBottom: spacing.sm }}
          />
          <Text style={styles.settingsLabel}>{t('common.category')}</Text>
          <CategorySelector
            categories={categories}
            value={localCategory}
            onChange={handleCategoryChange}
            loading={loadingCategories}
          />
        </View>
      )}

      <Button
        variant="raised"
        label={t('game.standings.playAnotherRound')}
        color={colors.success}
        loading={isLoading}
        onPress={startNextRound}
        haptic="strong"
        style={styles.roundButton}
      />

      <Button
        variant="text"
        label={t('game.standings.endSession')}
        color={colors.error}
        onPress={handleEndSession}
        haptic="light"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'column',
    padding: spacing.lg,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  rowAvatar: {
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  place: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    paddingRight: spacing.xs,
    color: colors.textSecondary,
  },
  playerName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flex: 1,
    minWidth: 0,
  },
  statsRow: { flexDirection: 'row', gap: spacing.xl, flexShrink: 0 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primary },
  statLabel: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: spacing.xs },
  roundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  roundCell: { alignItems: 'center', width: 40 },
  roundCellLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs },
  roundCellValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  roundButton: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  settingsPanel: { marginBottom: spacing.xs },
  settingsLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
});
