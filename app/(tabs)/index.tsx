import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <Image
        source={require('../../assets/images/splash-icon_bingo.png')}
        style={styles.icon}
        resizeMode="contain"
      />
      <ThemedText type="title" style={styles.title}>BINGO Tracker</ThemedText>
      <View style={styles.buttonContainer}>
        <Link href="/(tabs)/setup" asChild>
          <TouchableOpacity style={styles.largeButton}>
            <Text style={styles.buttonText}>Setup New Game</Text>
          </TouchableOpacity>
        </Link>
      </View>
      <View style={styles.buttonContainer}>
        <Link href="/(tabs)/previous" asChild>
          <TouchableOpacity style={styles.largeButton}>
            <Text style={styles.buttonText}>Previous Games</Text>
          </TouchableOpacity>
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
    marginBottom: 16,
  },
  largeButton: {
    width: 250,
    height: 60,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  icon: {
    width: 300,
    height: 300,
    marginBottom: 24,
  },
});
