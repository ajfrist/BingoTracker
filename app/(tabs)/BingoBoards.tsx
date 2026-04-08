import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function BingoBoards() {
    const navigation = useNavigation();
    const router = useRouter();
    // Confirm navigation before going back
    const confirmBack = useCallback(() => {
        Alert.alert(
            'Go Back?',
            'Are you sure you want to go back? Board marker progress will be lost.',
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
    const [cardsData, setCardsData] = useState<number[]>([]);
    const [savedCards, setSavedCards] = useState<string[][][]>([]);
    const [winProgress, setWinProgress] = useState<number[]>([]); // Progress for each card and each win pattern
    const [cardColors, setCardColors] = useState<string[]>([]); // Card background colors
    // Initialize empty cards data on mount or when savedCards changes
    useEffect(() => {
        // Initialize empty cards data for bitmasking
        const initialCards: number[] = [];
        for (let i = 0; i < savedCards.length; i++) {
            initialCards.push(0b1000000000000);
        }
        setCardsData(initialCards);
    }, [savedCards.length]);

    // Update savedCards from params on reload
    const { cardsJSON } = useLocalSearchParams<{ cardsJSON: string; }>();
    useEffect(() => {
        setSavedCards(JSON.parse(cardsJSON) || []);
        setTrackedCards(savedCards.map((_, idx) => idx));
    }, [cardsJSON]);

    const [zoomedCardIdx, setZoomedCardIdx] = useState<number>(-1);

    const handleSubmit = () => {
        // Normalize input by stripping non-digit characters
        let normalizedInput = input.replace(/\D/g, '');
        if (normalizedInput === '') {
            Alert.alert('Invalid Input', 'Please enter a valid number.');
            return;
        }

        setCalled(normalizedInput);
        setAllCalled(prev => [...prev, normalizedInput]);
        setInput('');
    };

    const handleClear = () => {
        Alert.alert(
            'Clear All Board Markers?',
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
                                cardsData,
                                winProgress
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
                        const initialCards: number[] = [];
                        for (let i = 0; i < savedCards.length; i++) {
                            initialCards.push(0b1000000000000);
                        }
                        setCardsData(initialCards);
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
        console.log('Zooming card', idx);
    };

    const handleBackFromZoom = () => {
        console.log('Closing zoom view', zoomedCardIdx);
        setZoomedCardIdx(-1);
    };

    const handleStopTracking = () => {
        if (trackedCards.includes(zoomedCardIdx)) {
            setTrackedCards(trackedCards.filter(idx => idx !== zoomedCardIdx));
        } else {
            setTrackedCards([...trackedCards, zoomedCardIdx]);
        }

        setZoomedCardIdx(-1);

    };

    useEffect(() => {
        // Iterate over cardsData to update tracked color cards
        let newColors: string[] = [];
        for (let i = 0; i < cardsData.length; i++) {
            if (!(trackedCards.includes(i))) {
                newColors.push('#212121ff');
            } else {
                newColors.push('#f9f9f9');
            }
        }
        setCardColors(newColors);
    }, [trackedCards]);

    const winMethods: Record<string, number[]> = {
        "Traditional": [
            0b1000010000100001000010000,
            0b100001000010000100001000,
            0b10000100001000010000100,
            0b1000010000100001000010,
            0b100001000010000100001,
            0b1111100000000000000000000,
            0b11111000000000000000,
            0b111110000000000,
            0b1111100000,
            0b11111,
            0b1000001000001000001000001,
            0b100010001000100010000],
        "Four Corners (small)": [0b1000100000000000000010001],
        "Four Corners (big)": [0b1101111011000001101111011],
        "Blackout": [0b1111111111111111111111111],
        "T": [0b1111100100001000010000100],
        "X": [0b1000101010001000101010001],
        "Plus": [0b10000100111110010000100],
        "Postage Stamp": [0b1100011000000000000000]
    };
    const [winMethod, setWinMethod] = useState<string>("Traditional");

    // Check win progress whenever called number updates or win method changes 
    useEffect(() => {
        // Iterate through each card
        const newProgresses: number[] = [];
        const newColors: string[] = [];
        for (let cardIdx = 0; cardIdx < cardsData.length; cardIdx++) {
            // Skip untracked cards (eliminated cards)
            if (!(trackedCards.includes(cardIdx))) {
                newProgresses.push(24);
                newColors.push('#212121ff');
                continue;
            }

            // Get current card state as bitmask
            const cardState = cardsData[cardIdx];
            const winPatterns = winMethods[winMethod];

            let progress = 24;
            for (let winPattern of winPatterns) {
                const matchedBits = cardState & winPattern;
                
                // Count number of bits set in winPattern
                let neededCount = 0;
                for (let bitPos = 0; bitPos < 25; bitPos++) {
                    if ((winPattern & (1 << bitPos)) !== 0) {
                        neededCount = neededCount + 1;
                    }
                }

                // Count number of bits set in matchedBits
                let count = 0;
                for (let bitPos = 24; bitPos >= 0; bitPos--) {
                    if ((matchedBits & (1 << bitPos)) !== 0) {
                        count++;
                    }
                }
                progress = Math.min(progress, neededCount - count);
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
    }, [winMethod, cardsData, trackedCards]);

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
                        const bitPosition = 24 - (row * 5 + col);
                        updatedCardData = updatedCardData | (1 << bitPosition);
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
    const [selected, setSelected] = useState("Traditional");
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
                            setWinMethod(option);
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, marginTop: 8, paddingLeft: 40 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Called: </Text>
                <TextInput
                    style={{ borderWidth: 1, borderColor: '#bbb', borderRadius: 6, padding: 6, minWidth: 80, marginRight: 8 }}
                    value={input}
                    onChangeText={setInput}
                    placeholder=""
                    keyboardType='numeric'
                    onSubmitEditing={handleSubmit}
                    maxLength={2}
                    returnKeyType="done"
                    submitBehavior='submit'
                />
                <TouchableOpacity style={{ backgroundColor: '#1976d2', padding: 8, borderRadius: 6 }} onPress={handleSubmit}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Submit</Text>
                </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 16, marginBottom: 5 }}>Called: {allCalled.toReversed().slice(0, Math.min(10, allCalled.length)).join(', ')}{allCalled.length>10 ? ', ...' : ''}</Text>
            <View style={{ flex: 1, width: '100%' }}>
                {savedCards.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: '#888', marginTop: 32 }}>No boards saved.</Text>
                ) : (
                    <FlatList
                        data={savedCards}
                        keyExtractor={(_, idx) => idx.toString()}
                        numColumns={2}
                        contentContainerStyle={{ paddingBottom: 16, alignItems: 'center' }}
                        showsVerticalScrollIndicator={true}
                        renderItem={({ item: card, index: idx }) => (
                            <View style={[bingoStyles.cardContainer, { backgroundColor: cardColors[idx] || '#f9f9f9' }] }>
                                <TouchableOpacity style={{ width: '100%', height: '100%', flex: 1 }} onPress={() => handleZoomCard(idx)} activeOpacity={0.8}>
                                    <Text style={{ fontWeight: 'bold', marginBottom: 1 }}>Card {idx + 1}   -   {winProgress[idx]} left</Text>
                                    {card.map((row, rowIdx) => (
                                        <View key={rowIdx} style={{ flexDirection: 'row' }}>
                                            {row.map((cell, colIdx) => {
                                                // Calculate bit position for this cell
                                                const bitPosition = 24 - (rowIdx * 5 + colIdx);
                                                const isFilled = (cardsData[idx] & (1 << bitPosition)) !== 0;
                                                return (
                                                    <View key={colIdx} style={[bingoStyles.cell, isFilled && { backgroundColor: '#222', borderColor: '#111' }]}>
                                                        <Text style={{ fontSize: 13, textAlign: 'center', color: isFilled ? '#fff' : '#222' }}>{cell}</Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    ))}
                                </TouchableOpacity>
                            </View>
                        )}
                    />
                )}
            </View>
            <TouchableOpacity style={bingoStyles.clearButton} onPress={handleClear}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>New Game (Clear Board Markers)</Text>
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
                                            const bitPosition = 24 - (rowIdx * 5 + colIdx);
                                            const isFilled = (cardsData[zoomedCardIdx] & (1 << bitPosition)) !== 0;
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
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{trackedCards.includes(zoomedCardIdx) ? 'Stop Tracking' : 'Start Tracking'}</Text>
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
        padding: 5,
        margin: 3,
        width: Dimensions.get('window').width / 2 - 32,
        height: Dimensions.get('window').width / 2 - 70,
        backgroundColor: '#f9f9f9',
        minHeight: 120,
        maxHeight: 280,
        maxWidth: "100%",
        justifyContent: 'center',
        alignItems: 'center',
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
        width: "10%",
        height: "10%",
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
        maxHeight: 120,
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
        width: "100%",
        minWidth: 150,
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