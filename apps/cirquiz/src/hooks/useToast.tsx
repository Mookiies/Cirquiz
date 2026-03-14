import { useCallback, useState } from 'react';
import { Platform, ToastAndroid } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Toast } from '../components/Toast';

const TOAST_DURATION = 3000; // Duration for which the toast is visible (in milliseconds)
export function useToast() {
  const opacity = useSharedValue(0);
  const [message, setMessage] = useState('');

  const showToast = useCallback(
    (msg: string) => {
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } else {
        setMessage(msg);
        opacity.value = withSequence(
          withTiming(1, { duration: 200 }),
          withDelay(TOAST_DURATION, withTiming(0, { duration: 300 }))
        );
      }
    },
    [opacity]
  );

  const toastStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const ToastNode = <Toast toastMessage={message} toastStyle={toastStyle} />;

  return { showToast, toastMessage: message, toastStyle, ToastNode };
}
