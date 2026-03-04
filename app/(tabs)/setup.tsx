
import { Camera, CameraView } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SetupNewGameScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  return (
    <View style={styles.container}>
      <View style={[styles.cameraContainer, { width: cameraSize, height: cameraSize }]}> 
        {/* Corner guides overlay */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cornerOverlay]}>
          {/* Top Left */}
          <View style={[styles.corner, styles.cornerTL]} />
          {/* Top Right */}
          <View style={[styles.corner, styles.cornerTR]} />
          {/* Bottom Left */}
          <View style={[styles.corner, styles.cornerBL]} />
          {/* Bottom Right */}
          <View style={[styles.corner, styles.cornerBR]} />
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
            <CameraView
              ref={cameraRef}
              // style={{ flex: 1, borderRadius: 12 }}
              // facing={'back'}
              // onCameraReady={() => setCameraReady(true)}
              // ratio="1:1"
            />
          </>
        )}
      </View>
      <View style={{ width: cameraSize }}>
        <View style={styles.tableRow}>
          {columns.map((col, idx) => (
            <View key={col} style={styles.tableCellHeader}>
              <Text style={styles.headerText}>{col}</Text>
            </View>
          ))}
        </View>
        {rows.map((_, rowIdx) => (
          <View key={rowIdx} style={styles.tableRow}>
            {columns.map((_, colIdx) => (
              <View key={colIdx} style={styles.tableCell} />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Add Another Card</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Start BINGO</Text>
        </TouchableOpacity>
      </View>
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
    overflow: 'hidden',
    backgroundColor: '#222',
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
