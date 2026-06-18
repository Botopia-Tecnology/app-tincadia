import React from 'react';
import { View, Text } from 'react-native';
import { dateSeparatorStyles as styles } from '../../../styles/ChatComponents.styles';

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

