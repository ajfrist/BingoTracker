import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


type GameData = {
  timestamp: string;
  cards: string[][][];
  allCalled: string[];
  winMethod: string;
  cardsData: number[];
  winProgress: number[];
  trackedCards: number[];
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

  const handleDeleteGame = () => {
    Alert.alert(
      'Delete Game?',
      'Are you sure you want to delete this game from the records?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes', style: 'destructive', onPress: async () => {
            if (selectedDateIdx === null) return;
            const dateObj = dateGames[selectedDateIdx];
            const updatedGames = [...dateObj.games];
            updatedGames.splice(selectedGameIdx, 1);

            try {
              await AsyncStorage.setItem(`bingo_games_${dateObj.date}`, JSON.stringify(updatedGames));
              const updatedDateGames = [...dateGames];
              updatedDateGames[selectedDateIdx] = { ...dateObj, games: updatedGames };
              setDateGames(updatedDateGames);
              if (updatedGames.length === 0) {
                setSelectedDateIdx(null);
                setModalVisible(false);
              } else {
                setSelectedGameIdx(Math.min(selectedGameIdx, updatedGames.length - 1));
              }
            } catch (e) {
              console.error('Failed to delete game:', e);
            }
          }
        },
      ]
    );
  };
      

  // Render a bingo card (5x5 grid)
  const renderCard = (card: string[][], cardIdx: number, winProgress?: number[]) => {
    let progress = winProgress ? winProgress[cardIdx] : 24;
    const cardBackgroundColor = progress === 0 ? '#f00cd1ff' // Magenta for BINGO
                              : progress === 1 ? '#e53935' // Red
                              : progress === 2 ? '#fb8c00' // Orange
                              : progress === 3 ? '#fdd835' // Yellow
                              : progress === 4 ? '#aed581' // Light green
                              : progress === 5 ? '#81c784' // Green
                              : '#f9f9f9'; 
    return (
    <View key={cardIdx} style={[styles.cardContainer, { backgroundColor: cardBackgroundColor }]}>
      {card.map((row, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: 'row' }}>
          {row.map((cell, colIdx) => {
            // Fill cell block color based on cardsData bitmask
            const dateObj = dateGames[selectedDateIdx!];
            const game = dateObj.games[selectedGameIdx];
            const bitPosition = 24 - (rowIdx * 5 + colIdx);
            const isFilled = (game.cardsData[cardIdx] & (1 << bitPosition)) !== 0;
            return (
              <View key={colIdx} style={[styles.cell, isFilled && { backgroundColor: '#222', borderColor: '#111' }]}>
                <Text style={{ fontSize: 11, color: isFilled ? '#fff' : '#222' }}>{cell}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
    );
  };

  // Render the modal for a selected game
  const renderGameModal = () => {
    if (selectedDateIdx === null) return null;
    const dateObj = dateGames[selectedDateIdx];
    const game = dateObj.games[selectedGameIdx];
    // Handler to load boards from this game into cached boards
    const handleLoadBoardsToCache = async () => {
      try {
        await AsyncStorage.setItem('cached_current_boards', JSON.stringify(game.cards));
        Alert.alert('Boards Loaded', 'Boards from this game are now cached and ready to use.');
      } catch (e) {
        Alert.alert('Error', 'Failed to cache boards.');
      }
    };
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
              <TouchableOpacity onPress={handleCloseModal} style={{ padding: 8, marginRight: 20}}>
                <Text style={{ fontWeight: 'bold', color: '#1976d2' }}>Close</Text>
              </TouchableOpacity>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{dateObj.date} - {new Date(dateObj.games[selectedGameIdx].timestamp).toTimeString().split(' ')[0]}</Text>
              <TouchableOpacity onPress={handleDeleteGame} style={{ padding: 8, marginLeft: 20, borderRadius: 6, backgroundColor: '#d32f2f' }}>
                <Text style={{ fontWeight: 'bold', color: '#ffffff' }}>Delete</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Game {selectedGameIdx + 1} of {dateObj.games.length}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
              <TouchableOpacity onPress={handlePrevGame} disabled={selectedGameIdx === 0} style={[styles.navButton, selectedGameIdx === 0 && { opacity: 0.5 }]}> 
                <Text style={{ fontSize: 18 }}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={{ marginHorizontal: 12, fontSize: 15 }}>Game {selectedGameIdx + 1}</Text>
              <TouchableOpacity onPress={handleNextGame} disabled={selectedGameIdx === dateObj.games.length - 1} style={[styles.navButton, selectedGameIdx === dateObj.games.length - 1 && { opacity: 0.5 }]}> 
                <Text style={{ fontSize: 18 }}>{'>'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleLoadBoardsToCache} style={{ backgroundColor: '#1976d2', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Load These Boards for New Game</Text>
            </TouchableOpacity>
            <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 16 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 6 }}>Win Method: {game.winMethod}</Text>
              <Text style={{ fontSize: 14, marginBottom: 6 }}>Numbers Called: {game.allCalled?.join(', ')}</Text>
              <View style={styles.cardsWrap}>
                {game.cards.map((card, idx) => renderCard(card, idx, game.winProgress))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={{ color: '#604ebfff' }}>Previous Games</ThemedText>
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
