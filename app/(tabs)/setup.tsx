import AsyncStorage from '@react-native-async-storage/async-storage';
import textRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { useFocusEffect } from '@react-navigation/native';
import { Camera, CameraView } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Platform, ScrollView, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View } from 'react-native';

// Only use tesseract.js for web OCR. For mobile, use react-native-ml-kit/text-recognition.
const isWeb = Platform.OS === 'web';
let createWorker: any = null;
let PSM: any = null;
if (isWeb) {
  const tesseract = require('tesseract.js');
  createWorker = tesseract.createWorker;
  PSM = tesseract.PSM;
}


export default function SetupNewGameScreen() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // OCR state
  const [ocrText, setOcrText] = useState<string>('No OCR results yet.');
  const [ocrLoading, setOcrLoading] = useState(false);

  // Toggle: grid OCR vs full-image OCR
  const [gridMode, setGridMode] = useState(true);

  // Last captured image (data URI on web or file URI on mobile)
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  // Show/hide the captured image preview and OCR debug output
  const [showDebug, setShowDebug] = useState(true);

  // Table state for OCR results (5x5 grid)
  const initialTable = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => (r === 2 && c === 2 ? 'Free' : ''))
  );
  const [tableData, setTableData] = useState<string[][]>(initialTable);

  // Array of bingo cards (each is a 5x5 array)
  const [savedCards, setSavedCards] = useState<string[][][]>([]);

  // Load cached boards if present
  useFocusEffect(useCallback(() => {
      (async () => {
        try {
          const cached = await AsyncStorage.getItem('cached_current_boards');
          if (cached) {
            setSavedCards(JSON.parse(cached));
          }
        } catch (e) {
          // Ignore errors
        }
      })();
    }, [])
  );

  // Function to insert text into the table by row and column
  const insertTextToTable = (row: number, col: number, text: string) => {
    if (row === 2 && col === 2) return; // Center cell is not editable
    setTableData(prev => {
      const newData = prev.map(arr => [...arr]);
      newData[row][col] = text;
      return newData;
    });
  };

  // Function to check if a cell's value is valid: changes background color if invalid
  const isCellValid = (colIdx: number, text: string) => {
    // Ensure text is 1-2 characters and a number between 0-99
    if (text.length >= 1 && text.length <= 2 && (/^(7[0-5]|[1-6]?[0-9])$/.test(text))) {
      if (colIdx === 0 && (/^([0-9]|1[0-5])$/.test(text))) { // B column
        return true;
      } else if (colIdx === 1 && (/^(1[6-9]|2[0-9]|30)$/.test(text))) { // I column
        return true;
      } else if (colIdx === 2 && (/^(3[1-9]|4[0-5])$/.test(text))) { // N column
        return true;
      } else if (colIdx === 3 && (/^(4[6-9]|5[0-9]|60)$/.test(text))) { // G column
        return true;
      } else if (colIdx === 4 && (/^(6[1-9]|7[0-5])$/.test(text))) { // O column
        return true;
      }
    }
    return false;
  };

  // Save current table as a card
  const saveCurrentCard = () => {
    setSavedCards(prev => [...prev, tableData.map(row => [...row])]);
    setTableData(initialTable);
  };

  // Parse raw string from whole image OCR into 5x5 cell output - backtracking
  const parseFullOCR = (raw: string, cellIndex = 0, latestBColumn: number | null = null): number[] | null => {
    
    // Remove Free space & numbers inside of that cell; all new-lines; replace '|', '\\', or '/' with space; remove all text 
    let cleaned = raw.replace(/\n/g, ' ').replace(/\|/g, ' ').replace(/\\/g, ' ').replace(/\//g, ' ').replace(/[^\d\s]/g, '').trim();
    if (cleaned.length == 0){ 
        return null; 
        // return Array(25 - cellIndex).fill(-1);
    }

    // Handle free space
    if (cellIndex == 12){ 
        let followingVals = parseFullOCR(cleaned, cellIndex + 1, latestBColumn);

        if (followingVals != null){
            return [0, ...followingVals]; // Good case: found a match, success!
        } 
        else {
            return null;
            // return Array(25 - cellIndex).fill(-2);
        }
    }

    // first column, could be next 1 or 2 characters, must be 1-15
    if (cellIndex % 5 == 0){ // B column
        let currentValInt;
        
        if ((/^(1[0-5])$/.test(cleaned.substring(0, 2)))){ // check for 2 characters width numbers
            currentValInt = Number(cleaned.substring(0, 2));
            if (!isNaN(currentValInt)){
                let followingVals = parseFullOCR(cleaned.substring(2), cellIndex + 1, currentValInt);

                if (followingVals != null){
                    return [currentValInt, ...followingVals]; // Good case: found a match, success!
                } 

                // Verify that not happening to match the previous column B value (scan read same value twice)
                if (latestBColumn == currentValInt){   
                    // skip to next valid value
                    let followingVals = parseFullOCR(cleaned.substring(2), cellIndex, latestBColumn);

                    if (followingVals != null){
                        return followingVals; // Good case: found a match, success!
                    }
                }
            }
        }


        if ((/^([1-9])$/.test(cleaned.substring(0, 1)))){ // check for 1 character width numbers
            currentValInt = Number(cleaned.substring(0, 1));
            if (!isNaN(currentValInt)){
                let followingVals = parseFullOCR(cleaned.substring(1), cellIndex + 1, currentValInt);

                if (followingVals != null){
                    return [currentValInt, ...followingVals]; // Good case: found a match, success!
                } 

                // Verify that not happening to match the previous column B value (scan read same value twice)
                if (latestBColumn == currentValInt){   
                    // skip to next valid value
                    let followingVals = parseFullOCR(cleaned.substring(1), cellIndex, latestBColumn);

                    if (followingVals != null){
                        return followingVals; // Good case: found a match, success!
                    }
                }
            }
        }

        return null; // Exhausted all possibilities at this depth: signal dead-end
        // return Array(25 - cellIndex).fill(-4);
    } 
    else {  // other columns, only 2 characters wide

        // First check double OCR reading from the B column within the same line
        if (latestBColumn != null && cellIndex % 5 == 1){ // If in I column, verify not matching previous B column value (scan read same value twice)
            // skip to next valid value
            if (latestBColumn < 10 && latestBColumn == Number(cleaned.substring(0, 1))){
                let followingVals = parseFullOCR(cleaned.substring(1), cellIndex, latestBColumn);

                if (followingVals != null){
                    return followingVals; // Good case: found a match, success!
                }
            }
            else if (latestBColumn >= 10 && latestBColumn == Number(cleaned.substring(0, 2))){
                let followingVals = parseFullOCR(cleaned.substring(2), cellIndex, latestBColumn);

                if (followingVals != null){
                    return followingVals; // Good case: found a match, success!
                }
            }
        }

        // Check if the next 2 characters would work
        let currentVal = cleaned.substring(0, 2);      
        if ((cellIndex % 5 == 1 && (/^(1[6-9]|2[0-9]|30)$/.test(currentVal))) || //I column
            (cellIndex % 5 == 2 && (/^(3[1-9]|4[0-5])$/.test(currentVal))) ||   // N column
            (cellIndex % 5 == 3 && (/^(4[6-9]|5[0-9]|60)$/.test(currentVal))) || // G column
            (cellIndex % 5 == 4 && (/^(6[1-9]|7[0-5])$/.test(currentVal)))       // O column
        ) { 

            let currentValInt = Number(cleaned.substring(0, 2));
            if (!isNaN(currentValInt)){
                if (cellIndex < 24){
                    let followingVals = parseFullOCR(cleaned.substring(2), cellIndex + 1, latestBColumn);

                    if (followingVals != null){
                        return [currentValInt, ...followingVals]; // Good case: found a match, success!
                    }
                }
                else { 
                    return [currentValInt]; // Bottom-most case; would indicate overall completion & success!
                }
            }
        }

        return null; // Exhausted all possibilities at this depth: signal dead-end
        
        // Return an array of -1s of size of remaining cells = 25-cellIndex
        // return Array(25 - cellIndex).fill(-5); // Signal that we are in a valid path, but cannot be sure of the remaining values (due to scan quality); will be treated as "unknown" in the final board generation
        
        // let followingVals = parseFullOCR(cleaned.substring(1), cellIndex + 1, latestBColumn, debug);
        // if (followingVals != null){
        //     return [Number(cleaned.substring(0, 1)), ...followingVals]; // Good case: found a match, success!
        // }
        // followingVals = parseFullOCR(cleaned.substring(2), cellIndex + 1, latestBColumn, debug);
        // if (followingVals != null){
        //     return [Number(cleaned.substring(0, 2)), ...followingVals]; // Good case: found a match, success!
        // }
        // followingVals = parseFullOCR(cleaned.substring(3), cellIndex + 1, latestBColumn, debug);
        // if (followingVals != null){
        //     return [Number(cleaned.substring(0, 3)), ...followingVals]; // Good case: found a match, success!
        // }
        // followingVals = parseFullOCR(cleaned.substring(4), cellIndex + 1, latestBColumn, debug);
        // if (followingVals != null){
        //     return [Number(cleaned.substring(0, 4)), ...followingVals]; // Good case: found a match, success!
        // }

    
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web: Use HTML5 video
      navigator.mediaDevices?.getUserMedia({ video: true })
        .then((stream) => {
          setWebStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() => setHasPermission(false));
      setHasPermission(true);
    } else {
      // Mobile: Use expo-camera
      (async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      })();
    }
    return () => {
      if (webStream) {
        webStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // // OCR for web: capture a frame and run Tesseract on each grid block
  // Remove interval-based OCR. Use Scan button instead.

  // OCR for mobile: capture a frame and run ML Kit text recognition
  // Remove interval-based OCR. Use Scan button instead.
  // Scan handler for both web and mobile
  const handleScan = async () => {
    if (ocrLoading) return;
    setOcrLoading(true);
    try {
      if (Platform.OS === 'web' && hasPermission && videoRef.current && createWorker) {
        // Web: capture current video frame to canvas
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          setCapturedImageUri(dataUrl);

          if (!gridMode) {
            // Full-image OCR (single pass)
            const worker = await createWorker('eng', 1, { logger: (m: any) => console.log(m) });
            await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
            try {
              const ret = await worker.recognize(dataUrl, { tessedit_char_whitelist: '0123456789 ' });
              const raw = ret.data.text.trim() || '';
              setOcrText(raw);
              // Try to parse the raw OCR into 25 cell values
              const parsed = parseFullOCR(raw, 0, null);
              if (parsed && parsed.length >= 25) {
                const newTable = Array.from({ length: 5 }, (_, r) =>
                  Array.from({ length: 5 }, (_, c) => (r === 2 && c === 2 ? 'Free' : String(parsed[r * 5 + c] || '')))
                );
                setTableData(newTable);
              } else {
                setTableData(initialTable);
              }
            } catch {
              setOcrText('');
              setTableData(initialTable);
            }
            await worker.terminate();
          } else {
            // Grid OCR: split into 5x5
            const gridRows = 5;
            const gridCols = 5;
            const cellWidth = canvas.width / gridCols;
            const cellHeight = canvas.height / gridRows;
            const worker = await createWorker('eng', 1, { logger: (m: any) => console.log(m) });
            await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR });
            const results: string[][] = [];
            for (let row = 0; row < gridRows; row++) {
              const rowResults: string[] = [];
              for (let col = 0; col < gridCols; col++) {
                if (row === 2 && col === 2) {
                  rowResults.push('Free');
                  continue;
                }
                const cellCanvas = document.createElement('canvas');
                cellCanvas.width = cellWidth;
                cellCanvas.height = cellHeight;
                const cellCtx = cellCanvas.getContext('2d');
                if (cellCtx) {
                  cellCtx.drawImage(
                    canvas,
                    col * cellWidth, row * cellHeight, cellWidth, cellHeight,
                    0, 0, cellWidth, cellHeight
                  );
                  const cellDataUrl = cellCanvas.toDataURL('image/png');
                  try {
                    const ret = await worker.recognize(cellDataUrl, { tessedit_char_whitelist: '0123456789' });
                    rowResults.push(ret.data.text.trim() || '');
                  } catch {
                    rowResults.push('');
                  }
                } else {
                  rowResults.push('');
                }
              }
              results.push(rowResults);
            }
            await worker.terminate();
            setTableData(results);
            setOcrText(results.map(row => row.join(' | ')).join('\n'));
          }
        }
      } else if (!isWeb && hasPermission && cameraReady && cameraRef.current) {
        // Mobile: take picture
        // @ts-ignore
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7, skipProcessing: true, animateShutter: false });
        if (photo && photo.uri) {
          setCapturedImageUri(photo.uri);
          // If full-image mode, run recognition once on the whole photo
          if (!gridMode) {
            try {
              const fullResult = await textRecognition.recognize(photo.uri, TextRecognitionScript.LATIN);
              const fullText = fullResult.blocks.map((block: any) => block.text).join(' ').trim();
              const raw = fullText || '';
              setOcrText(raw);
              // Attempt to parse the full-image OCR into table cells
              const parsed = parseFullOCR(raw, 0, null);
              if (parsed && parsed.length >= 25) {
                const newTable = Array.from({ length: 5 }, (_, r) =>
                  Array.from({ length: 5 }, (_, c) => (r === 2 && c === 2 ? 'Free' : String(parsed[r * 5 + c] || '')))
                );
                setTableData(newTable);
              } else {
                setTableData(initialTable);
              }
              
            } catch {
              setOcrText('');
              setTableData(initialTable);
            }
          } else {
            // Grid mode: crop into tiles and run recognition per tile (existing behavior)
            const { width: imgWidth, height: imgHeight } = photo;
            const gridRows = 5;
            const gridCols = 5;
            const cellWidth = imgWidth / gridCols;
            const cellHeight = imgHeight / gridRows;
            const tilePromises: Promise<{ row: number; col: number; text: string }>[][] = [];
            for (let row = 0; row < gridRows; row++) {
              const rowPromises: Promise<{ row: number; col: number; text: string }>[] = [];
              for (let col = 0; col < gridCols; col++) {
                if (row === 2 && col === 2) {
                  rowPromises.push(Promise.resolve({ row, col, text: 'Free' }));
                  continue;
                }
                const crop = {
                  originX: Math.round(col * cellWidth),
                  originY: Math.round(row * cellHeight),
                  width: Math.round(cellWidth),
                  height: Math.round(cellHeight),
                };
                rowPromises.push(
                  (async () => {
                    try {
                      const tile = await ImageManipulator.manipulateAsync(
                        photo.uri,
                        [{ crop }],
                        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
                      );
                      const tileResult = await textRecognition.recognize(tile.uri, TextRecognitionScript.LATIN);
                      const tileText = tileResult.blocks.map((block: any) => block.text).join(' ').trim();
                      return { row, col, text: tileText };
                    } catch {
                      return { row, col, text: '' };
                    }
                  })()
                );
              }
              tilePromises.push(rowPromises);
            }
            const results: string[][] = [];
            await Promise.all(
              tilePromises.map(rowPromises =>
                Promise.all(rowPromises).then(rowResults => rowResults.map(r => r.text))
              )
            ).then(allRows => {
              allRows.forEach((rowResults, rowIdx) => {
                results[rowIdx] = rowResults;
              });
            });
            setTableData(results);
            setOcrText(results.map(row => row.join(' | ')).join('\n'));
          }
        }
      }
    } catch (e) {
      setOcrText('OCR error');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleRemoveAllCards = async () => {
    setSavedCards([]);
    try {
      await AsyncStorage.removeItem('cached_current_boards');
    } catch (e) {
      // Ignore errors
    }
    ToastAndroid.show('All saved cards removed.', ToastAndroid.SHORT);
  }

  // Responsive sizing
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  // Reserve space for buttons and some margin
  const reservedHeight = 120;
  // Camera and table should fit side by side vertically
  const maxContainerHeight = (screenHeight - reservedHeight) / 2 - 12;
  const cameraSize = Math.min(screenWidth - 32, maxContainerHeight, 220);

  // Table rendering
  const columns = ['B', 'I', 'N', 'G', 'O'];
  const rows = Array.from({ length: 5 });

  // Helper: Find duplicate values in table (excluding center cell and empty strings)
  const getDuplicatePositions = (table: string[][]) => {
    const valueMap = new Map<string, Array<[number, number]>>();
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === 2 && c === 2) continue; // skip center
        const val = table[r][c];
        if (val && val.trim() !== '') {
          if (!valueMap.has(val)) valueMap.set(val, []);
          valueMap.get(val)!.push([r, c]);
        }
      }
    }
    // Only keep positions for values that appear more than once
    const duplicates = new Set<string>();
    valueMap.forEach((positions, val) => {
      if (positions.length > 1) {
        duplicates.add(val);
      }
    });
    // Return a set of string keys for quick lookup: `${r},${c}`
    const dupPositions = new Set<string>();
    valueMap.forEach((positions, val) => {
      if (duplicates.has(val)) {
        positions.forEach(([r, c]) => dupPositions.add(`${r},${c}`));
      }
    });
    return dupPositions;
  };
  const duplicatePositions = getDuplicatePositions(tableData);

  // Animated value for corner breathing
  const cornerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Looping breathing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(cornerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(cornerAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.quad),
        }),
      ])
    ).start();
  }, [cornerAnim]);

  // Interpolated values for the animated corners
  const cornerOffset = cornerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 8], // Move in and out between 16 and 8 px
  });

  return (

      <View style={styles.container}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }} style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
          <View style={{ width: '100%', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', letterSpacing: 1 }}>
              Scan Your Cards
            </Text>
          </View>
          <View style={{ width: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {/* Left column for Grid + Info buttons */}
              <View style={{ width: 60, alignItems: 'center', margin: 5, marginRight: 12, }}>
                <TouchableOpacity
                  style={[styles.smallButton, gridMode ? { backgroundColor: '#1565c0' } : null, { maxWidth: 45 }, { paddingHorizontal: 4 }, { alignSelf: 'auto' }]}
                  onPress={() => setGridMode(prev => !prev)}
                >
                  <Text style={[styles.buttonText, { textAlign: 'center' }]}>{gridMode ? 'Grid: On' : 'Grid: Off'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallButton, { marginTop: 8, maxWidth: 45 }, { paddingHorizontal: 4 }]}
                  onPress={() => setShowDebug(prev => !prev)}
                >
                  <Text style={[styles.buttonText, { textAlign: 'center' }]}>Info</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.cameraContainer, { width: cameraSize, height: cameraSize }]}> 
                {/* 6x5 Grid Overlay (visible only when gridMode enabled) */}
                {gridMode && (
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.gridOverlay]}>
                    {/* Horizontal lines (6 for 5 rows) */}
                    {Array.from({ length: 6 }).map((_, i) => (
                      <View
                        key={`hline-${i}`}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: `${(i * 20)}%`,
                          height: 1,
                          backgroundColor: 'rgba(255,255,255,0.7)',
                        }}
                      />
                    ))}
                    {/* Vertical lines (5 for 4 columns) */}
                    {Array.from({ length: 5 }).map((_, i) => (
                      <View
                        key={`vline-${i}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: `${(i * 20)}%`,
                          width: 1,
                          backgroundColor: 'rgba(255,255,255,0.7)',
                        }}
                      />
                    ))}
                  </View>
                )}
                
                {hasPermission === null ? (
                  <Text style={styles.statusText}>Requesting camera permission...</Text>
                ) : hasPermission === false ? (
                  <Text style={styles.statusText}>Camera permission denied. Please enable camera access in your device settings.</Text>
                ) : Platform.OS === 'web' ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', borderRadius: 12, background: '#222' }}
                  />
                ) : (
                  <>
                    {!cameraReady && (
                      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', zIndex: 2, backgroundColor: 'rgba(0,0,0,0.2)' }]}> 
                        <Text style={styles.statusText}>Starting camera...</Text>
                      </View>
                    )}
                    
                  </>
                )}
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  facing={'back'}
                  onCameraReady={() => setCameraReady(true)}
                  ratio="1:1"
                  animateShutter={false}
                  zoom={0.2}
                />

              </View>

              {/* Right column for balancing, ensure camera stays centered */}
              <View style={{ width: 60, alignItems: 'center', margin: 5, marginLeft: 12 }}></View>
            </View>
          </View>

          <View style={[styles.buttonRow, { margin: 7, maxWidth: 320 }]}> 
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.button} onPress={handleScan} disabled={ocrLoading}>
              <Text style={styles.buttonText}>{ocrLoading ? 'Scanning...' : 'Scan'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
          </View>

          {/* Preview of captured image and raw OCR text for debugging (toggle via Info) */}
          {showDebug && (
            <View style={{ width: cameraSize, marginTop: 8, alignItems: 'center' }}>
              {capturedImageUri ? (
                <Image
                  source={{ uri: capturedImageUri }}
                  style={{ width: cameraSize, height: Math.round(cameraSize * 0.5), borderRadius: 8, backgroundColor: '#000' }}
                  resizeMode="contain"
                />
              ) : (
                <View style={{ width: cameraSize, height: Math.round(cameraSize * 0.5), borderRadius: 8, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#ddd' }}>No captured image</Text>
                </View>
              )}
              <View style={{ width: cameraSize, marginTop: 8, maxHeight: 160 }}>
                <Text style={{ fontWeight: 'bold', marginBottom: 6 }}>OCR Debug Output</Text>
                <ScrollView style={{ backgroundColor: '#f7f7f7', padding: 8, borderRadius: 8 }}>
                  <Text selectable>{ocrLoading ? 'Processing...' : ocrText}</Text>
                </ScrollView>
              </View>
            </View>
          )}
          
          <View style={{ width: cameraSize }}>
            <View style={styles.tableRow}>
              {columns.map((col, idx) => (
                <View key={col} style={styles.tableCellHeader}>
                  <Text style={styles.headerText}>{col}</Text>
                </View>
              ))}
            </View>
            {/* Render 5 rows, each with 5 columns, showing OCR results and allowing manual entry */}
            {rows.map((_, rowIdx) => (
              <View key={rowIdx} style={styles.tableRow}>
                {columns.map((_, colIdx) => {
                  const cellValue = tableData[rowIdx][colIdx];
                  const valid = isCellValid(colIdx, cellValue);
                  const isCenter = rowIdx === 2 && colIdx === 2;
                  const isDuplicate = duplicatePositions.has(`${rowIdx},${colIdx}`);
                  return (
                    <View
                      key={colIdx}
                      style={[
                        styles.tableCell,
                        !valid && !isCenter && styles.tableCellInvalid,
                        isCenter && { backgroundColor: '#e0ffe0', borderColor: '#388e3c' },
                        isDuplicate && !isCenter && styles.tableCellDuplicate,
                      ]}
                    >
                      {isCenter ? (
                        <Text style={{ fontSize: 13, textAlign: 'center', fontWeight: 'bold', color: '#388e3c' }}>Free</Text>
                      ) : (
                        <TextInput
                          style={{ fontSize: 13, textAlign: 'center', padding: 0 }}
                          value={cellValue}
                          onChangeText={text => insertTextToTable(rowIdx, colIdx, text)}
                          maxLength={2}
                          autoCorrect={false}
                          autoCapitalize="characters"
                          keyboardType='numeric'
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={saveCurrentCard}>
              <Text style={styles.buttonText}>Save Card</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => savedCards.length===0 ? ToastAndroid.show('No cards saved!', ToastAndroid.SHORT) : router.push({ pathname: '/(tabs)/BingoBoards', params: { cardsJSON: JSON.stringify(savedCards) } })} >
              <Text style={styles.buttonText}>Start BINGO</Text>
            </TouchableOpacity>
          </View>
          <View style={{ width: '100%', alignItems: 'center', margin: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 1 }}>
              Cards Saved: {savedCards.length}
            </Text>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, { backgroundColor: '#d32f2f' }]} onPress={handleRemoveAllCards}>
              <Text style={styles.buttonText}>Remove All Cards</Text>
            </TouchableOpacity>
          </View>
          {/* <Text style={styles.statusText}>OCR Result: {ocrLoading ? 'Processing...' : ocrText}</Text> */}
        </ScrollView>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 10,
    backgroundColor: '#fff',
  },
  cameraContainer: {
    borderRadius: 10,
    backgroundColor: '#222',
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: StyleSheet.absoluteFillObject,
  tableRow: {
    flexDirection: 'row',
  },
  tableCellHeader: {
    flex: 1,
    padding: 4,
    borderBottomWidth: 1,
    borderColor: '#bbb',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  tableCell: {
    flex: 1,
    height: 22,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  tableCellInvalid: {
    backgroundColor: '#ffc0c0', // light red for invalid
    borderColor: '#d32f2f',
  },
  tableCellDuplicate: {
    backgroundColor: '#ff8888', // light red for duplicate
    borderColor: '#d32f2f',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 320,
    marginTop: 8,
    gap: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#1976d2',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  smallButton: {
    width: 64,
    backgroundColor: '#1976d2',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  statusText: {
    color: '#444',
    fontSize: 14,
    textAlign: 'center',
    padding: 8,
  },
  cornerOverlay: {
    zIndex: 3,
  },
  gridOverlay: {
    zIndex: 4,
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#fff',
    borderRadius: 2,
  },
  cornerTL: {
    top: 16,
    left: 16,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 16,
    right: 16,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 16,
    left: 16,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 16,
    right: 16,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
});
