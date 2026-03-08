import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Difficulty } from '../../src/providers/types';
import { Button } from '../../src/components/Button';
import { CategorySelector } from '../../src/components/CategorySelector';
import { DifficultySelector } from '../../src/components/DifficultySelector';
import { OpenTriviaDbProvider } from '../../src/providers/opentdb/OpenTriviaDbProvider';
import { useGameStore } from '../../src/state/gameStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  if (!game) return null;

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      setCategories(await new OpenTriviaDbProvider().fetchCategories());
    } catch {
    } finally {
      setLoadingCategories(false);
    }
  };

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
        { paddingTop: insets.top + BASE_PADDING, paddingBottom: insets.bottom + BASE_PADDING },
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
            <Text style={styles.place}>{ordinal(place)}</Text>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{player.name}</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{player.cumulativeScore}</Text>
                  <Text style={styles.statLabel}>Correct</Text>
                </View>
                {game.rounds.length > 1 && (
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{roundsWon[player.id]}</Text>
                    <Text style={styles.statLabel}>Rounds Won</Text>
                  </View>
                )}
              </View>
              {game.rounds.length > 1 && (
                <View style={styles.roundGrid}>
                  {roundScores.map((s, i) => (
                    <View key={i} style={styles.roundCell}>
                      <Text style={styles.roundCellLabel}>R{i + 1}</Text>
                      <Text style={styles.roundCellValue}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        style={styles.settingsToggle}
        onPress={async () => {
          if (!showSettings && categories.length === 0) await loadCategories();
          setShowSettings((v) => !v);
        }}
      >
        <Text style={styles.settingsToggleText}>
          {showSettings ? 'Hide Settings' : 'Change Category / Difficulty'}
        </Text>
      </TouchableOpacity>

      {showSettings && (
        <View style={styles.settingsPanel}>
          <Text style={styles.settingsLabel}>Difficulty</Text>
          <DifficultySelector
            value={localDifficulty}
            onChange={handleDifficultyChange}
            style={{ marginBottom: 8 }}
          />
          <Text style={styles.settingsLabel}>Category</Text>
          <CategorySelector
            categories={categories}
            value={localCategory}
            onChange={handleCategoryChange}
            loading={loadingCategories}
          />
        </View>
      )}

      <Button
        label={t('game.standings.playAnotherRound')}
        color="#2ECC71"
        loading={isLoading}
        onPress={startNextRound}
        style={styles.roundButton}
      />

      <Button label={t('game.standings.endSession')} color="#E74C3C" onPress={handleEndSession} />
    </ScrollView>
  );
}

const BASE_PADDING = 24;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: BASE_PADDING },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    backgroundColor: '#f8f8f8',
    marginBottom: 10,
  },
  place: { fontSize: 18, fontWeight: '700', width: 52, color: '#555', paddingTop: 1 },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 18, fontWeight: '600', color: '#222', marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 4 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#3498DB' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 1 },
  roundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  roundCell: { alignItems: 'center', width: 40 },
  roundCellLabel: { fontSize: 10, color: '#aaa', marginBottom: 1 },
  roundCellValue: { fontSize: 14, fontWeight: '600', color: '#555' },
  roundButton: {
    marginTop: 24,
    marginBottom: 12,
  },
  settingsToggle: { marginTop: 20, marginBottom: 4, alignItems: 'center' },
  settingsToggleText: { color: '#3498DB', fontSize: 15, fontWeight: '600' },
  settingsPanel: { marginBottom: 4 },
  settingsLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 12 },
});
