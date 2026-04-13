import textRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { Camera, CameraView } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Platform, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View } from 'react-native';

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

  // Table state for OCR results (5x5 grid)
  const [tableData, setTableData] = useState<string[][]>(Array.from({ length: 5 }, () => Array(5).fill('')));

  // Array of bingo cards (each is a 5x5 array)
  const [savedCards, setSavedCards] = useState<string[][][]>([]);

  // Function to insert text into the table by row and column
  const insertTextToTable = (row: number, col: number, text: string) => {
    setTableData(prev => {
      const newData = prev.map(arr => [...arr]);
      newData[row][col] = text;
      return newData;
    });
  };

  // Function to check if a cell's value is valid
  const isCellValid = (text: string) => {
    // TODO: Insert validation logic here. Return true if valid, false if not.
    // Example: return /^[0-9]+$/.test(text);
    return true;
  };

  // Save current table as a card
  const saveCurrentCard = () => {
    setSavedCards(prev => [...prev, tableData.map(row => [...row])]);
    setTableData(Array.from({ length: 5 }, () => Array(5).fill('')));
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
        // Web OCR logic
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
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
      } else if (!isWeb && hasPermission && cameraReady && cameraRef.current) {
        // Mobile OCR logic
        // @ts-ignore
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5, skipProcessing: true, animateShutter: false });
        if (photo && photo.uri) {
          // Get image dimensions
          const { width: imgWidth, height: imgHeight } = photo;
          const gridRows = 5;
          const gridCols = 5;
          const cellWidth = imgWidth / gridCols;
          const cellHeight = imgHeight / gridRows;
          const tilePromises: Promise<{ row: number; col: number; text: string }>[][] = [];
          for (let row = 0; row < gridRows; row++) {
            const rowPromises: Promise<{ row: number; col: number; text: string }>[] = [];
            for (let col = 0; col < gridCols; col++) {
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
    } catch (e) {
      setOcrText('OCR error');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleRemoveAllCards = () => {
    setSavedCards([]);
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
        <View style={{ width: '100%', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', letterSpacing: 1 }}>
            Scan Your Cards
          </Text>
        </View>
        <View style={[styles.cameraContainer, { width: cameraSize, height: cameraSize }]}> 
          {/* Corner guides overlay */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cornerOverlay]}>
            {/* Top Left */}
            <Animated.View style={[
              styles.corner,
              {
                top: cornerOffset,
                left: cornerOffset,
              },
              styles.cornerTL,
            ]} />
            {/* Top Right */}
            <Animated.View style={[
              styles.corner,
              {
                top: cornerOffset,
                right: cornerOffset,
              },
              styles.cornerTR,
            ]} />
            {/* Bottom Left */}
            <Animated.View style={[
              styles.corner,
              {
                bottom: cornerOffset,
                left: cornerOffset,
              },
              styles.cornerBL,
            ]} />
            {/* Bottom Right */}
            <Animated.View style={[
              styles.corner,
              {
                bottom: cornerOffset,
                right: cornerOffset,
              },
              styles.cornerBR,
            ]} />
          </View>
          {/* 6x5 Grid Overlay */}
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

        <View style={[styles.buttonRow, { margin: 12, maxWidth: 200 }]}>
          <TouchableOpacity style={styles.button} onPress={handleScan} disabled={ocrLoading}>
            <Text style={styles.buttonText}>{ocrLoading ? 'Scanning...' : 'Scan'}</Text>
          </TouchableOpacity>
        </View>
        
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
                const valid = isCellValid(cellValue);
                return (
                  <View
                    key={colIdx}
                    style={[styles.tableCell, !valid && styles.tableCellInvalid]}
                  >
                    <TextInput
                      style={{ fontSize: 13, textAlign: 'center', padding: 0 }}
                      value={cellValue}
                      onChangeText={text => insertTextToTable(rowIdx, colIdx, text)}
                      maxLength={4}
                      autoCorrect={false}
                      autoCapitalize="characters"
                    />
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
      </View>
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
  cameraContainer: {
    borderRadius: 10,
    backgroundColor: '#222',
    marginBottom: 10,
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
    backgroundColor: '#ffe0e0', // light red for invalid
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
