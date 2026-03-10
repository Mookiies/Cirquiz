import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, ViewStyle } from 'react-native';
import { BackgroundBlobs } from './BackgroundBlobs';
import { colors } from '../theme';
import { lightenHex } from '../utils/color';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  showBlobs?: boolean;
  lighter?: boolean;
}
const LIGHTEN_AMMOUNT = 0.05;
const GRADIENT_COLORS = {
  default: [colors.primaryFaint, colors.white, colors.difficultyFaint] as const,
  lighter: [
    lightenHex(colors.primaryFaint, LIGHTEN_AMMOUNT),
    colors.white,
    lightenHex(colors.difficultyFaint, LIGHTEN_AMMOUNT),
  ] as const,
};

export function GradientScreen({ children, style, showBlobs = true, lighter = false }: Props) {
  return (
    <LinearGradient
      style={[{ flex: 1 }, style]}
      colors={lighter ? GRADIENT_COLORS.lighter : GRADIENT_COLORS.default}
    >
      {showBlobs && <BackgroundBlobs />}
      {children}
    </LinearGradient>
  );
}
