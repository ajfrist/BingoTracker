import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet } from 'react-native';

export default function PreviousGamesScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Previous Games</ThemedText>
      {/* Add your previous games list here */}
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
