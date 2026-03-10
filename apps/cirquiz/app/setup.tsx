import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvatarIcon } from '../src/components/AvatarIcon';
import { BackgroundBlobs } from '../src/components/BackgroundBlobs';
import { CategorySelector } from '../src/components/CategorySelector';
import { DifficultySelector } from '../src/components/DifficultySelector';
import { IconButton } from '../src/components/IconButton';
import { ShineButton } from '../src/components/ShineButton';
import { TextButton } from '../src/components/TextButton';
import { AVATAR_LIST, type AvatarKey } from '../src/avatars';
import { OpenTriviaDbProvider } from '../src/providers';
import { type Difficulty } from '../src/providers';
import { useGameStore } from '../src/state/gameStore';
import { colors, fontSize, fontWeight, radius, spacing } from '../src/theme';

const QUESTION_COUNTS = [5, 10, 15, 20] as const;

interface PlayerEntry {
  name: string;
  avatar: AvatarKey;
  nameCustomized: boolean;
}

function firstAvailableAvatar(used: AvatarKey[]): AvatarKey {
  return AVATAR_LIST.find((a) => !used.includes(a.key))?.key ?? AVATAR_LIST[0].key;
}

interface AnimatedPlayerRowProps {
  player: PlayerEntry;
  index: number;
  delay: number;
  nameError?: string;
  canRemove: boolean;
  onAvatarPress: () => void;
  onNameChange: (text: string) => void;
  onRemove: () => void;
}

function AnimatedPlayerRow({
  player,
  index,
  delay,
  nameError,
  canRemove,
  onAvatarPress,
  onNameChange,
  onRemove,
}: AnimatedPlayerRowProps) {
  const { t } = useTranslation();
  const translateX = useSharedValue(-40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withDelay(delay, withSpring(0));
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, [delay, opacity, translateX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const borderColor = colors.playerPalette[index % 10];

  return (
    <Animated.View style={[styles.playerCard, { borderLeftColor: borderColor }, animStyle]}>
      <View style={styles.inputRow}>
        <Pressable onPress={onAvatarPress} style={styles.avatarButton}>
          <AvatarIcon avatarKey={player.avatar} size={48} />
        </Pressable>
        <TextInput
          style={[styles.input, styles.playerInput, nameError ? styles.inputError : null]}
          selectTextOnFocus
          placeholder={`${t('setup.playerName')} ${index + 1}`}
          value={player.name}
          onChangeText={onNameChange}
          maxLength={20}
        />
        {canRemove && <IconButton icon="✕" onPress={onRemove} />}
      </View>
      {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
    </Animated.View>
  );
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
  const initialPlayerCount = useRef(2);
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
    <LinearGradient style={styles.gradient} colors={['#EBF5FB', '#fff', '#f3eeff']}>
      <BackgroundBlobs />
      <View style={styles.flex}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('setup.title', 'NEW GAME')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionLabel}>{t('setup.questionCount')}</Text>
            <View style={styles.chipsRow}>
              {QUESTION_COUNTS.map((count) => (
                <Pressable
                  key={count}
                  style={[styles.chip, questionCount === String(count) && styles.chipActive]}
                  onPress={() => setQuestionCount(String(count))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      questionCount === String(count) && styles.chipTextActive,
                    ]}
                  >
                    {count}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>{t('setup.players')}</Text>
            {players.map((player, index) => (
              <AnimatedPlayerRow
                key={index}
                player={player}
                index={index}
                delay={index < initialPlayerCount.current ? index * 80 : 0}
                nameError={nameErrors[index]}
                canRemove={players.length > 1}
                onAvatarPress={() => setPickerIndex(index)}
                onNameChange={(text) => {
                  updatePlayerName(index, text);
                  if (nameErrors[index]) {
                    setNameErrors((prev) => {
                      const n = { ...prev };
                      delete n[index];
                      return n;
                    });
                  }
                }}
                onRemove={() => removePlayer(index)}
              />
            ))}

            {players.length < AVATAR_LIST.length && (
              <TextButton
                label={`+ ${t('setup.addPlayer')}`}
                onPress={addPlayer}
                color={colors.primary}
              />
            )}

            <Text style={styles.sectionLabel}>{t('setup.mode', 'Mode')}</Text>
            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeCard, quickPlay && styles.modeCardActive]}
                onPress={() => setQuickPlay(true)}
              >
                <Text style={styles.modeIcon}>⚡</Text>
                <Text style={styles.modeName}>{t('setup.quickPlay')}</Text>
                <Text style={styles.modeDesc}>
                  {t('setup.quickPlayDesc', 'Any topic, jump right in!')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeCard, !quickPlay && styles.modeCardActive]}
                onPress={toggleQuickPlay}
              >
                <Text style={styles.modeIcon}>🎯</Text>
                <Text style={styles.modeName}>{t('setup.chooseCategories')}</Text>
                <Text style={styles.modeDesc}>
                  {t('setup.chooseCategoriesDesc', 'Pick topic & difficulty')}
                </Text>
              </Pressable>
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

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Sticky CTA */}
        <View style={[styles.stickyBottom, { paddingBottom: insets.bottom + spacing.md }]}>
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)', '#fff']}
            pointerEvents="none"
          />
          <ShineButton
            label={t('setup.start', '🎮 START GAME')}
            color={colors.success}
            loading={isLoading}
            disabled={!canStart}
            onPress={handleStart}
          />
        </View>
      </View>

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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: fontSize.xl,
    color: colors.text,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerSpacer: { width: 40 },
  content: { padding: spacing.xl, paddingBottom: spacing['4xl'] },
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  chipText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
  },
  playerCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.base,
    marginBottom: spacing.sm,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  playerInput: { flex: 1, marginBottom: 0 },
  avatarButton: { flexShrink: 0 },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: fontSize.sm, marginBottom: 4, marginTop: spacing.xs },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  modeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  modeIcon: {
    fontSize: 24,
  },
  modeName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  modeDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
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
