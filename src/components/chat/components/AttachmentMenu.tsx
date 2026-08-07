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
  onTakePhoto: () => void;
  onRecordVideo: () => void;
  onRecordVideoNote: () => void;
}

export function AttachmentMenu({
  visible,
  onClose,
  onPickMedia,
  onPickDocument,
  onTakePhoto,
  onRecordVideo,
  onRecordVideoNote,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const actions = [
    {
      key: 'document',
      label: 'Documento',
      icon: 'document-text' as const,
      color: '#5c56d6',
      onPress: onPickDocument,
    },
    {
      key: 'gallery',
      label: 'Galería',
      icon: 'image' as const,
      color: '#ff2d55',
      onPress: onPickMedia,
    },
    {
      key: 'camera',
      label: 'Fotografía',
      icon: 'camera' as const,
      color: '#34c759',
      onPress: onTakePhoto,
    },
    {
      key: 'video',
      label: 'Video',
      icon: 'videocam' as const,
      color: '#007aff',
      onPress: onRecordVideo,
    },
    {
      key: 'video_note',
      label: 'Nota de video',
      icon: 'radio-button-on' as const,
      color: '#25D366',
      onPress: onRecordVideoNote,
    },
  ];

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
            { backgroundColor: colors.card, paddingBottom: Math.max(40, insets.bottom + 20) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.grid}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.actionItem}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: action.color }]}>
                  <Ionicons name={action.icon} size={28} color="#FFF" />
                </View>
                <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 24,
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
