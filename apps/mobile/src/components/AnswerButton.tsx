import { Button } from './Button';

interface Props {
  label: string;
  selected: boolean;
  disabled: boolean;
  accentColor: string;
  onPress: () => void;
}

export function AnswerButton({ label, selected, disabled, accentColor, onPress }: Props) {
  return (
    <Button
      label={label}
      color={accentColor}
      outlined
      selected={selected}
      disabled={disabled}
      onPress={onPress}
    />
  );
}
