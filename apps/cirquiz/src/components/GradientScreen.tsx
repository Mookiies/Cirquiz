import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, ViewStyle } from 'react-native';
import { BackgroundBlobs } from './BackgroundBlobs';
import { colors } from '../theme';
import { lightenHex } from '../utils/color';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  showBlobs?: boolean;
  mode?: keyof typeof GRADIENT_COLORS;
}
const LIGHTEN_AMMOUNT = 0.06;
const GRADIENT_COLORS = {
  standard: [colors.primaryFaint, colors.white, colors.difficultyFaint] as const,
  lighter: [
    lightenHex(colors.primaryFaint, LIGHTEN_AMMOUNT),
    colors.white,
    lightenHex(colors.difficultyFaint, LIGHTEN_AMMOUNT),
  ] as const,
  'no-white': [colors.primaryFaint, colors.difficultyFaint] as const,
};

export function GradientScreen({ children, style, showBlobs = true, mode = 'standard' }: Props) {
  return (
    <LinearGradient style={[{ flex: 1 }, style]} colors={GRADIENT_COLORS[mode]}>
      {showBlobs && <BackgroundBlobs />}
      {children}
    </LinearGradient>
  );
}
