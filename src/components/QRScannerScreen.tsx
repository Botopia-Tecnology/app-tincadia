import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Button } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { BackArrowIcon } from './icons/NavigationIcons';

interface QRScannerScreenProps {
    onClose: () => void;
    onScan: (data: string) => void;
}

export function QRScannerScreen({ onClose, onScan }: QRScannerScreenProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, [permission]);

    if (!permission) {
        // Camera permissions are still loading
        return <View />;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet
        return (
            <View style={styles.container}>
                <Text style={{ textAlign: 'center', marginBottom: 20 }}>
                    Necesitamos acceso a la cámara para escanear códigos QR.
                </Text>
                <Button onPress={requestPermission} title="Conceder Permiso" />
                <TouchableOpacity onPress={onClose} style={{ marginTop: 20 }}>
                    <Text style={{ color: 'blue' }}>Cancelar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
        if (scanned) return;
        setScanned(true);
        // Vibrate or play sound here if desired
        onScan(data);
        // Alert.alert(`Código escaneado`, `Tipo: ${type}\nDatos: ${data}`, [
        //     { text: 'OK', onPress: () => setScanned(false) }
        // ]);
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
            >
                <View style={styles.overlay}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <BackArrowIcon size={30} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Escanear QR</Text>
                        <View style={{ width: 30 }} />
                    </View>

                    <View style={styles.scanFrameContainer}>
                        <View style={styles.scanFrame} />
                        <Text style={styles.instructionText}>
                            Apunta la cámara al código QR
                        </Text>
                    </View>
                </View>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    closeButton: {
        padding: 10,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    scanFrameContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: 'transparent',
        borderRadius: 20,
    },
    instructionText: {
        color: '#FFFFFF',
        marginTop: 20,
        fontSize: 16,
    },
});
