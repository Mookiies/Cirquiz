import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { spacing } from '../theme';
import { SelectableRow } from './SelectableRow';

interface Category {
  id: string;
  name: string;
}

interface Props {
  categories: Category[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  loading?: boolean;
}

export function CategorySelector({ categories, value, onChange, loading }: Props) {
  const { t } = useTranslation();

  if (loading) return <ActivityIndicator style={{ marginVertical: spacing.md }} />;

  const anyOption = { id: undefined as unknown as string, name: t('common.anyCategory') };
  const sorted = [anyOption, ...[...categories].sort((a, b) => a.name.localeCompare(b.name))];
  return (
    <View>
      {sorted.map((cat) => {
        const active = value === cat.id;
        return (
          <SelectableRow
            key={cat.id ?? '__any__'}
            label={cat.name}
            active={active}
            onPress={() => onChange(cat.id)}
          />
        );
      })}
    </View>
  );
}
