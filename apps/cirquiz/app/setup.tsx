import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, LinearTransition, useAnimatedStyle } from 'react-native-reanimated';
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewRef,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPlayerRow } from '../src/components/AnimatedPlayerRow';
import { AvatarCell } from '../src/components/AvatarCell';
import { CategorySelector } from '../src/components/CategorySelector';
import { ChipButton } from '../src/components/ChipButton';
import { DifficultySelector } from '../src/components/DifficultySelector';
import { GradientScreen } from '../src/components/GradientScreen';
import { ModeCard } from '../src/components/ModeCard';
import { ShineButton } from '../src/components/ShineButton';
import { Button } from '../src/components/Button';
import { AVATAR_LIST, type AvatarKey } from '../src/avatars';
import { type Difficulty } from '../src/providers';
import { useCategoryLoader } from '../src/hooks/useCategoryLoader';
import { useToast } from '../src/hooks/useToast';
import { useGameStore } from '../src/state/gameStore';
import { useSettingsStore } from '../src/state/settingsStore';
import { colors, fontSize, fontWeight, radius, spacing } from '../src/theme';
import { IconButton } from '../src/components/IconButton';
import LightningSVG from '../assets/lightning.svg';
import SliderSVG from '../assets/slider.svg';

const QUESTION_COUNTS = [1, 5, 10, 15, 20] as const;

interface PlayerEntry {
  id: number;
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

  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const belowPlayersY = useRef(0);
  const modeLabelOffsetY = useRef(0);
  const nextId = useRef(2);
  const [players, setPlayers] = useState<PlayerEntry[]>([
    {
      id: 0,
      name: avatarName(AVATAR_LIST[0].key),
      avatar: AVATAR_LIST[0].key,
      nameCustomized: false,
    },
    {
      id: 1,
      name: avatarName(AVATAR_LIST[1].key),
      avatar: AVATAR_LIST[1].key,
      nameCustomized: false,
    },
  ]);
  const initialPlayerCount = useRef(2);
  const [questionCount, setQuestionCount] = useState('10');
  const [quickPlay, setQuickPlay] = useState(true);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(undefined);
  const { categories, loading: loadingCategories, load: loadCategories } = useCategoryLoader();
  const [nameErrors, setNameErrors] = useState<Record<number, string>>({});
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [stickyHeight, setStickyHeight] = useState(0);

  const questionSource = useSettingsStore((s) => s.questionSource);
  const isFirstRender = useRef(true);
  const { showToast, ToastNode } = useToast();

