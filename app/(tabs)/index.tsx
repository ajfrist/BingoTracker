
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { Button, StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>BINGO Tracker</ThemedText>
      <View style={styles.buttonContainer}>
        <Link href="/(tabs)/setup" asChild>
          <Button title="Setup New Game" onPress={() => {}} />
        </Link>
      </View>
      <View style={styles.buttonContainer}>
        <Link href="/(tabs)/previous" asChild>
          <Button title="Previous Games" onPress={() => {}} />
        </Link>
      </View>
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
  title: {
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
    alignItems: 'center',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
});
