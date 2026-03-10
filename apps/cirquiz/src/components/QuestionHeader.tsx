import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { Question } from '../providers';
import { colors, spacing, fontSize, fontWeight } from '../theme';

interface Props {
  question: Question;
  questionIndex: number;
  questionCount: number;
}

export function QuestionHeader({ question, questionIndex, questionCount }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <Text style={styles.progress}>
        {t('game.question.title', { current: questionIndex + 1, total: questionCount })}
      </Text>
      <Text style={styles.category}>
        {question.category} · {question.difficulty}
      </Text>
      <Text style={styles.questionText}>{question.text}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  progress: { fontSize: fontSize.md, color: colors.textTertiary, marginBottom: spacing.xs },
  category: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.lg },
  questionText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing['2xl'],
    lineHeight: 30,
  },
});