  // Refs let us read latest values in the effect without adding them as deps
  const categoryRef = useRef(category);
  categoryRef.current = category;
  const quickPlayRef = useRef(quickPlay);
  quickPlayRef.current = quickPlay;
  const loadCategoriesRef = useRef(loadCategories);
  loadCategoriesRef.current = loadCategories;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (categoryRef.current !== undefined) {
      setCategory(undefined);
      showToast(t('settings.categoryResetNotice'));
    }
    if (!quickPlayRef.current) {
      loadCategoriesRef.current();
    }
  }, [questionSource, t, showToast]);

  const usedAvatars = players.map((p) => p.avatar);

  const addPlayer = () => {
    if (players.length >= AVATAR_LIST.length) return;
    const avatar = firstAvailableAvatar(usedAvatars);
    const id = nextId.current++;
    setPlayers((prev) => [
      ...prev,
      { id, name: avatarName(avatar), avatar, nameCustomized: false },
    ]);
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

  const turnQuickplayOff = async () => {
    setQuickPlay(false);
    if (categories.length === 0) {
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

  useEffect(() => {
    if (!quickPlay && !loadingCategories && categories.length > 0) {
      scrollRef.current?.scrollTo({
        y: belowPlayersY.current + modeLabelOffsetY.current,
        animated: true,
      });
    }
  }, [quickPlay, loadingCategories, categories.length]);

  const { height, progress } = useReanimatedKeyboardAnimation();

  const stickyAnimatedStyle = useAnimatedStyle(() => ({
    bottom: -height.value,
    paddingBottom: interpolate(progress.value, [0, 1], [insets.bottom + spacing.md, spacing.md]),
  }));

  const canStart = players.length > 0 && !isLoading;
  const pickerPlayer = pickerIndex !== null ? players[pickerIndex] : null;

  return (
    <GradientScreen>
      <View style={styles.flex}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <IconButton icon="arrow-back" onPress={() => router.back()} color={colors.text} />
          <Text style={styles.headerTitle}>{t('setup.title', 'NEW GAME')}</Text>
          <IconButton
            icon="settings-outline"
            onPress={() => router.push('/settings')}
            color={colors.text}
          />
        </View>

        <KeyboardAwareScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bottomOffset={stickyHeight}
        >
          <Text style={styles.sectionLabel}>{t('setup.questionCount')}</Text>
          <View style={styles.chipsRow}>
            {QUESTION_COUNTS.map((count) => (
              <ChipButton
                key={count}
                label={count}
                active={questionCount === String(count)}
                onPress={() => setQuestionCount(String(count))}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>{t('setup.players')}</Text>
          {players.map((player, index) => (
            <AnimatedPlayerRow
              key={player.id}
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

          <Animated.View
            layout={LinearTransition}
            onLayout={(e) => {
              belowPlayersY.current = e.nativeEvent.layout.y;
            }}
          >
            {players.length < AVATAR_LIST.length && (
              <Button
                variant="text"
                label={`+ ${t('setup.addPlayer')}`}
                onPress={addPlayer}
                color={colors.textPrimary}
              />
            )}

            <Text
              style={styles.sectionLabel}
              onLayout={(e) => {
                modeLabelOffsetY.current = e.nativeEvent.layout.y;
              }}
            >
              {t('setup.mode', 'Mode')}
            </Text>
            <View style={styles.modeRow}>
              <ModeCard
                icon={<LightningSVG />}
                name={t('setup.quickPlay')}
                description={t('setup.quickPlayDesc', 'Any topic, jump right in!')}
                active={quickPlay}
                onPress={() => setQuickPlay(true)}
              />
              <ModeCard
                icon={<SliderSVG />}
                name={t('setup.chooseCategories')}
                description={t('setup.chooseCategoriesDesc', 'Pick topic & difficulty')}
                active={!quickPlay}
                onPress={turnQuickplayOff}
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

            <View style={{ height: 100 }} />
          </Animated.View>
        </KeyboardAwareScrollView>

        {/* Sticky CTA */}
        <Animated.View
          style={[styles.stickyBottom, stickyAnimatedStyle]}
          onLayout={(e) => setStickyHeight(e.nativeEvent.layout.height)}
          pointerEvents="box-none"
        >
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)', '#fff']}
            pointerEvents="none"
          />
          <ShineButton
            label={t('setup.start')}
            color={colors.success}
            loading={isLoading}
            disabled={!canStart}
            onPress={handleStart}
          />
        </Animated.View>
      </View>

      <Modal
        visible={pickerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerIndex(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerIndex(null)}>
          <View style={styles.modalContent}>
            <View style={styles.avatarGrid}>
              {AVATAR_LIST.map((avatarDef) => {
                const taken =
                  usedAvatars.includes(avatarDef.key) && pickerPlayer?.avatar !== avatarDef.key;
                const selected = pickerPlayer?.avatar === avatarDef.key;
                return (
                  <AvatarCell
                    key={avatarDef.key}
                    avatarDef={avatarDef}
                    selected={selected}
                    taken={taken}
                    onPress={() => {
                      if (pickerIndex !== null) {
                        updatePlayerAvatar(pickerIndex, avatarDef.key);
                      }
                    }}
                  />
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>
      {ToastNode}
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
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
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
});
