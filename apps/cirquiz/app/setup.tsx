import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvatarIcon } from '../src/components/AvatarIcon';
import { Button } from '../src/components/Button';
import { CategorySelector } from '../src/components/CategorySelector';
import { DifficultySelector } from '../src/components/DifficultySelector';
import { IconButton } from '../src/components/IconButton';
import { TextButton } from '../src/components/TextButton';
import { AVATAR_LIST, AvatarKey } from '../src/avatars';
import { OpenTriviaDbProvider } from '../src/providers/opentdb/OpenTriviaDbProvider';
import { Difficulty } from '../src/providers/types';
import { useGameStore } from '../src/state/gameStore';
import { colors, spacing, fontSize, fontWeight, radius } from '../src/theme';

interface PlayerEntry {
  name: string;
  avatar: AvatarKey;
  nameCustomized: boolean;
}

function firstAvailableAvatar(used: AvatarKey[]): AvatarKey {
  return AVATAR_LIST.find((a) => !used.includes(a.key))?.key ?? AVATAR_LIST[0].key;
}

export default function SetupScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const startGame = useGameStore((s) => s.startGame);
  const isLoading = useGameStore((s) => s.isLoading);

  const avatarName = (key: AvatarKey) => t(`setup.avatarName.${key}`);

  const [players, setPlayers] = useState<PlayerEntry[]>([
    { name: avatarName(AVATAR_LIST[0].key), avatar: AVATAR_LIST[0].key, nameCustomized: false },
    { name: avatarName(AVATAR_LIST[1].key), avatar: AVATAR_LIST[1].key, nameCustomized: false },
  ]);
  const [questionCount, setQuestionCount] = useState('10');
  const [quickPlay, setQuickPlay] = useState(true);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(undefined);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [nameErrors, setNameErrors] = useState<Record<number, string>>({});
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const usedAvatars = players.map((p) => p.avatar);

  const addPlayer = () => {
    if (players.length >= AVATAR_LIST.length) return;
    const avatar = firstAvailableAvatar(usedAvatars);
    setPlayers((prev) => [...prev, { name: avatarName(avatar), avatar, nameCustomized: false }]);
  };

  const removePlayer = (index: number) => {
    setPlayers((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePlayerName = (index: number, name: string) => {
    setPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, name, nameCustomized: true } : p))
    );
  };

  const updatePlayerAvatar = (index: number, avatar: AvatarKey) => {
    setPlayers((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const name = p.nameCustomized ? p.name : avatarName(avatar);
        return { ...p, avatar, name };
      })
    );
    setPickerIndex(null);
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
      players: players.map((p) => ({ name: p.name || 'Player', avatar: p.avatar })),
      questionCount: count,
      category: quickPlay ? undefined : category,
      difficulty: quickPlay ? undefined : difficulty,
      mode: quickPlay ? 'quick' : 'configured',
    });
  };

  const canStart = players.length > 0 && !isLoading;

  const pickerPlayer = pickerIndex !== null ? players[pickerIndex] : null;

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
              <Pressable onPress={() => setPickerIndex(index)} style={styles.avatarButton}>
                <AvatarIcon avatarKey={player.avatar} size={48} />
              </Pressable>
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
          </View>
        ))}

        {players.length < AVATAR_LIST.length && (
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

      <Modal
        visible={pickerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerIndex(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerIndex(null)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.avatarGrid}>
              {AVATAR_LIST.map((avatarDef) => {
                const taken =
                  usedAvatars.includes(avatarDef.key) && pickerPlayer?.avatar !== avatarDef.key;
                const selected = pickerPlayer?.avatar === avatarDef.key;
                return (
                  <Pressable
                    key={avatarDef.key}
                    onPress={() => {
                      if (!taken && pickerIndex !== null) {
                        updatePlayerAvatar(pickerIndex, avatarDef.key);
                      }
                    }}
                    style={[
                      styles.avatarCell,
                      selected && {
                        shadowColor: avatarDef.color,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 1,
                        shadowRadius: 8,
                        elevation: 8,
                      },
                      taken && styles.avatarCellDisabled,
                    ]}
                    disabled={taken}
                  >
                    <AvatarIcon
                      avatarKey={avatarDef.key}
                      size={64}
                      style={taken ? styles.avatarIconDisabled : undefined}
                    />
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  playerInput: { flex: 1, marginBottom: 0 },
  avatarButton: { flexShrink: 0 },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: fontSize.sm, marginBottom: 4, marginTop: spacing.xs },
  toggleRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  startButton: {
    marginTop: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 64 * 5 + spacing.sm * 4,
    gap: spacing.sm,
  },
  avatarCell: {
    borderRadius: radius.lg,
  },
  avatarCellDisabled: {
    opacity: 0.3,
  },
  avatarIconDisabled: {},
});
