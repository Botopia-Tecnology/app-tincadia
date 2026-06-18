import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPickMedia: () => void;
  onPickDocument: () => void;
}

export function AttachmentMenu({ visible, onClose, onPickMedia, onPickDocument }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable 
          style={[
            styles.sheet, 
            { backgroundColor: colors.card, paddingBottom: Math.max(40, insets.bottom + 20) }
          ]} 
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.grid}>
            <TouchableOpacity 
              style={styles.actionItem} 
              onPress={() => {
                onClose();
                onPickDocument();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#5c56d6' }]}>
                <Ionicons name="document-text" size={28} color="#FFF" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Documento</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionItem} 
              onPress={() => {
                onClose();
                onPickMedia();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#ff2d55' }]}>
                <Ionicons name="image" size={28} color="#FFF" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Galería</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
  },
  actionItem: {
    alignItems: 'center',
    width: 80,
    gap: 8,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
