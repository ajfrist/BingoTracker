import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Dimensions, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function BingoBoards() {
  const navigation = useNavigation();
  const router = useRouter();
  // Confirm navigation before going back
  const confirmBack = useCallback(() => {
      Alert.alert(
      'Go Back?',
      'Are you sure you want to go back? All progress will be lost.',
      [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes', style: 'destructive', onPress: () => router.replace('/(tabs)/setup') },
      ]
      );
      return true;
  }, [navigation]);

  // Override system back button
  useEffect(() => {
      const handler = BackHandler.addEventListener('hardwareBackPress', confirmBack);
      return () => handler.remove();
  }, [confirmBack]);
  
  const { cardsJSON } = useLocalSearchParams<{ cardsJSON: string; }>();
  const [called, setCalled] = useState('');
  const [input, setInput] = useState('');
  const [savedCards, setSavedCards] = useState(JSON.parse(cardsJSON) || []);
  const [zoomedCardIdx, setZoomedCardIdx] = useState<number | null>(null);

  const handleSubmit = () => {
    setCalled(input);
    setInput('');
  };

  const handleClear = () => {
    setSavedCards([]);
  };

  const handleZoomCard = (idx: number) => {
    setZoomedCardIdx(idx);
  };

  const handleBackFromZoom = () => {
    setZoomedCardIdx(null);
  };

  const handleStopTracking = () => {
    setZoomedCardIdx(null);
    setSavedCards(savedCards.slice(zoomedCardIdx, 1));
  };    

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
      {/* Back button top left */}
      <TouchableOpacity
        style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, padding: 8 }}
        onPress={confirmBack}
      >
        <Text style={{ fontSize: 18, color: '#1976d2', fontWeight: 'bold' }}>{'< Back'}</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 8, paddingLeft: 40 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Called: </Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#bbb', borderRadius: 6, padding: 6, minWidth: 80, marginRight: 8 }}
          value={input}
          onChangeText={setInput}
          placeholder="Type call..."
        />
        <TouchableOpacity style={{ backgroundColor: '#1976d2', padding: 8, borderRadius: 6 }} onPress={handleSubmit}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Submit</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ fontSize: 16, marginBottom: 8 }}>Current: {called}</Text>
      <ScrollView>
        {savedCards.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#888', marginTop: 32 }}>No boards saved.</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {savedCards.map((card: string[][], idx: number) => (
              <View key={idx} style={bingoStyles.cardContainer}>
                <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Card {idx + 1}</Text>
                {card.map((row, rowIdx) => (
                  <View key={rowIdx} style={{ flexDirection: 'row' }}>
                    {row.map((cell, colIdx) => (
                      <View key={colIdx} style={bingoStyles.cell}>
                        <Text style={{ fontSize: 13, textAlign: 'center' }}>{cell}</Text>
                      </View>
                    ))}
                  </View>
                ))}          
                <TouchableOpacity key={idx} style={bingoStyles.cardContainer} onPress={() => handleZoomCard(idx)} activeOpacity={0.8}/>

              </View>
              
            ))}
            
          </View>
        )}
      </ScrollView>
      <TouchableOpacity style={bingoStyles.clearButton} onPress={handleClear}>
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Clear Boards</Text>
      </TouchableOpacity>
      {/* Card Zoom Modal */}
      <Modal
        visible={zoomedCardIdx !== null}
        animationType="fade"
        transparent
        onRequestClose={handleBackFromZoom}
      >
        <View style={bingoStyles.overlayBackground}>
          <View style={bingoStyles.zoomedCardContainer}>
            {zoomedCardIdx !== null && (
              <>
                <Text style={{ fontWeight: 'bold', fontSize: 22, marginBottom: 12 }}>Card {zoomedCardIdx + 1}</Text>
                {savedCards[zoomedCardIdx]?.map((row: string[], rowIdx: number) => (
                  <View key={rowIdx} style={{ flexDirection: 'row' }}>
                    {row.map((cell, colIdx) => (
                      <View key={colIdx} style={bingoStyles.zoomedCell}>
                        <Text style={{ fontSize: 20, textAlign: 'center' }}>{cell}</Text>
                      </View>
                    ))}
                  </View>
                ))}
                <View style={{ flexDirection: 'row', marginTop: 24, justifyContent: 'space-between', width: '100%' }}>
                  <TouchableOpacity style={[bingoStyles.modalButton, { backgroundColor: '#1976d2' }]} onPress={handleBackFromZoom}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[bingoStyles.modalButton, { backgroundColor: '#d32f2f' }]} onPress={handleStopTracking}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Stop Tracking</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const bingoStyles = StyleSheet.create({
  cardContainer: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
    width: '48%',
    backgroundColor: '#f9f9f9',
  },
  cell: {
    flex: 1,
    minWidth: 24,
    minHeight: 24,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 1,
    width: "18%",
    height: 30,
  },
  zoomedCardContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    minWidth: Dimensions.get('window').width * 0.8,
    maxWidth: 500,
    alignSelf: 'center',
  },
  zoomedCell: {
    flex: 1,
    minWidth: 40,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#1976d2',
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
  },
  overlayBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#d32f2f',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
});