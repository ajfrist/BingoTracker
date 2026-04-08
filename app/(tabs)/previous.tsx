import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


type GameData = {
  timestamp: string;
  cards: string[][][];
  allCalled: string[];
  winMethod: string;
  cardsData: string[];
};

type DateGames = {
  date: string;
  games: GameData[];
};

export default function PreviousGamesScreen() {
  const [loading, setLoading] = useState(true);
  const [dateGames, setDateGames] = useState<DateGames[]>([]);
  const [selectedDateIdx, setSelectedDateIdx] = useState<number | null>(null);
  const [selectedGameIdx, setSelectedGameIdx] = useState<number>(0);
  const [modalVisible, setModalVisible] = useState(false);

  // Fetch all previous games from AsyncStorage
  useFocusEffect(useCallback(() => {
      const fetchGames = async () => {
        setLoading(true);
        try {
          const keys = await AsyncStorage.getAllKeys();
          const bingoKeys = keys.filter(k => k.startsWith('bingo_games_'));
          const dateGamesArr: DateGames[] = [];
          for (const key of bingoKeys) {
            const date = key.replace('bingo_games_', '');
            const value = await AsyncStorage.getItem(key);
            if (value) {
              const games: GameData[] = JSON.parse(value);
              dateGamesArr.push({ date, games });
            }
          }
          // Sort by date descending
          dateGamesArr.sort((a, b) => b.date.localeCompare(a.date));
          setDateGames(dateGamesArr);
        } catch (e) {
          setDateGames([]);
        } finally {
          setLoading(false);
        }
      };
      fetchGames();
    }, [])
  );

  // Handler for clicking a date
  const handleDateClick = (idx: number) => {
    setSelectedDateIdx(idx);
    setSelectedGameIdx(0);
    setModalVisible(true);
  };

  // Handler for closing modal
  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedDateIdx(null);
    setSelectedGameIdx(0);
  };

  // Navigation between games under the same date
  const handlePrevGame = () => {
    if (selectedDateIdx === null) return;
    setSelectedGameIdx(idx => Math.max(0, idx - 1));
  };
  const handleNextGame = () => {
    if (selectedDateIdx === null) return;
    const gamesLen = dateGames[selectedDateIdx].games.length;
    setSelectedGameIdx(idx => Math.min(gamesLen - 1, idx + 1));
  };

  // Render a bingo card (5x5 grid)
  const renderCard = (card: string[][], cardIdx: number) => (
    <View key={cardIdx} style={styles.cardContainer}>
      {card.map((row, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: 'row' }}>
          {row.map((cell, colIdx) => (
            <View key={colIdx} style={styles.cell}>
              <Text style={{ fontSize: 13 }}>{cell}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  // Render the modal for a selected game
  const renderGameModal = () => {
    if (selectedDateIdx === null) return null;
    const dateObj = dateGames[selectedDateIdx];
    const game = dateObj.games[selectedGameIdx];
    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={handleCloseModal}
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <TouchableOpacity onPress={handleCloseModal} style={{ padding: 8 }}>
                <Text style={{ fontWeight: 'bold', color: '#1976d2' }}>Close</Text>
              </TouchableOpacity>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{dateObj.date} - Game {selectedGameIdx + 1} of {dateObj.games.length}</Text>
              <View style={{ width: 48 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
              <TouchableOpacity onPress={handlePrevGame} disabled={selectedGameIdx === 0} style={[styles.navButton, selectedGameIdx === 0 && { opacity: 0.5 }]}> 
                <Text style={{ fontSize: 18 }}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={{ marginHorizontal: 12, fontSize: 15 }}>Game {selectedGameIdx + 1}</Text>
              <TouchableOpacity onPress={handleNextGame} disabled={selectedGameIdx === dateObj.games.length - 1} style={[styles.navButton, selectedGameIdx === dateObj.games.length - 1 && { opacity: 0.5 }]}> 
                <Text style={{ fontSize: 18 }}>{'>'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 16 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 6 }}>Win Method: {game.winMethod}</Text>
              <Text style={{ fontSize: 14, marginBottom: 6 }}>Numbers Called: {game.allCalled?.join(', ')}</Text>
              <View style={styles.cardsWrap}>
                {game.cards.map((card, idx) => renderCard(card, idx))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Previous Games</ThemedText>
      {loading ? (
        <Text style={{ marginTop: 24 }}>Loading...</Text>
      ) : dateGames.length === 0 ? (
        <Text style={{ marginTop: 24 }}>You have no previous games.</Text>
      ) : (
        <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingVertical: 16 }}>
          {dateGames.map((dg, idx) => (
            <TouchableOpacity
              key={dg.date}
              style={styles.dateItem}
              onPress={() => handleDateClick(idx)}
            >
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{dg.date}</Text>
              <Text style={{ color: '#555', fontSize: 13 }}>{dg.games.length} game{dg.games.length > 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {renderGameModal()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 16,
    backgroundColor: '#fff',
  },
  dateItem: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 8,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
  },
  cardContainer: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    padding: 5,
    margin: 6,
    backgroundColor: '#f9f9f9',
    minHeight: 100,
    maxHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
    flexBasis: '45%',
    maxWidth: '48%',
    minWidth: 120,
  },
  cell: {
    flex: 1,
    minWidth: 18,
    minHeight: 18,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 0,
    width: 28,
    height: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxHeight: '90%',
    alignItems: 'center',
  },
  navButton: {
    padding: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    marginHorizontal: 4,
  },
});
