import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DateSeparatorProps {
    date: Date;
}

export const DateSeparator = ({ date }: DateSeparatorProps) => {
    const getDateLabel = (date: Date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const d = new Date(date);

        if (d.toDateString() === today.toDateString()) {
            return 'Hoy';
        } else if (d.toDateString() === yesterday.toDateString()) {
            return 'Ayer';
        } else {
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.bubble}>
                <Text style={styles.text}>{getDateLabel(date)}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: 12,
        marginBottom: 8,
    },
    bubble: {
        backgroundColor: 'rgba(229, 231, 235, 0.8)', // gray-200 with opacity
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    text: {
        fontSize: 12,
        color: '#4B5563', // gray-600
        fontWeight: '600',
    },
});
