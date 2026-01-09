import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    TextInput,
    ActivityIndicator,
    TouchableWithoutFeedback,
    Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLocalContacts } from '../../database/chatDatabase';

interface Contact {
    id: string; // our local DB id
    owner_id: string;
    contact_user_id: string;
    phone: string;
    alias: string;
    custom_first_name: string;
    custom_last_name: string;
    updated_at: string;
}

interface ContactSelectionModalProps {
    visible: boolean;
    userId: string;
    existingParticipantIds: Set<string>;
    onSelect: (contactUserId: string) => void;
    onClose: () => void;
}

export const ContactSelectionModal: React.FC<ContactSelectionModalProps> = ({
    visible,
    userId,
    existingParticipantIds,
    onSelect,
    onClose,
}) => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            loadContacts();
            setSearchQuery('');
        }
    }, [visible]);

    const loadContacts = () => {
        setLoading(true);
        try {
            const allContacts = getLocalContacts(userId);
            // Filter out existing participants
            const available = allContacts.filter(c => !existingParticipantIds.has(c.contact_user_id));
            setContacts(available);
            setFilteredContacts(available);
        } catch (error) {
            console.error('Error loading contacts for selection:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (!text.trim()) {
            setFilteredContacts(contacts);
            return;
        }

        const lowerText = text.toLowerCase();
        const filtered = contacts.filter(c => {
            const name = (c.alias || c.custom_first_name || '').toLowerCase();
            const lastName = (c.custom_last_name || '').toLowerCase();
            const phone = (c.phone || '').toLowerCase();

            return name.includes(lowerText) || lastName.includes(lowerText) || phone.includes(lowerText);
        });
        setFilteredContacts(filtered);
    };

    const getDisplayName = (c: Contact) => {
        if (c.alias) return c.alias;
        if (c.custom_first_name || c.custom_last_name) {
            return `${c.custom_first_name || ''} ${c.custom_last_name || ''}`.trim();
        }
        return c.phone || 'Usuario';
    };

    const getInitial = (name: string) => {
        return name.charAt(0).toUpperCase();
    };

    const renderItem = ({ item }: { item: Contact }) => {
        const displayName = getDisplayName(item);

        return (
            <TouchableOpacity
                style={styles.contactItem}
                onPress={() => onSelect(item.contact_user_id)}
            >
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitial(displayName)}</Text>
                </View>
                <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{displayName}</Text>
                    {item.phone && <Text style={styles.contactPhone}>{item.phone}</Text>}
                </View>
                <Ionicons name="add-circle-outline" size={24} color="#10B981" />
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Text style={styles.closeButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Añadir Participante</Text>
                    <View style={{ width: 60 }} />
                </View>

                {/* Search */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar contacto..."
                        value={searchQuery}
                        onChangeText={handleSearch}
                        placeholderTextColor="#9CA3AF"
                    />
                </View>

                {/* List */}
                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#10B981" />
                    </View>
                ) : (
                    <FlatList
                        data={filteredContacts}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.centerContainer}>
                                <Text style={styles.emptyText}>
                                    {contacts.length === 0
                                        ? 'No tienes contactos disponibles para añadir.'
                                        : 'No se encontraron resultados.'}
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1F2937',
    },
    closeButton: {
        padding: 8,
    },
    closeButtonText: {
        color: '#EF4444',
        fontSize: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E5E7EB',
        borderRadius: 10,
        margin: 16,
        paddingHorizontal: 12,
        height: 40,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#374151',
    },
    listContent: {
        paddingBottom: 40,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40,
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#374151',
        fontWeight: 'bold',
        fontSize: 18,
    },
    contactInfo: {
        flex: 1,
    },
    contactName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1F2937',
    },
    contactPhone: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
});
