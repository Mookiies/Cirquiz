import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from '../src/components/Button';
import { CategorySelector } from '../src/components/CategorySelector';
import { DifficultySelector } from '../src/components/DifficultySelector';
import { OpenTriviaDbProvider } from '../src/providers/opentdb/OpenTriviaDbProvider';
import { Difficulty } from '../src/providers/types';
import { useGameStore } from '../src/state/gameStore';

const COLOR_PALETTE = [
  '#E74C3C',
  '#3498DB',
  '#2ECC71',
  '#F39C12',
  '#9B59B6',
  '#1ABC9C',
  '#E91E63',
  '#F1C40F',
  '#FF5722',
  '#00BCD4',
];

interface PlayerEntry {
  name: string;
  color: string;
}

function firstAvailableColor(used: string[]): string {
  return COLOR_PALETTE.find((c) => !used.includes(c)) ?? COLOR_PALETTE[0];
}

export default function SetupScreen() {
  const { t } = useTranslation();
  const startGame = useGameStore((s) => s.startGame);
  const isLoading = useGameStore((s) => s.isLoading);

  const [players, setPlayers] = useState<PlayerEntry[]>([{ name: '', color: COLOR_PALETTE[0] }]);
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
    setPlayers((prev) => [...prev, { name: '', color }]);
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
        errors[i] = 'Name cannot be empty';
      } else if (seen.has(name.toLowerCase())) {
        errors[i] = 'Name must be unique';
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New Game</Text>

      <Text style={styles.sectionLabel}>{t('setup.questionCount')}</Text>
      <TextInput
        style={styles.input}
        value={questionCount}
        onChangeText={setQuestionCount}
        keyboardType="number-pad"
        maxLength={2}
      />

      <Text style={styles.sectionLabel}>Players</Text>
      {players.map((player, index) => (
        <View key={index} style={styles.playerRow}>
          <TextInput
            style={[styles.input, styles.playerInput, nameErrors[index] ? styles.inputError : null]}
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
          {nameErrors[index] ? <Text style={styles.errorText}>{nameErrors[index]}</Text> : null}
          <View style={styles.colorRow}>
            {COLOR_PALETTE.map((color) => {
              const taken = usedColors.includes(color) && players[index].color !== color;
              return (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    player.color === color && styles.colorSelected,
                    taken && styles.colorDisabled,
                  ]}
                  onPress={() => !taken && updatePlayerColor(index, color)}
                  disabled={taken}
                />
              );
            })}
          </View>
          {players.length > 1 && (
            <TouchableOpacity onPress={() => removePlayer(index)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {players.length < 6 && (
        <TouchableOpacity style={styles.addButton} onPress={addPlayer}>
          <Text style={styles.addButtonText}>+ {t('setup.addPlayer')}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, quickPlay && styles.toggleActive]}
          onPress={() => setQuickPlay(true)}
        >
          <Text style={[styles.toggleText, quickPlay && styles.toggleTextActive]}>
            {t('setup.quickPlay')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, !quickPlay && styles.toggleActive]}
          onPress={toggleQuickPlay}
        >
          <Text style={[styles.toggleText, !quickPlay && styles.toggleTextActive]}>
            {t('setup.chooseCategories')}
          </Text>
        </TouchableOpacity>
      </View>

      {!quickPlay && (
        <View>
          <Text style={styles.sectionLabel}>Difficulty</Text>
          <DifficultySelector value={difficulty} onChange={setDifficulty} />

          <Text style={styles.sectionLabel}>Category</Text>
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
        color="#2ECC71"
        loading={isLoading}
        disabled={!canStart}
        onPress={handleStart}
        style={styles.startButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  playerRow: { marginBottom: 12 },
  playerInput: { marginBottom: 6 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  colorSelected: { borderWidth: 3, borderColor: '#000' },
  colorDisabled: { opacity: 0.3 },
  removeText: { color: '#E74C3C', fontSize: 16, marginTop: 4 },
  inputError: { borderColor: '#E74C3C' },
  errorText: { color: '#E74C3C', fontSize: 12, marginBottom: 4 },
  addButton: { marginVertical: 8 },
  addButtonText: { color: '#3498DB', fontSize: 16 },
  toggleRow: { flexDirection: 'row', marginTop: 16, marginBottom: 8, gap: 8 },
  toggleBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: '#3498DB', borderColor: '#3498DB' },
  toggleText: { color: '#555', fontSize: 14 },
  toggleTextActive: { color: '#fff' },
  startButton: {
    marginTop: 24,
  },
});
