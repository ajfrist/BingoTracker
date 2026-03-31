import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
                { text: 'Yes', style: 'destructive', onPress: () => router.navigate('/(tabs)/setup') },
            ]
        );
        return true;
    }, [navigation]);

    // Override system back button
    useEffect(() => {
        const handler = BackHandler.addEventListener('hardwareBackPress', confirmBack);
        return () => handler.remove();
    }, [confirmBack]);

    const [called, setCalled] = useState('');
    const [allCalled, setAllCalled] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const [trackedCards, setTrackedCards] = useState<number[]>([]); // Indexes of cards being tracked
    const [cardsData, setCardsData] = useState<bigint[]>([]);
    const [savedCards, setSavedCards] = useState<string[][][]>([]);
    const [winProgress, setWinProgress] = useState<number[]>([]); // Progress for each card and each win pattern
    const [cardColors, setCardColors] = useState<string[]>([]); // Card background colors
    // Initialize empty cards data on mount or when savedCards changes
    useEffect(() => {
        // Initialize empty cards data for bitmasking
        const initialCards: bigint[] = [];
        for (let i = 0; i < savedCards.length; i++) {
            initialCards.push(1000000000000n);
        }
        setCardsData(initialCards);
    }, [savedCards.length]);

    // Update savedCards from params on reload
    const { cardsJSON } = useLocalSearchParams<{ cardsJSON: string; }>();
    useEffect(() => {
        setSavedCards(JSON.parse(cardsJSON) || []);
    }, [cardsJSON]);

    const [zoomedCardIdx, setZoomedCardIdx] = useState<number>(-1);

    const handleSubmit = () => {
        setCalled(input);
        setAllCalled(prev => [...prev, input]);
        setInput('');
    };

    const handleClear = () => {
        Alert.alert(
            'Clear All Boards?',
            'Are you sure you want to clear all saved boards and start a new game?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes', style: 'destructive', onPress: async () => {
                        try {
                            // Prepare game data
                            const now = new Date();
                            const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
                            const gameData = {
                                timestamp: now.toISOString(),
                                cards: savedCards,
                                allCalled,
                                winMethod,
                                cardsData: cardsData.map(b => b.toString()),
                            };
                            // Fetch existing games for this date
                            const storageKey = `bingo_games_${dateKey}`;
                            const existing = await AsyncStorage.getItem(storageKey);
                            let games = [];
                            if (existing) {
                                games = JSON.parse(existing);
                            }
                            // Add new game
                            games.push(gameData);
                            await AsyncStorage.setItem(storageKey, JSON.stringify(games));
                        } catch (e) {
                            console.error('Failed to save previous game:', e);
                        }
                        setCardsData([]);
                        setAllCalled([]);
                        setCalled('');
                        setWinProgress([]);
                    }
                },
            ]
        );
    };

    const handleZoomCard = (idx: number) => {
        setZoomedCardIdx(idx);
    };

    const handleBackFromZoom = () => {
        setZoomedCardIdx(-1);
    };

    const handleStopTracking = () => {
        setZoomedCardIdx(-1);
        setTrackedCards(trackedCards.filter(idx => idx !== zoomedCardIdx));

    };

    useEffect(() => {
        // Iterate over cardsData to update tracked color cards
        let newColors: string[] = [];
        for (let i = 0; i < cardsData.length; i++) {
            if (!(i in trackedCards)) {
                newColors.push('#212121ff');
            } else {
                newColors.push('#f9f9f9');
            }
        }
        setCardColors(newColors);
    }, [trackedCards]);

    const winMethods: Record<string, bigint[]> = {
        "Traditional": [
            1000010000100001000010000n,
            100001000010000100001000n,
            10000100001000010000100n,
            1000010000100001000010n,
            100001000010000100001n,
            1111100000000000000000000n,
            11111000000000000000n,
            111110000000000n,
            1111100000n,
            11111n,
            1000001000001000001000001n,
            100010001000100010000n],
        "Four Corners (small)": [1000100000000000000010001n],
        "Four Corners (big)": [1101111011000001101111011n],
        "Blackout": [1111111111111111111111111n],
        "T": [1111100100001000010000100n],
        "X": [1000101010001000101010001n],
        "Plus": [10000100111110010000100n],
        "Postage Stamp": [1100011000000000000000n]
    };
    const [winMethod, setWinMethod] = useState<string>("Traditional");

    // Check win progress whenever called number updates or win method changes 
    useEffect(() => {
        // Iterate through each card
        const newProgresses: number[] = [];
        const newColors: string[] = [];
        for (let cardIdx = 0; cardIdx < cardsData.length; cardIdx++) {
            // Get current card state as bitmask
            const cardState = cardsData[cardIdx];
            const winPatterns = winMethods[winMethod];

            let progress = 24;
            for (let winPattern of winPatterns) {
                const matchedBits = cardState & winPattern;
                // Count number of bits set in matchedBits
                let count = 0;
                for (let bitPos = 0n; bitPos < 25n; bitPos++) {
                    if ((matchedBits & (1n << bitPos)) !== 0n) {
                        count++;
                    }
                }
                progress = Math.min(progress, count);
            }
            newProgresses.push(progress);

            // Assign color based on progress
            let color = '#f9f9f9';
            if (progress === 0) {
                color = '#f00cd1ff'; // Magenta for BINGO
                Alert.alert('BINGO!', `Card ${cardIdx + 1} has BINGO!`);
            } else if (progress === 1) {
                color = '#e53935'; // Red
            } else if (progress === 2) {
                color = '#fb8c00'; // Orange
            } else if (progress === 3) {
                color = '#fdd835'; // Yellow
            } else if (progress === 4) {
                color = '#aed581'; // Light green
            } else if (progress === 5) {
                color = '#81c784'; // Green
            }
            newColors.push(color);
        }
        setWinProgress(newProgresses);
        setCardColors(newColors);
    }, [winMethod, cardsData]);

    // Update the state of each card when a number is called
    useEffect(() => {
        if (called === '') return;
        const updatedCardsData = cardsData.map((cardData, cardIdx) => {
            let updatedCardData = cardData;
            const card = savedCards[cardIdx];
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 5; col++) {
                    const cellValue = card[row][col];
                    if (cellValue === called) {
                        const bitPosition = BigInt(24 - (row * 5 + col));
                        updatedCardData = updatedCardData | (1n << bitPosition);
                        break;
                    }
                }
            }
            return updatedCardData;
        });
        setCardsData(updatedCardsData);
    }, [called]);

    // Setup for custom dropdown menu (Picker alternative)
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState("Select an option");
    const [position, setPosition] = useState({ x: 0, y: 0, width: 0 });

    const triggerRef = useRef<View>(null);

    const openDropdown = () => {
        triggerRef.current?.measureInWindow((x, y, width, height) => {
            setPosition({ x, y: y + height, width });
            setOpen(true);
        });
    };

    return (
        <View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
                <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Win Method: </Text>
                <View>
                {/* Trigger */}
                <Pressable ref={triggerRef} style={bingoStyles.dropdownTrigger} onPress={openDropdown}>
                <Text>{selected}</Text>
                </Pressable>
                {/* Dropdown */}
                <Modal transparent visible={open} animationType="fade">
                <Pressable style={bingoStyles.dropdownOverlay} onPress={() => setOpen(false)}>
                    <View
                    style={[
                        bingoStyles.dropdownMenu,
                        {
                        top: position.y,
                        left: position.x,
                        width: position.width,
                        },
                    ]}
                    >
                    {Object.keys(winMethods).map((option ) => (
                        <Pressable
                        key={option}
                        style={bingoStyles.dropdownItem}
                        onPress={() => {
                            setSelected(option);
                            setOpen(false);
                        }}
                        >
                        <Text>{option}</Text>
                        </Pressable>
                    ))}
                    </View>
                </Pressable>
                </Modal>
                </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, marginTop: 8, paddingLeft: 40 }}>
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
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Clear Boards (New Game)</Text>
            </TouchableOpacity>
            {/* Card Zoom Modal */}
            <Modal
                visible={zoomedCardIdx !== -1}
                animationType="fade"
                transparent
                onRequestClose={handleBackFromZoom}
            >
                <View style={bingoStyles.overlayBackground}>
                    <View style={bingoStyles.zoomedCardContainer}>
                        {zoomedCardIdx !== -1 && (
                            <>
                                <Text style={{ fontWeight: 'bold', fontSize: 22, marginBottom: 12 }}>Card {zoomedCardIdx + 1}</Text>
                                {savedCards[zoomedCardIdx]?.map((row: string[], rowIdx: number) => (
                                    <View key={rowIdx} style={bingoStyles.zoomedRow}>
                                        {row.map((cell, colIdx) => {
                                            // Calculate bit position for this cell
                                            const bitPosition = BigInt(24 - (rowIdx * 5 + colIdx));
                                            const isFilled = (cardsData[zoomedCardIdx] & (1n << bitPosition)) !== 0n;
                                            return (
                                                <View
                                                    key={colIdx}
                                                    style={[bingoStyles.zoomedCell, isFilled && { backgroundColor: '#222', borderColor: '#111' }]}
                                                >
                                                    <Text style={{ fontSize: 20, textAlign: 'center', color: isFilled ? '#fff' : '#222' }}>{cell}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ))}
                                <View style={{ flexDirection: 'row', marginTop: 22, justifyContent: 'space-between', width: '100%' }}>
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
        margin: 8,
        width: Dimensions.get('window').width / 2 - 32,
        backgroundColor: '#f9f9f9',
        minHeight: 120,
        maxHeight: 180,
        justifyContent: 'center',
        alignItems: 'center',
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
        maxWidth: Dimensions.get('window').width * 0.8,
        maxHeight: Dimensions.get('window').height * 0.8,
        alignSelf: 'center',
    },
    zoomedRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        width: '100%',
        marginBottom: 2,
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
    dropdownTrigger: {
        padding: 12,
        borderWidth: 1,
        borderRadius: 6,
        backgroundColor: "#fff",
        flexDirection: "row", alignItems: "flex-start", 
        width: "100%"
    },
    dropdownOverlay: {
        flex: 1,
    },
    dropdownMenu: {
        position: "absolute",
        backgroundColor: "#fff",
        borderRadius: 6,
        elevation: 8, // Android shadow
        shadowColor: "#000", // iOS shadow
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    dropdownItem: {
        padding: 12,
    },
});