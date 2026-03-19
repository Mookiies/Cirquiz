import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function GameLayout() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
