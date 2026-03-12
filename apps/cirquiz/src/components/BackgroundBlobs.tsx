import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface BlobConfig {
  size: number;
  color: string;
  position: { top?: number; bottom?: number; left?: number; right?: number };
  tx: number;
  ty: number;
  duration: number;
  delay: number;
  opacity: number;
}

const BLOBS: BlobConfig[] = [
  {
    size: 220,
    color: '#3498DB',
    position: { top: -70, right: -90 },
    tx: -10,
    ty: 15,
    duration: 5000,
    delay: 0,
    opacity: 0.11,
  },
  {
    size: 160,
    color: '#9B59B6',
    position: { bottom: -50, left: -60 },
    tx: 15,
    ty: -10,
    duration: 6000,
    delay: 1000,
    opacity: 0.11,
  },
  {
    size: 90,
    color: '#2ECC71',
    position: { top: 240, right: -25 },
    tx: -8,
    ty: 12,
    duration: 4000,
    delay: 500,
    opacity: 0.13,
  },
  {
    size: 70,
    color: '#F39C12',
    position: { top: 310, left: -20 },
    tx: 10,
    ty: -8,
    duration: 5500,
    delay: 1500,
    opacity: 0.13,
  },
  // Large purple corner blob
  {
    size: 300,
    color: '#9B59B6',
    position: { bottom: -120, right: -100 },
    tx: -12,
    ty: -18,
    duration: 7000,
    delay: 300,
    opacity: 0.13,
  },
  // Small accent blobs
  {
    size: 90,
    color: '#9B59B6',
    position: { top: 160, left: 20 },
    tx: 8,
    ty: -10,
    duration: 4500,
    delay: 800,
    opacity: 0.15,
  },
  {
    size: 70,
    color: '#E74C3C',
    position: { top: 480, right: 30 },
    tx: -6,
    ty: 10,
    duration: 3800,
    delay: 2000,
    opacity: 0.14,
  },
];

function Blob({ config }: { config: BlobConfig }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  useEffect(() => {
    const easing = Easing.inOut(Easing.ease);
    tx.value = withDelay(
      config.delay,
      withRepeat(withTiming(config.tx, { duration: config.duration, easing }), -1, true)
    );
    ty.value = withDelay(
      config.delay,
      withRepeat(withTiming(config.ty, { duration: config.duration, easing }), -1, true)
    );
  }, [config, tx, ty]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.blob,
        {
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
          opacity: config.opacity,
          ...config.position,
        },
        animStyle,
      ]}
    />
  );
}

export function BackgroundBlobs() {
  return (
    <Animated.View style={styles.root} pointerEvents="none">
      {BLOBS.map((config, i) => (
        <Blob key={i} config={config} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  blob: {
    position: 'absolute',
  },
});
