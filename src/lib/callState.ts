import { DeviceEventEmitter, Keyboard } from 'react-native';

export const CALL_STATE_CHANGED_EVENT = 'call_state_changed';
export const HANDOFF_ACTIVE_CALL_EVENT = 'handoff_active_call_to_incoming';

function normalizeId(value?: string | null): string | null {
  if (!value) return null;
  const text = String(value).trim();
  return text.length > 0 ? text.toLowerCase() : null;
}

// conversationId -> timestamp when the incoming call was flagged; rings last at
// most ~65s (INCOMING_CALL_RING_TIMEOUT_MS), so entries much older than that are
// stale markers left by events lost while the JS runtime was suspended in
// background. The sweep window below must stay above that ring duration, or it
// would clear calls that are still legitimately ringing.
const activeIncomingConversations = new Map<string, number>();
const incomingCallByNativeId = new Map<string, string>();
let activeCallScreenContext: {
  roomName?: string | null;
  conversationId?: string | null;
  callSessionId?: string | null;
  nativeCallUUID?: string | null;
} | null = null;

function emitCallStateChanged(conversationId?: string | null) {
  DeviceEventEmitter.emit(CALL_STATE_CHANGED_EVENT, {
    conversationId: conversationId || undefined,
  });
}

export const CallState = {
  isInsideCallScreen: false,

  setActiveCallScreen(context: {
    roomName?: string | null;
    conversationId?: string | null;
    callSessionId?: string | null;
    nativeCallUUID?: string | null;
  }) {
    activeCallScreenContext = {
      roomName: normalizeId(context.roomName),
      conversationId: normalizeId(context.conversationId),
      callSessionId: normalizeId(context.callSessionId),
      nativeCallUUID: normalizeId(context.nativeCallUUID),
    };
    this.isInsideCallScreen = true;
  },

  clearActiveCallScreen() {
    activeCallScreenContext = null;
    this.isInsideCallScreen = false;
  },

  matchesActiveCallScreen(context: {
    roomName?: string | null;
    conversationId?: string | null;
    callSessionId?: string | null;
    nativeCallUUID?: string | null;
    callUUID?: string | null;
  }): boolean {
    if (!activeCallScreenContext) return false;

    const roomName = normalizeId(context.roomName);
    const conversationId = normalizeId(context.conversationId);
    const callSessionId = normalizeId(context.callSessionId);
    const nativeCallUUID = normalizeId(context.nativeCallUUID || context.callUUID);

    return Boolean(
      (callSessionId && activeCallScreenContext.callSessionId === callSessionId) ||
      (conversationId && activeCallScreenContext.conversationId === conversationId) ||
      (roomName && activeCallScreenContext.roomName === roomName) ||
      (nativeCallUUID && activeCallScreenContext.nativeCallUUID === nativeCallUUID)
    );
  },

  setIncomingCallActive(conversationId?: string | null, nativeCallId?: string | null) {
    const normalizedConversationId = normalizeId(conversationId);
    if (!normalizedConversationId) return;

    activeIncomingConversations.set(normalizedConversationId, Date.now());
    // If the user was typing when the call arrived, the keyboard must not stay
    // over the incoming/answered call UI. No-op in headless contexts.
    Keyboard.dismiss();

    // Every iOS incoming route (PushKit, CallKeep, incoming_call broadcast)
    // funnels through here but none of them persist the 'call' message; without
    // this sync an open chat never shows the call box live (Android's FCM
    // handler emits these itself — a duplicate emit just re-syncs, harmless).
    const rawConversationId = String(conversationId).trim();
    DeviceEventEmitter.emit('chat_sync_requested', rawConversationId);
    DeviceEventEmitter.emit('chat_local_update', rawConversationId);

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

  getIncomingCallConversationId(conversationIdOrNativeId?: string | null): string | undefined {
    const normalizedId = normalizeId(conversationIdOrNativeId);
    if (!normalizedId) return undefined;

    return incomingCallByNativeId.get(normalizedId) || (
      activeIncomingConversations.has(normalizedId) ? normalizedId : undefined
    );
  },

  clearAllIncomingCalls() {
    if (activeIncomingConversations.size === 0 && incomingCallByNativeId.size === 0) return;

    activeIncomingConversations.clear();
    incomingCallByNativeId.clear();
    emitCallStateChanged();
  },

  getStaleIncomingConversationIds(maxAgeMs = 90_000): string[] {
    const now = Date.now();
    const stale: string[] = [];
    for (const [conversationId, since] of activeIncomingConversations.entries()) {
      if (now - since > maxAgeMs) stale.push(conversationId);
    }
    return stale;
  },

  hasIncomingCall(conversationId?: string | null): boolean {
    const normalizedConversationId = normalizeId(conversationId);
    return Boolean(normalizedConversationId && activeIncomingConversations.has(normalizedConversationId));
  },
};
