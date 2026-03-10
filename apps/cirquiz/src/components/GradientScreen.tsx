import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, ViewStyle } from 'react-native';
import { BackgroundBlobs } from './BackgroundBlobs';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function GradientScreen({ children, style }: Props) {
  return (
    <LinearGradient style={[{ flex: 1 }, style]} colors={['#EBF5FB', '#fff', '#f3eeff']}>
      <BackgroundBlobs />
      {children}
    </LinearGradient>
  );
}
