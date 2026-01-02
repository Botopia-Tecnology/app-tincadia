import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';

interface EditInfoModalProps {
    visible: boolean;
    title: string;
    initialValue: string;
    onSave: (value: string) => Promise<void>;
    onCancel: () => void;
}

export function EditInfoModal({ visible, title, initialValue, onSave, onCancel }: EditInfoModalProps) {
    const [value, setValue] = useState(initialValue);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue, visible]);

    const handleSave = async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            await onSave(value);
            onCancel();
        } catch (error) {
            console.error('Error saving:', error);
            // Error handling usually done in parent or show alert here
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onCancel}
        >
            <TouchableWithoutFeedback onPress={onCancel}>
                <View style={styles.centeredView}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={styles.modalView}
                        >
                            <Text style={styles.modalTitle}>{title}</Text>

                            <TextInput
                                style={styles.input}
                                value={value}
                                onChangeText={setValue}
                                autoFocus={true}
                                selectTextOnFocus={true}
                            />

                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    style={[styles.button, styles.buttonCancel]}
                                    onPress={onCancel}
                                    disabled={isLoading}
                                >
                                    <Text style={styles.textCancel}>Cancelar</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.button, styles.buttonSave]}
                                    onPress={handleSave}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <Text style={styles.textSave}>Guardar</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 35,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '100%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    input: {
        borderBottomWidth: 2,
        borderBottomColor: '#007AFF', // Tincadia Brand Color? Using standard blue for now or #83A98A
        fontSize: 16,
        paddingVertical: 8,
        marginBottom: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 15,
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        minWidth: 80,
        alignItems: 'center',
    },
    buttonCancel: {
        backgroundColor: 'transparent',
    },
    buttonSave: {
        backgroundColor: '#007AFF',
    },
    textCancel: {
        color: '#007AFF',
        fontWeight: 'bold',
    },
    textSave: {
        color: 'white',
        fontWeight: 'bold',
    },
});
