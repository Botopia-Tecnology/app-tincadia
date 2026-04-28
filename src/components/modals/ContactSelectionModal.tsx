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
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLocalContacts } from '../../database/chatDatabase';
import { useTheme } from '../../contexts/ThemeContext';
import { chatService } from '../../services/chat.service';

interface Contact {
    id: string;
    owner_id?: string;
    contact_user_id: string;
    phone: string;
    alias?: string;
    custom_first_name?: string;
    custom_last_name?: string;
    is_global?: boolean; // flag to indicate it's from global search
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
    const { colors, isDark } = useTheme();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchingGlobal, setSearchingGlobal] = useState(false);
    const [globalResults, setGlobalResults] = useState<Contact[]>([]);

    useEffect(() => {
        if (visible) {
            loadContacts();
            setSearchQuery('');
            setGlobalResults([]);
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

    const searchGlobal = async () => {
        if (!searchQuery || searchQuery.length < 3) {
            Alert.alert('Búsqueda global', 'Por favor ingresa al menos 3 caracteres (número o nombre).');
            return;
        }
        
        setSearchingGlobal(true);
        try {
            const response = await chatService.searchGlobalUsers(searchQuery);
            if (response.users && response.users.length > 0) {
                const mapped: Contact[] = response.users
                    .filter((u: any) => u.id !== userId && !existingParticipantIds.has(u.id))
                    .map((u: any) => ({
                        id: `global-${u.id}`,
                        contact_user_id: u.id,
                        phone: u.phone || '',
                        custom_first_name: u.first_name,
                        custom_last_name: u.last_name,
                        is_global: true
                    }));
                    
                setGlobalResults(mapped);
                
                // Hide local filtered if we have global matches to make it clear, 
                // or just append them. We'll replace the view for now if it's a global search explicitly triggered.
                setFilteredContacts(mapped);
            } else {
                Alert.alert('Búsqueda global', 'No se encontraron usuarios en la red con ese dato.');
                setGlobalResults([]);
            }
        } catch (error) {
            Alert.alert('Error', 'No pudimos conectarnos para buscar en la red global.');
        } finally {
            setSearchingGlobal(false);
        }
    };

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (!text.trim()) {
            setFilteredContacts(contacts);
            setGlobalResults([]);
            return;
        }

        const lowerText = text.toLowerCase();
        const filtered = contacts.filter(c => {
            const name = (c.alias || c.custom_first_name || '').toLowerCase();
            const lastName = (c.custom_last_name || '').toLowerCase();
            const phone = (c.phone || '').toLowerCase();

            return name.includes(lowerText) || lastName.includes(lowerText) || phone.includes(lowerText);
        });
        setFilteredContacts(filtered.length > 0 ? filtered : globalResults);
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
                style={[styles.contactItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
                onPress={() => onSelect(item.contact_user_id)}
            >
                <View style={[styles.avatar, { backgroundColor: isDark ? colors.surface : '#D1D5DB' }]}>
                    <Text style={[styles.avatarText, { color: colors.text }]}>{getInitial(displayName)}</Text>
                </View>
                <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, { color: colors.text }]}>
                        {displayName} {item.is_global && <Text style={{fontSize: 10, color: colors.primary}}>(Red Global)</Text>}
                    </Text>
                    {item.phone && <Text style={[styles.contactPhone, { color: colors.textSecondary }]}>{item.phone}</Text>}
                </View>
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
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
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Text style={[styles.closeButtonText, { color: colors.error }]}>Cancelar</Text>
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text }]}>Añadir Participante</Text>
                    <View style={{ width: 60 }} />
                </View>

                {/* Search */}
                <View style={[styles.searchContainer, { backgroundColor: isDark ? colors.inputBg : '#E5E7EB' }]}>
                    <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Buscar en contactos..."
                        value={searchQuery}
                        onChangeText={handleSearch}
                        placeholderTextColor={colors.textMuted}
                        returnKeyType="search"
                        onSubmitEditing={searchGlobal}
                    />
                    {searchQuery.length > 2 && (
                        <TouchableOpacity onPress={searchGlobal} disabled={searchingGlobal}>
                            {searchingGlobal ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Ionicons name="globe-outline" size={20} color={colors.primary} style={{marginLeft: 8}} />
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* List */}
                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={filteredContacts}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.centerContainer}>
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                    {searchQuery.length > 0 
                                        ? 'No se encontraron contactos locales. Toca el ícono del mundo para buscar en toda la plataforma.' 
                                        : 'No tienes contactos disponibles para añadir.'}
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
