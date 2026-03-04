import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet } from 'react-native';

export default function SetupNewGameScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Setup New Game</ThemedText>
      {/* Add your game setup UI here */}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
});
