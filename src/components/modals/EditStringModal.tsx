import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard
} from 'react-native';

interface EditStringModalProps {
    visible: boolean;
    title: string;
    initialValue: string;
    placeholder?: string;
    onSave: (value: string) => void;
    onCancel: () => void;
}

export const EditStringModal: React.FC<EditStringModalProps> = ({
    visible,
    title,
    initialValue,
    placeholder,
    onSave,
    onCancel,
}) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (visible) {
            setValue(initialValue);
        }
    }, [visible, initialValue]);

    const handleSave = () => {
        onSave(value);
        setValue('');
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <TouchableWithoutFeedback onPress={onCancel}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={styles.keyboardView}
                        >
                            <View style={styles.modalContainer}>
                                <Text style={styles.title}>{title}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={value}
                                    onChangeText={setValue}
                                    placeholder={placeholder}
                                    autoFocus
                                    multiline={title.toLowerCase().includes('descripción')}
                                    numberOfLines={title.toLowerCase().includes('descripción') ? 3 : 1}
                                />
                                <View style={styles.buttonContainer}>
                                    <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                                        <Text style={styles.cancelButtonText}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                        <Text style={styles.saveButtonText}>Guardar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </KeyboardAvoidingView>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyboardView: {
        width: '100%',
        alignItems: 'center',
    },
    modalContainer: {
        width: '85%',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#1F2937',
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        fontSize: 16,
        color: '#374151',
        backgroundColor: '#F9FAFB',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cancelButton: {
        flex: 1,
        padding: 12,
        marginRight: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#4B5563',
        fontWeight: '600',
        fontSize: 16,
    },
    saveButton: {
        flex: 1,
        padding: 12,
        marginLeft: 8,
        backgroundColor: '#10B981',
        borderRadius: 8,
        alignItems: 'center',
    },
    saveButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
});
