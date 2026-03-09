import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { CategorySelector } from '../src/components/CategorySelector';
import { ColorSwatch } from '../src/components/ColorSwatch';
import { DifficultySelector } from '../src/components/DifficultySelector';
import { IconButton } from '../src/components/IconButton';
import { TextButton } from '../src/components/TextButton';
import { OpenTriviaDbProvider } from '../src/providers/opentdb/OpenTriviaDbProvider';
import { Difficulty } from '../src/providers/types';
import { useGameStore } from '../src/state/gameStore';
import { colors, spacing, fontSize, fontWeight, radius } from '../src/theme';

interface PlayerEntry {
  name: string;
  color: string;
}

function firstAvailableColor(used: string[]): string {
  return colors.playerPalette.find((c) => !used.includes(c)) ?? colors.playerPalette[0];
}

export default function SetupScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const startGame = useGameStore((s) => s.startGame);
  const isLoading = useGameStore((s) => s.isLoading);

  const [players, setPlayers] = useState<PlayerEntry[]>([
    { name: `${t('setup.playerName')} 1`, color: colors.playerPalette[0] },
    { name: `${t('setup.playerName')} 2`, color: colors.playerPalette[1] },
  ]);
  const [questionCount, setQuestionCount] = useState('10');
  const [quickPlay, setQuickPlay] = useState(true);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(undefined);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [nameErrors, setNameErrors] = useState<Record<number, string>>({});

  const usedColors = players.map((p) => p.color);

  const addPlayer = () => {
    if (players.length >= 6) return;
    const color = firstAvailableColor(usedColors);
    const name = `${t('setup.playerName')} ${players.length + 1}`;
    setPlayers((prev) => [...prev, { name, color }]);
  };

  const removePlayer = (index: number) => {
    setPlayers((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePlayerName = (index: number, name: string) => {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, name } : p)));
  };

  const updatePlayerColor = (index: number, color: string) => {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, color } : p)));
  };

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const p = new OpenTriviaDbProvider();
      const cats = await p.fetchCategories();
      setCategories(cats);
    } catch (e) {
      console.warn('Failed to load categories:', e);
    } finally {
      setLoadingCategories(false);
    }
  };

  const toggleQuickPlay = async () => {
    const next = !quickPlay;
    setQuickPlay(next);
    if (!next && categories.length === 0) {
      await loadCategories();
    }
  };

  const validateNames = (): boolean => {
    const errors: Record<number, string> = {};
    const seen = new Set<string>();
    players.forEach((p, i) => {
      const name = p.name.trim();
      if (!name) {
        errors[i] = t('setup.nameEmpty');
      } else if (seen.has(name.toLowerCase())) {
        errors[i] = t('setup.nameUnique');
      } else {
        seen.add(name.toLowerCase());
      }
    });
    setNameErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStart = () => {
    const count = parseInt(questionCount, 10);
    if (isNaN(count) || count < 1) return;
    if (players.length === 0) return;
    if (!validateNames()) return;

    startGame({
      players: players.map((p) => ({ name: p.name || 'Player', color: p.color })),
      questionCount: count,
      category: quickPlay ? undefined : category,
      difficulty: quickPlay ? undefined : difficulty,
      mode: quickPlay ? 'quick' : 'configured',
    });
  };

  const canStart = players.length > 0 && !isLoading;

  return (
    <KeyboardAvoidingView style={styles.keyboardAvoid} behavior="padding">
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('setup.title')}</Text>

        <Text style={styles.sectionLabel}>{t('setup.questionCount')}</Text>
        <TextInput
          style={styles.input}
          value={questionCount}
          onChangeText={setQuestionCount}
          keyboardType="number-pad"
          maxLength={2}
        />

        <Text style={styles.sectionLabel}>{t('setup.players')}</Text>
        {players.map((player, index) => (
          <View key={index} style={styles.playerRow}>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.playerInput,
                  nameErrors[index] ? styles.inputError : null,
                ]}
                selectTextOnFocus
                placeholder={`${t('setup.playerName')} ${index + 1}`}
                value={player.name}
                onChangeText={(text) => {
                  updatePlayerName(index, text);
                  if (nameErrors[index])
                    setNameErrors((prev) => {
                      const n = { ...prev };
                      delete n[index];
                      return n;
                    });
                }}
                maxLength={20}
              />
              {players.length > 1 && <IconButton icon="✕" onPress={() => removePlayer(index)} />}
            </View>
            {nameErrors[index] ? <Text style={styles.errorText}>{nameErrors[index]}</Text> : null}
            <View style={styles.colorRow}>
              {colors.playerPalette.map((color) => {
                const taken = usedColors.includes(color) && players[index].color !== color;
                return (
                  <ColorSwatch
                    key={color}
                    color={color}
                    selected={player.color === color}
                    disabled={taken}
                    onPress={() => updatePlayerColor(index, color)}
                  />
                );
              })}
            </View>
          </View>
        ))}

        {players.length < 6 && (
          <TextButton
            label={`+ ${t('setup.addPlayer')}`}
            onPress={addPlayer}
            color={colors.primary}
          />
        )}

        <View style={styles.toggleRow}>
          <Button
            outlined
            selected={quickPlay}
            color={colors.primary}
            label={t('setup.quickPlay')}
            onPress={() => setQuickPlay(true)}
            style={{ flex: 1 }}
          />
          <Button
            outlined
            selected={!quickPlay}
            color={colors.primary}
            label={t('setup.chooseCategories')}
            onPress={toggleQuickPlay}
            style={{ flex: 1 }}
          />
        </View>

        {!quickPlay && (
          <View>
            <Text style={styles.sectionLabel}>{t('common.difficulty')}</Text>
            <DifficultySelector value={difficulty} onChange={setDifficulty} />

            <Text style={styles.sectionLabel}>{t('common.category')}</Text>
            <CategorySelector
              categories={categories}
              value={category}
              onChange={setCategory}
              loading={loadingCategories}
            />
          </View>
        )}

        <Button
          label={t('setup.start')}
          color={colors.success}
          loading={isLoading}
          disabled={!canStart}
          onPress={handleStart}
          style={styles.startButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing['4xl'] },
  title: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, marginBottom: spacing.xl },
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.base,
    marginBottom: spacing.sm,
  },
  playerRow: { marginBottom: spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  playerInput: { flex: 1, marginBottom: 0 },
  colorRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing.xs, marginBottom: spacing.xs },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: fontSize.sm, marginBottom: 4 },
  toggleRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  startButton: {
    marginTop: spacing.xl,
  },
});
