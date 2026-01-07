import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    FlatList,
    StyleSheet,
    TextInput,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Country {
    code: string;
    name: string;
    flag: string;
    dialCode: string;
}

// Common countries list - can be expanded
const COUNTRIES: Country[] = [
    { code: 'CO', name: 'Colombia', flag: '🇨🇴', dialCode: '+57' },
    { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
    { code: 'MX', name: 'Mexico', flag: '🇲🇽', dialCode: '+52' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸', dialCode: '+34' },
    { code: 'AR', name: 'Argentina', flag: '🇦🇷', dialCode: '+54' },
    { code: 'CL', name: 'Chile', flag: '🇨🇱', dialCode: '+56' },
    { code: 'PE', name: 'Peru', flag: '🇵🇪', dialCode: '+51' },
    { code: 'EC', name: 'Ecuador', flag: '🇪🇨', dialCode: '+593' },
    { code: 'VE', name: 'Venezuela', flag: '🇻🇪', dialCode: '+58' },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷', dialCode: '+55' },
];

interface CountryCodePickerProps {
    selectedCountry: Country;
    onSelect: (country: Country) => void;
}

export const defaultCountry = COUNTRIES[0]; // Colombia default

export function CountryCodePicker({ selectedCountry, onSelect }: CountryCodePickerProps) {
    const [modalVisible, setModalVisible] = useState(false);

    return (
        <>
            <TouchableOpacity
                style={styles.container}
                onPress={() => setModalVisible(true)}
            >
                <Text style={styles.flag}>{selectedCountry.flag}</Text>
                <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalVisible(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.header}>
                            <Text style={styles.title}>Seleccionar País</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#000" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={COUNTRIES}
                            keyExtractor={(item) => item.code}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.countryItem}
                                    onPress={() => {
                                        onSelect(item);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text style={styles.itemFlag}>{item.flag}</Text>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    <Text style={styles.itemDialCode}>{item.dialCode}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    flag: {
        fontSize: 20,
        marginRight: 6,
    },
    dialCode: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
        marginRight: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    itemFlag: {
        fontSize: 24,
        marginRight: 12,
    },
    itemName: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    itemDialCode: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
});
