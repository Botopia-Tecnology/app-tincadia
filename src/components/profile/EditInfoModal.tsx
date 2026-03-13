import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';

interface EditInfoModalProps {
    visible: boolean;
    title: string;
    initialValue: string;
    onSave: (value: string) => Promise<void>;
    onCancel: () => void;
}

import { useTheme } from '../../contexts/ThemeContext';

export function EditInfoModal({ visible, title, initialValue, onSave, onCancel }: EditInfoModalProps) {
    const { colors, isDark } = useTheme();
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
                            style={[styles.modalView, { backgroundColor: isDark ? colors.card : 'white', shadowColor: colors.shadowColor }]}
                        >
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>

                            <TextInput
                                style={[styles.input, { backgroundColor: isDark ? colors.inputBg : '#FFFFFF', color: colors.text, borderColor: colors.border }]}
                                value={value}
                                onChangeText={setValue}
                                autoFocus={true}
                                selectTextOnFocus={true}
                                placeholderTextColor={colors.textMuted}
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
                                    style={[styles.button, styles.buttonSave, { backgroundColor: colors.primary }]}
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
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E0E0E0',
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
        color: '#007AFF', // You might want to use colors.primary here too if you pass it to styles, but inline is easier
        fontWeight: 'bold',
    },
    textSave: {
        color: 'white',
        fontWeight: 'bold',
    },
});
