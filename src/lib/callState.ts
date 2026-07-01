import { DeviceEventEmitter } from 'react-native';

export const CALL_STATE_CHANGED_EVENT = 'call_state_changed';

function normalizeId(value?: string | null): string | null {
  if (!value) return null;
  const text = String(value).trim();
  return text.length > 0 ? text.toLowerCase() : null;
}

const activeIncomingConversations = new Set<string>();
const incomingCallByNativeId = new Map<string, string>();

function emitCallStateChanged(conversationId?: string | null) {
  DeviceEventEmitter.emit(CALL_STATE_CHANGED_EVENT, {
    conversationId: conversationId || undefined,
  });
}

export const CallState = {
  isInsideCallScreen: false,

  setIncomingCallActive(conversationId?: string | null, nativeCallId?: string | null) {
    const normalizedConversationId = normalizeId(conversationId);
    if (!normalizedConversationId) return;

    activeIncomingConversations.add(normalizedConversationId);

    const normalizedNativeCallId = normalizeId(nativeCallId);
    if (normalizedNativeCallId) {
      incomingCallByNativeId.set(normalizedNativeCallId, normalizedConversationId);
    }

    emitCallStateChanged(normalizedConversationId);
  },

  clearIncomingCall(conversationIdOrNativeId?: string | null) {
    const normalizedId = normalizeId(conversationIdOrNativeId);
    if (!normalizedId) return;

    const conversationId = incomingCallByNativeId.get(normalizedId) || normalizedId;
    incomingCallByNativeId.delete(normalizedId);
    activeIncomingConversations.delete(conversationId);

    for (const [nativeId, mappedConversationId] of incomingCallByNativeId.entries()) {
      if (mappedConversationId === conversationId) {
        incomingCallByNativeId.delete(nativeId);
      }
    }

    emitCallStateChanged(conversationId);
  },

  clearAllIncomingCalls() {
    if (activeIncomingConversations.size === 0 && incomingCallByNativeId.size === 0) return;

    activeIncomingConversations.clear();
    incomingCallByNativeId.clear();
    emitCallStateChanged();
  },

  hasIncomingCall(conversationId?: string | null): boolean {
    const normalizedConversationId = normalizeId(conversationId);
    return Boolean(normalizedConversationId && activeIncomingConversations.has(normalizedConversationId));
  },
};
