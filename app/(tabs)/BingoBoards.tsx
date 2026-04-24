import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Dimensions, FlatList, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

    // Currently called number after hitting 'submit'
    const [called, setCalled] = useState('');
    // List of all called numbers in this game
    const [allCalled, setAllCalled] = useState<string[]>([]);
    // Toggle to show all called numbers or just the last 5
    const [showAllCalled, setShowAllCalled] = useState(false);
    // Input state for entering called numbers
    const [input, setInput] = useState('');
    // Toggle for compressed card view in list
    const [compressedCardView, setCompressedCardView] = useState(false);
    // Indexes of cards being tracked 
    const [trackedCards, setTrackedCards] = useState<number[]>([]); // Indexes of cards being tracked
    // Cards state of currently marked cells this game, as bitmask (25 bit ints for 5x5 grid) 
    const [cardsData, setCardsData] = useState<number[]>([]);
    // Store actual card numbers as 2D string arrays
    const [savedCards, setSavedCards] = useState<string[][][]>([]);
    // Progress for each card based on win method
    const [winProgress, setWinProgress] = useState<number[]>([]); // Progress for each card and each win pattern
    // Colors for each card (in list view) based on progress
    const [cardColors, setCardColors] = useState<string[]>([]); // Card background colors
    // Mask toggle state
    const [maskEnabled, setMaskEnabled] = useState(false);

    // Initialize empty cards data on mount or when savedCards changes
    useEffect(() => {
        // Track all cards by default
        setTrackedCards(savedCards.map((_, idx) => idx));
        
        if (cardsData.length === 0) {
            // Initialize empty cards data for bitmasking
            const initialCards: number[] = [];
            for (let i = 0; i < savedCards.length; i++) {
                initialCards.push(0b1000000000000);
            }
            setCardsData(initialCards);
        }
    }, [savedCards.length]);

    // Update savedCards from params on reload
    const { cardsJSON } = useLocalSearchParams<{ cardsJSON: string; }>();
    useEffect(() => {
        const cards = JSON.parse(cardsJSON) || [];
        setSavedCards(cards);
        // Save to AsyncStorage as cached boards
        (async () => {
            try {
                await AsyncStorage.setItem('cached_current_boards', JSON.stringify(cards));
            } catch (e) {
                console.error('Failed to cache boards:', e);
            }
        })();
    }, [cardsJSON]);

    const [zoomedCardIdx, setZoomedCardIdx] = useState<number>(-1);

    const handleSubmit = () => {
        // Only allow numbers 1-75 (character sensitive)
        const regex = /^(?:[1-9]|[1-6][0-9]|7[0-5])$/;
        if (!regex.test(input)) {
            Alert.alert('Invalid Input', 'Please enter a number from 1 to 75.');
            return;
        }
        // Ensure called number has not been called before
        if (allCalled.includes(input)) {
            Alert.alert('Number Already Called', `The number ${input} has already been called.`);
            return;
        }

        setCalled(input);
        setAllCalled(prev => [...prev, input]);
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
                                winProgress,
                                trackedCards,
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
    };

    const handleBackFromZoom = () => {
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

    const handleDeleteCard = () => {
        if (zoomedCardIdx < 0 || zoomedCardIdx >= savedCards.length) return;
        Alert.alert(
            'Delete Card',
            'Are you sure you want to delete this card?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes', style: 'destructive', onPress: () => {
                        setSavedCards(prev => prev.filter((_, i) => i !== zoomedCardIdx));
                        setTrackedCards(prev => prev.filter(idx => idx !== zoomedCardIdx).map(idx => idx > zoomedCardIdx ? idx - 1 : idx));
                        setCardsData(prev => prev.filter((_, i) => i !== zoomedCardIdx));
                        setWinProgress(prev => prev.filter((_, i) => i !== zoomedCardIdx));
                        setCardColors(prev => prev.filter((_, i) => i !== zoomedCardIdx));
                        setZoomedCardIdx(-1);
                    }
                },
            ]
        );
    };

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
        "L": [0b1000010000100001000011111],
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
            }
            newColors.push(color);
        }
        setWinProgress(newProgresses);
        setCardColors(newColors);
    }, [winMethod, cardsData, trackedCards]);

    // Update the state of each card when a number is called or removed
    useEffect(() => {
        // Recompute cardsData from scratch based on allCalled
        if (!savedCards.length) return;
        const updatedCardsData = savedCards.map((card, cardIdx) => {
            let cardData = 0b1000000000000; // initial state
            for (let calledNum of allCalled) {
                for (let row = 0; row < 5; row++) {
                    for (let col = 0; col < 5; col++) {
                        const cellValue = card[row][col];
                        if (cellValue === calledNum) {
                            const bitPosition = 24 - (row * 5 + col);
                            cardData = cardData | (1 << bitPosition);
                        }
                    }
                }
            }
            return cardData;
        });
        setCardsData(updatedCardsData);
    }, [allCalled, savedCards.length]);

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
        <KeyboardAvoidingView style={{ flex: 1, padding: 16, backgroundColor: '#fff' }} behavior="padding">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
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
                                {Object.keys(winMethods).map((option) => (
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
                {/* Mask toggle button */}
                <View style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Pressable
                        onPress={() => setMaskEnabled((v) => !v)}
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            borderWidth: 2,
                            borderColor: maskEnabled ? '#1976d2' : '#bbb',
                            backgroundColor: maskEnabled ? '#1976d2' : '#fff',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: 12,
                        }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: maskEnabled }}
                    >
                        {maskEnabled ? (
                            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' }} />
                        ) : null}
                    </Pressable>
                    <Text style={{ fontSize: 16, marginLeft: 12, marginRight: 2 }}>Mask</Text>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, justifyContent: 'space-between', width: '90%' }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', maxWidth: '75%', alignItems: 'center' }}>
                        <Text>Called: </Text>{allCalled
                            .toReversed()
                            .slice(0, showAllCalled ? Math.min(100, allCalled.length) : Math.min(5, allCalled.length))
                            .map((num, idx) => (
                                <TouchableOpacity
                                    key={num + '-' + idx}
                                    onPress={() => {
                                        Alert.alert(
                                            'Remove Called Number',
                                            `Remove ${num} from called numbers?`,
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Yes', style: 'destructive', onPress: () => {
                                                        // Remove the number from allCalled
                                                        setAllCalled(prev => {
                                                            const reversed = [...prev].reverse();
                                                            reversed.splice(idx, 1);
                                                            return reversed.reverse();
                                                        });
                                                        // If the removed number was the last called, clear 'called'
                                                        if (allCalled[allCalled.length - 1 - idx] === called) {
                                                            setCalled('');
                                                        }
                                                    }
                                                },
                                            ]
                                        );
                                    }}
                                    style={{ marginRight: 4, marginBottom: 2, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 4, backgroundColor: '#e3f2fd', borderWidth: 1, borderColor: '#1976d2' }}
                                >
                                    <Text style={{ color: '#1976d2', fontWeight: 'bold', fontSize: 15 }}>{num}</Text>
                                </TouchableOpacity>
                            ))}
                        {allCalled.length > (showAllCalled ? 100 : 5) ? <Text>, ...</Text> : null}
                    </View>
                    <TouchableOpacity
                        style={{
                            marginLeft: 10,
                            paddingHorizontal: 20,
                            paddingVertical: 4,
                            borderRadius: 6,
                            backgroundColor: '#1976d2',
                        }}
                        onPress={() => setShowAllCalled(v => !v)}
                    >
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>{showAllCalled ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View style={{ flex: 1, width: '100%' }}>
                {/* Toggle button for compressedCardView */}
                <TouchableOpacity
                    style={{
                        alignSelf: 'center',
                        marginVertical: 10,
                        paddingHorizontal: 20,
                        paddingVertical: 6,
                        borderRadius: 6,
                        backgroundColor: '#9b9b9b',
                    }}
                    onPress={() => setCompressedCardView(v => !v)}
                >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18, margin: -5, width: "100%", }}>{compressedCardView ? '▼                      Expand                      ▼' : '▲                    Compress                    ▲'}</Text>
                    
                </TouchableOpacity>
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
                            <View style={[bingoStyles.cardContainer, { backgroundColor: cardColors[idx] || '#f9f9f9', marginBottom: compressedCardView ? -100 : 3 }] }>
                                <TouchableOpacity style={{ width: '100%', height: '100%', flex: 1 }} onPress={() => handleZoomCard(idx)} activeOpacity={0.8}>
                                    <Text style={{ fontWeight: 'bold', marginBottom: 1 }}>Card {idx + 1}   -   {winProgress[idx]} left</Text>
                                    {card.map((row, rowIdx) => (
                                        <View key={rowIdx} style={{ flexDirection: 'row' }}>
                                            {row.map((cell, colIdx) => {
                                                // Calculate bit position for this cell
                                                const bitPosition = 24 - (rowIdx * 5 + colIdx);
                                                const isFilled = (cardsData[idx] & (1 << bitPosition)) !== 0;
                                                // Mask logic: if maskEnabled and winMethod !== 'Traditional', mask cells not in win pattern
                                                let masked = false;
                                                if (maskEnabled && winMethod !== 'Traditional') {
                                                    const winPatterns = winMethods[winMethod];
                                                    // If this bit is not set in any win pattern, mask it
                                                    masked = !winPatterns.some((pattern) => (pattern & (1 << bitPosition)) !== 0);
                                                }
                                                return (
                                                    <View
                                                        key={colIdx}
                                                        style={[
                                                            bingoStyles.cell,
                                                            isFilled && { backgroundColor: '#222', borderColor: '#111' },
                                                            masked && { backgroundColor: '#888', borderColor: '#333' },
                                                        ]}
                                                    >
                                                        <Text style={{ fontSize: 13, textAlign: 'center', color: masked ? '#bbb' : isFilled ? '#fff' : '#222' }}>{cell}</Text>
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
            <TouchableOpacity style={[bingoStyles.clearButton, { marginBottom: 16 }]} onPress={handleClear}>
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
                                            // Mask logic: if maskEnabled and winMethod !== 'Traditional', mask cells not in win pattern
                                            let masked = false;
                                            if (maskEnabled && winMethod !== 'Traditional') {
                                                const winPatterns = winMethods[winMethod];
                                                masked = !winPatterns.some((pattern) => (pattern & (1 << bitPosition)) !== 0);
                                            }
                                            return (
                                                <View
                                                    key={colIdx}
                                                    style={[
                                                        bingoStyles.zoomedCell,
                                                        isFilled && { backgroundColor: '#222', borderColor: '#111' },
                                                        masked && { backgroundColor: '#888', borderColor: '#333' },
                                                    ]}
                                                >
                                                    <Text style={{ fontSize: 20, textAlign: 'center', color: masked ? '#bbb' : isFilled ? '#fff' : '#222' }}>{cell}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ))}
                                <View style={{ flexDirection: 'row', marginTop: 22, justifyContent: 'space-between', width: '100%' }}>
                                    <TouchableOpacity style={[bingoStyles.modalButton, { backgroundColor: '#1976d2' }]} onPress={handleBackFromZoom}>
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}>Back</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[bingoStyles.modalButton, { backgroundColor: trackedCards.includes(zoomedCardIdx) ? '#212121' : '#4caf50' }]} onPress={handleStopTracking}>
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}>{trackedCards.includes(zoomedCardIdx) ? 'Stop Tracking' : 'Start Tracking'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[bingoStyles.modalButton, { backgroundColor: '#d32f2f' }]} onPress={handleDeleteCard}>
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}>Delete Card</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
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
        justifyContent: 'center',
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