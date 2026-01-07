import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Image,
    SafeAreaView,
    Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { chatService } from '../services/chat.service';
import { contactService, Contact } from '../services/contact.service';
import { BackArrowIcon, CheckIcon } from './icons/NavigationIcons'; // Assuming CheckIcon exists or I'll use text
import { useAlert } from '../components/common/CustomAlert';

interface NewGroupScreenProps {
    onNavigate: (screen: 'chats', params?: any) => void;
    onBack: () => void;
    userId: string;
}

export function NewGroupScreen({ onNavigate, onBack, userId }: NewGroupScreenProps) {
    const alert = useAlert();
    const [step, setStep] = useState<1 | 2>(1);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        setIsLoading(true);
        try {
            const response = await contactService.getContacts(userId);
            setContacts(response.contacts || []);
        } catch (error) {
            console.error('Error loading contacts', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleContact = (contactId: string) => {
        const newSelected = new Set(selectedContactIds);
        if (newSelected.has(contactId)) {
            newSelected.delete(contactId);
        } else {
            newSelected.add(contactId);
        }
        setSelectedContactIds(newSelected);
    };

    const handleNext = () => {
        if (selectedContactIds.size === 0) {
            alert.show({
                type: 'warning',
                title: 'Atención',
                message: 'Debes seleccionar al menos un participante.'
            });
            return;
        }
        setStep(2);
    };

    const handleCreateGroup = async () => {
        if (!title.trim()) {
            alert.show({
                type: 'warning',
                title: 'Atención',
                message: 'El grupo debe tener un nombre.'
            });
            return;
        }

        setIsCreating(true);
        try {
            const { conversationId } = await chatService.createGroup({
                creatorId: userId,
                title: title.trim(),
                description: description.trim(),
                participants: Array.from(selectedContactIds),
                // imageUrl: ... implementation for image upload later
            });

            alert.show({
                type: 'success',
                title: 'Grupo creado',
                message: 'El grupo se ha creado exitosamente.',
                buttons: [{
                    text: 'Ir al chat',
                    style: 'default',
                    onPress: () => onNavigate('chats', { conversationId, isGroup: true, title: title.trim() })
                }]
            });
        } catch (error: any) {
            alert.show({
                type: 'error',
                title: 'Error',
                message: error.message || 'No se pudo crear el grupo.'
            });
        } finally {
            setIsCreating(false);
        }
    };

    const renderContactItem = ({ item }: { item: Contact }) => {
        const participantId = item.contactUserId;
        const isSelected = selectedContactIds.has(participantId);
        const displayName = item.alias || item.customFirstName || item.phone;
        const initials = displayName.charAt(0).toUpperCase();

        return (
            <TouchableOpacity
                style={[styles.contactItem, isSelected && styles.contactItemSelected]}
                onPress={() => toggleContact(participantId)}
            >
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                    {isSelected && (
                        <View style={styles.checkBadge}>
                            <Text style={{ color: 'white', fontSize: 10 }}>✓</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.contactName}>{displayName}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={step === 1 ? onBack : () => setStep(1)} style={styles.backButton}>
                    <BackArrowIcon color="#FFFFFF" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>{step === 1 ? 'Nuevo Grupo' : 'Info del Grupo'}</Text>
                    <Text style={styles.headerSubtitle}>
                        {step === 1 ? 'Añadir participantes' : `${selectedContactIds.size} seleccionados`}
                    </Text>
                </View>
            </View>

            <View style={styles.content}>
                {step === 1 ? (
                    <>
                        {isLoading ? (
                            <ActivityIndicator size="large" color="#7FA889" style={{ marginTop: 50 }} />
                        ) : (
                            <FlatList
                                data={contacts}
                                keyExtractor={(item) => item.id}
                                renderItem={renderContactItem}
                                contentContainerStyle={{ padding: 16 }}
                            />
                        )}

                        {/* FAB Next */}
                        {selectedContactIds.size > 0 && (
                            <TouchableOpacity style={styles.fab} onPress={handleNext}>
                                <Text style={styles.fabText}>→</Text>
                            </TouchableOpacity>
                        )}
                    </>
                ) : (
                    <View style={styles.step2Container}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Nombre del Grupo</Text>
                            <TextInput
                                style={styles.input}
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Escribe el nombre del grupo"
                                placeholderTextColor="#9CA3AF"
                                autoFocus
                            />
                        </View>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Descripción (Opcional)</Text>
                            <TextInput
                                style={styles.input}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Descripción del grupo"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.createButton}
                            onPress={handleCreateGroup}
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.createButtonText}>Crear Grupo</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'android' ? 40 : 16,
        paddingBottom: 16,
        paddingHorizontal: 16,
        backgroundColor: '#1F2937',
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    backButton: {
        marginRight: 16,
        padding: 4,
    },
    headerTitle: {
        color: '#F9FAFB',
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    content: {
        flex: 1,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    contactItemSelected: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)', // Light blue tint
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#4B5563',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        position: 'relative'
    },
    avatarText: {
        color: '#F9FAFB',
        fontWeight: 'bold',
    },
    checkBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#10B981',
        borderRadius: 10,
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#111827'
    },
    contactName: {
        color: '#F9FAFB',
        fontSize: 16,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
    },
    fabText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    step2Container: {
        padding: 24,
        flex: 1,
    },
    inputContainer: {
        marginBottom: 24,
    },
    label: {
        color: '#D1D5DB',
        fontSize: 14,
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#374151',
        borderRadius: 8,
        padding: 12,
        color: '#F9FAFB',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#4B5563',
    },
    createButton: {
        backgroundColor: '#10B981',
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 24,
    },
    createButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    }
});
