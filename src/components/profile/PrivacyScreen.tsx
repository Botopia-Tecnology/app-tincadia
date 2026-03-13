import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/auth.service';
import { BackArrowIcon } from '../icons/NavigationIcons';
import { KeyboardSafeView } from '../common/KeyboardSafeView';
import { profileScreenStyles as styles } from '../../styles/ProfileScreen.styles';
import { useTheme } from '../../contexts/ThemeContext';

interface PrivacyScreenProps {
    onBack: () => void;
}

export function PrivacyScreen({ onBack }: PrivacyScreenProps) {
    const { user, refreshProfile } = useAuth();
    const { colors, isDark } = useTheme();
    const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            // Assuming user object now has this property from the backend update
            // We might need to handle the case where it's undefined initially or check types
            setReadReceiptsEnabled(user.readReceiptsEnabled ?? true);
        }
    }, [user]);

    const toggleSwitch = async () => {
        if (!user) return;
        const newValue = !readReceiptsEnabled;
        setReadReceiptsEnabled(newValue); // Optimistic update
        setIsLoading(true);

        try {
            await authService.updateProfile(user.id, { readReceiptsEnabled: newValue });
            await refreshProfile();
        } catch (error) {
            console.error('Error updating privacy settings:', error);
            setReadReceiptsEnabled(!newValue); // Revert
            Alert.alert('Error', 'No se pudo actualizar la configuración.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardSafeView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar style={colors.statusBar} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background }]}>
                <TouchableOpacity style={[styles.backButton, { backgroundColor: isDark ? colors.card : '#F5F5F5' }]} onPress={onBack}>
                    <BackArrowIcon size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Privacidad</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={[styles.content, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 100 }}>

                <View style={[styles.fieldGroup, { backgroundColor: colors.background, borderColor: colors.border, borderTopWidth: 1, borderBottomWidth: 1 }]}>
                    <View style={[styles.fieldItem, { backgroundColor: colors.background }]}>
                        <View style={[styles.fieldInfo, { marginRight: 16 }]}>
                            <Text style={[styles.fieldLabel, { marginLeft: 0, fontSize: 16, color: colors.text }]}>Confirmaciones de lectura</Text>
                            <Text style={[styles.fieldSubtext, { marginLeft: 0, marginTop: 4, color: colors.textSecondary }]}>
                                Si desactivas esta opción, no podrás ver las confirmaciones de lectura de otras personas. Las confirmaciones de lectura se enviarán siempre en los chats grupales.
                            </Text>
                        </View>
                        <Switch
                            trackColor={{ false: "#767577", true: colors.primary }}
                            thumbColor={readReceiptsEnabled ? "#FFFFFF" : "#f4f3f4"}
                            ios_backgroundColor="#3e3e3e"
                            onValueChange={toggleSwitch}
                            value={readReceiptsEnabled}
                            disabled={isLoading}
                        />
                    </View>
                </View>

            </ScrollView>
        </KeyboardSafeView>
    );
}
