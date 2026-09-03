import { Platform } from 'react-native';
import RNCallKeep, { CONSTANTS } from 'react-native-callkeep';
import VoipPushNotification from 'react-native-voip-push-notification';
import { DeviceEventEmitter } from 'react-native';
import { CallState } from '../lib/callState';
import { pendingCallActionStorage } from '../lib/secure-storage';

type NativeCallContext = {
  roomName?: string;
  conversationId?: string;
  callSessionId?: string;
  senderId?: string;
  senderName?: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createUuid(): string {
  const randomUUID = ((globalThis as any).crypto as { randomUUID?: () => string } | undefined)?.randomUUID;
  if (typeof randomUUID === 'function') return randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

function normalizeCallKey(value: string): string {
  return value.toLowerCase();
}

function getStringValue(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function asPayloadObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

const CALL_NOTIFICATION_TYPES = new Set(['call', 'incoming_call', 'call_ended', 'call_missed', 'call_rejected']);
const TERMINAL_CALL_NOTIFICATION_TYPES = new Set(['call_ended', 'call_missed', 'call_rejected']);
// Debe ser MENOR que el expiry del push VoIP en el servidor (8s para
// 'incoming_call', ver chat-ms/notifications.service.ts). Con ambos en 30s la
// guarda nunca llegaba a actuar: APNs podia retener el push 29s y entregarlo,
// y el cliente lo aceptaba por no superar el umbral. El resultado era la
// llamada entrante fantasma de ~2s tras colgar el emisor.
const STALE_CALL_PUSH_MS = 10_000;
/**
 * How long the native incoming banner stays up before it is dismissed as missed.
 *
 * Deliberately longer than the caller's UNANSWERED_CALL_TIMEOUT_MS in
 * CallScreen.tsx (60s): the caller gives up first and its terminal event lands
 * while this banner is still alive. Shortening this below the caller's timeout
 * would leave a ghost banner ringing after the caller already hung up.
 */
const INCOMING_CALL_RING_TIMEOUT_MS = 65_000;

function getBoundedString(value: unknown, maxLength = 256): string | undefined {
  const text = getStringValue(value);
  return text && text.length <= maxLength ? text : undefined;
}

function normalizeCallNotificationPayload(value: unknown): Record<string, string> | undefined {
  const data = asPayloadObject(value);
  const type = getBoundedString(data.type, 32) || 'call';
  if (!CALL_NOTIFICATION_TYPES.has(type)) return undefined;

  const normalized: Record<string, string> = { type };
  const fields: Array<[string, unknown, number]> = [
    ['nativeCallUUID', data.nativeCallUUID, 128],
    ['callUUID', data.callUUID, 128],
    ['uuid', data.uuid, 128],
    ['originalCallUUID', data.originalCallUUID, 128],
    ['roomName', data.roomName, 256],
    ['conversationId', data.conversationId, 128],
    ['callSessionId', data.callSessionId || data.call_session_id, 128],
    ['senderId', data.senderId || data.sender_id, 128],
    ['senderName', data.senderName || data.callerName, 120],
    ['callerName', data.callerName || data.senderName, 120],
    ['handle', data.handle, 120],
  ];

  fields.forEach(([key, rawValue, maxLength]) => {
    const safeValue = getBoundedString(rawValue, maxLength);
    if (safeValue) normalized[key] = safeValue;
  });

  const callIdentifier = normalized.nativeCallUUID || normalized.callUUID || normalized.uuid ||
    normalized.roomName || normalized.conversationId || normalized.originalCallUUID;
  if (!callIdentifier) return undefined;

  return normalized;
}

const options = {
  ios: {
    appName: 'Tincadia',
    handleType: 'generic',
    supportsVideo: true,
    includesCallsInRecents: true,
    maximumCallGroups: '2',
    maximumCallsPerCallGroup: '1',
  },
  android: {
    alertTitle: 'Permisos requeridos',
    alertDescription:
      'Tincadia necesita tu permiso para manejar llamadas entrantes. ' +
      'Si no activas la cuenta de llamadas de Tincadia, no podrás recibir ' +
      'llamadas cuando la aplicación esté en segundo plano o cerrada.',
    cancelButton: 'Cancelar',
    okButton: 'Aceptar',
    imageName: 'phone_account_icon',
    additionalPermissions: [],
    foregroundService: {
      channelId: 'tincadia_calls',
      channelName: 'Llamadas Tincadia',
      notificationTitle: 'Tincadia está en una llamada',
      notificationIcon: 'ic_launcher'
    }
  }
};

class CallKeepService {
  private initialized = false;
  private setupPromise: Promise<void> = Promise.resolve();
  private voipPushInitialized = false;
  private voipTokenHandler?: (token: string) => void;
  /** Native UUIDs ended by app cleanup; only matching endCall events are suppressed. */
  private suppressedEndCallUUIDs: Set<string> = new Set();
  private suppressedEndCallTimers: Map<string, NodeJS.Timeout> = new Map();
  /** Native UUIDs answered from app UI; suppresses the native answer event to avoid double navigation. */
  private suppressedAnswerCallUUIDs: Set<string> = new Set();
  private suppressedAnswerCallTimers: Map<string, NodeJS.Timeout> = new Map();
  private incomingCallTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private nativeCallContexts: Map<string, NativeCallContext> = new Map();
  private nativeCallAliases: Map<string, string> = new Map();
  private displayedNativeCallUUIDs: Set<string> = new Set();
  /**
   * Tombstones for call sessions that already ended on this device.
   *
   * The backend derives a stable CallKit UUID from callSessionId, so a VoIP
   * push still in flight when the user hangs up (or APNs retrying one) arrives
   * carrying the UUID of the call that just ended. forgetNativeCall() wipes
   * displayedNativeCallUUIDs, so the duplicate guard in displayIncomingCall no
   * longer recognises it and CallKit paints a ghost incoming banner that
   * disappears a second later. Keys are UUID + every alias (conversationId,
   * roomName, callSessionId) so a late push can be matched by any of them.
   */
  private endedCallKeys: Map<string, number> = new Map();

  resolveCallUUID(uuid: string) {
    return this.nativeCallAliases.get(normalizeCallKey(uuid)) || uuid;
  }

  registerIncomingCallContext(nativeUUID: string, requestedUUID: string, context: NativeCallContext = {}, nativeDisplayed = false) {
    this.rememberNativeCall(nativeUUID, requestedUUID, context);
    if (nativeDisplayed) {
      this.displayedNativeCallUUIDs.add(nativeUUID);
      CallState.setIncomingCallActive(context.conversationId, nativeUUID);
    }
  }

  getIncomingCallContext(uuid: string): NativeCallContext | undefined {
    const context = this.getNativeCallContext(uuid);
    return context ? { ...context } : undefined;
  }

  private canUseNativeUUID(uuid: string, operation: string) {
    if (Platform.OS !== 'ios' || UUID_REGEX.test(uuid)) return true;
    console.warn(`[CallKeep] Skipping ${operation}: iOS CallKit requires a valid UUID, got:`, uuid);
    return false;
  }

  private getNativeUUIDKey(uuid: string) {
    return normalizeCallKey(this.resolveCallUUID(uuid));
  }

  /**
   * Marca un colgado como interno, para que el evento nativo `endCall` que
   * llegue despues NO se interprete como rechazo del usuario.
   *
   * Se registra bajo TODOS los identificadores conocidos de la llamada, no solo
   * el UUID nativo resuelto. Motivo: quien llama a esto (endCallSilently)
   * ejecuta forgetNativeCall justo despues, que borra los alias — y el evento
   * nativo llega de forma asincrona, cuando ya no hay con que resolver. Si el
   * fabricante devuelve el UUID en otro formato (el original en vez del nativo,
   * o distinta capitalizacion), la supresion no se encontraba y el colgado para
   * pasar a la llamada de la app se registraba como rechazo.
   *
   * Eso explicaba que fallara solo en algunos dispositivos: depende del UUID
   * que devuelva cada capa de Android.
   */
  private suppressEndCallOnce(uuid: string) {
    const nativeUUID = this.resolveCallUUID(uuid);
    const context = this.nativeCallContexts.get(normalizeCallKey(nativeUUID));

    // Aqui SI se incluyen conversationId y roomName, al reves que en
    // markSessionTerminated/markCallEnded: esto solo vive 8s y su unico fin es
    // reconocer el evento nativo inmediato, que puede llegar con cualquiera de
    // estos identificadores. La ventana es demasiado corta para estorbar a una
    // rellamada.
    const claves = [uuid, nativeUUID, context?.conversationId, context?.roomName, context?.callSessionId]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map(normalizeCallKey);

    Array.from(new Set(claves)).forEach((key) => {
      this.suppressedEndCallUUIDs.add(key);

      const previousTimer = this.suppressedEndCallTimers.get(key);
      if (previousTimer) clearTimeout(previousTimer);

      const timer = setTimeout(() => {
        this.suppressedEndCallUUIDs.delete(key);
        this.suppressedEndCallTimers.delete(key);
      }, 8000);

      this.suppressedEndCallTimers.set(key, timer);
    });
  }

  private consumeSuppressedEndCall(uuid: string) {
    // Se prueba tanto el UUID resuelto como el crudo: los alias pueden haberse
    // borrado ya (forgetNativeCall) cuando llega el evento nativo, asi que
    // resolver no siempre devuelve el mismo valor con el que se suprimio.
    const candidatas = Array.from(new Set([
      this.getNativeUUIDKey(uuid),
      normalizeCallKey(uuid),
    ]));

    const key = candidatas.find((c) => this.suppressedEndCallUUIDs.has(c));
    if (!key) return false;

    this.suppressedEndCallUUIDs.delete(key);
    const timer = this.suppressedEndCallTimers.get(key);
    if (timer) clearTimeout(timer);
    this.suppressedEndCallTimers.delete(key);
    return true;
  }

  private suppressAnswerCallOnce(uuid: string) {
    const nativeUUID = this.resolveCallUUID(uuid);
    const key = normalizeCallKey(nativeUUID);
    this.suppressedAnswerCallUUIDs.add(key);

    const previousTimer = this.suppressedAnswerCallTimers.get(key);
    if (previousTimer) clearTimeout(previousTimer);

    const timer = setTimeout(() => {
      this.suppressedAnswerCallUUIDs.delete(key);
      this.suppressedAnswerCallTimers.delete(key);
    }, 8000);

    this.suppressedAnswerCallTimers.set(key, timer);
  }

  private consumeSuppressedAnswerCall(uuid: string) {
    const key = this.getNativeUUIDKey(uuid);
    if (!this.suppressedAnswerCallUUIDs.has(key)) return false;

    this.suppressedAnswerCallUUIDs.delete(key);
    const timer = this.suppressedAnswerCallTimers.get(key);
    if (timer) clearTimeout(timer);
    this.suppressedAnswerCallTimers.delete(key);
    return true;
  }

  private clearIncomingCallTimeout(uuid: string) {
    const nativeUUID = this.resolveCallUUID(uuid);
    const timeout = this.incomingCallTimeouts.get(nativeUUID);
    if (timeout) {
      clearTimeout(timeout);
      this.incomingCallTimeouts.delete(nativeUUID);
    }
  }

  /**
   * Longer than both the APNs retry window for a VoIP push and a full ring
   * (INCOMING_CALL_RING_TIMEOUT_MS), so a delayed delivery of the call that just
   * ended is still recognised. A genuine callback is matched by callSessionId
   * rather than by this window, so it is never blocked by the TTL.
   */
  private static readonly ENDED_CALL_TTL_MS = 90_000;

  private pruneEndedCallKeys() {
    const now = Date.now();
    for (const [key, endedAt] of Array.from(this.endedCallKeys.entries())) {
      if (now - endedAt > CallKeepService.ENDED_CALL_TTL_MS) {
        this.endedCallKeys.delete(key);
      }
    }
  }

  /**
   * Marca una sesion como terminada, para que un push en vuelo no la reviva.
   *
   * Solo se marcan identificadores PROPIOS de esta llamada: el UUID nativo y el
   * callSessionId. El conversationId y el roomName NO, porque se repiten en
   * cada llamada de la misma conversacion (roomName es `conv_<conversationId>`).
   *
   * Marcarlos dejaba la conversacion entera bloqueada 90s: al colgar y volver a
   * llamar enseguida, la segunda llamada se rechazaba sola. isEndedCall retira
   * las lapidas cuando llega un callSessionId nuevo, pero si el contexto ya se
   * habia limpiado ese id no llegaba y caia en la comprobacion por
   * conversationId.
   */
  private markCallEnded(nativeUUID: string, context?: NativeCallContext) {
    this.pruneEndedCallKeys();
    const now = Date.now();
    [nativeUUID, context?.callSessionId]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .forEach((value) => this.endedCallKeys.set(normalizeCallKey(value), now));
  }

  /**
   * Sesiones cuyo evento terminal llego ANTES que el aviso de llamada entrante.
   *
   * El caso: el emisor cuelga sin que el receptor haya contestado. El receptor
   * nunca tuvo contexto de esa llamada, asi que no hay lapida que consultar
   * —isEndedCall deja pasar cuando no encuentra el callSessionId—, y si el
   * 'incoming_call' llega despues del 'call_ended', suena una llamada que ya
   * termino.
   *
   * Aqui se anotan los identificadores de todo evento terminal recibido, exista
   * o no una llamada local asociada, para poder rechazar un aviso posterior de
   * la misma sesion.
   */
  private terminatedSessions: Map<string, number> = new Map();

  private markSessionTerminated(identifiers: Array<string | undefined>) {
    const now = Date.now();
    for (const [key, at] of Array.from(this.terminatedSessions.entries())) {
      if (now - at > CallKeepService.ENDED_CALL_TTL_MS) this.terminatedSessions.delete(key);
    }
    identifiers
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .forEach((value) => this.terminatedSessions.set(normalizeCallKey(value), now));
  }

  private isSessionTerminated(identifiers: Array<string | undefined>): boolean {
    if (this.terminatedSessions.size === 0) return false;
    return identifiers
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => this.terminatedSessions.has(normalizeCallKey(value)));
  }

  /**
   * True when this payload belongs to a session already ended here.
   *
   * A genuine callback carries a fresh callSessionId, so it is cleared as a new
   * session rather than matched — blocking those would turn this fix into a
   * worse bug (unable to call back after hanging up).
   */
  // NOTA: markCallEnded solo guarda nativeUUID y callSessionId, asi que los
  // conversationId/roomName que algunos llamadores pasan en `identifiers` nunca
  // llegan a coincidir. Se mantienen por si alguna vez vuelven a registrarse,
  // pero hoy la deteccion real se apoya en esos dos. No confiar en ellos para
  // ampliar la cobertura sin tocar tambien markCallEnded.
  private isEndedCall(identifiers: Array<string | undefined>, callSessionId?: string): boolean {
    this.pruneEndedCallKeys();
    if (this.endedCallKeys.size === 0) return false;

    if (callSessionId) {
      const sessionKey = normalizeCallKey(callSessionId);
      // A new session id on a conversation whose previous call ended: this is a
      // legitimate new call, so retire the old tombstones for it.
      if (!this.endedCallKeys.has(sessionKey)) {
        identifiers
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
          .forEach((value) => this.endedCallKeys.delete(normalizeCallKey(value)));
        return false;
      }
      return true;
    }

    return identifiers
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => this.endedCallKeys.has(normalizeCallKey(value)));
  }

  private forgetNativeCall(uuid: string) {
    const nativeUUID = this.resolveCallUUID(uuid);
    const nativeKey = normalizeCallKey(nativeUUID);
    const context = this.nativeCallContexts.get(nativeKey);

    // Must happen before the aliases below are dropped: once they are gone
    // there is no way left to recognise a late push for this same session.
    this.markCallEnded(nativeUUID, context);

    this.clearIncomingCallTimeout(nativeUUID);
    this.displayedNativeCallUUIDs.delete(nativeUUID);
    this.nativeCallContexts.delete(nativeKey);
    this.suppressedAnswerCallUUIDs.delete(nativeKey);

    for (const [alias, mappedNativeUUID] of Array.from(this.nativeCallAliases.entries())) {
      if (normalizeCallKey(mappedNativeUUID) === nativeKey || alias === nativeKey) {
        this.nativeCallAliases.delete(alias);
      }
    }

    CallState.clearIncomingCall(context?.conversationId || nativeUUID);
  }

  private clearNativeCallMemory() {
    // CallScreen unmounting on hangup lands here; tombstone every live call
    // before its context is discarded.
    this.displayedNativeCallUUIDs.forEach((nativeUUID) => {
      this.markCallEnded(nativeUUID, this.nativeCallContexts.get(normalizeCallKey(nativeUUID)));
    });

    this.incomingCallTimeouts.forEach(clearTimeout);
    this.incomingCallTimeouts.clear();
    this.nativeCallAliases.clear();
    this.nativeCallContexts.clear();
    this.displayedNativeCallUUIDs.clear();
    this.suppressedAnswerCallTimers.forEach(clearTimeout);
    this.suppressedAnswerCallTimers.clear();
    this.suppressedAnswerCallUUIDs.clear();
    CallState.clearAllIncomingCalls();
  }

  private reportCallEndedSilently(uuid: string, reason: number) {
    const nativeUUID = this.resolveCallUUID(uuid);
    if (!this.canUseNativeUUID(nativeUUID, 'reportEndCallWithUUID')) return;
    this.clearIncomingCallTimeout(nativeUUID);
    this.suppressEndCallOnce(nativeUUID);
    RNCallKeep.reportEndCallWithUUID(nativeUUID, reason);
    this.forgetNativeCall(nativeUUID);
  }

  private rememberNativeCall(nativeUUID: string, requestedUUID: string, context: NativeCallContext = {}) {
    const fullContext = {
      roomName: context.roomName || requestedUUID,
      conversationId: context.conversationId,
      callSessionId: context.callSessionId,
      senderId: context.senderId,
      senderName: context.senderName,
    };

    this.nativeCallContexts.set(normalizeCallKey(nativeUUID), fullContext);

    // callSessionId incluido a proposito: es el UNICO identificador que
    // comparten las dos vias de aviso (push FCM y broadcast de Supabase
    // Realtime). Sin el, cada via podia resolver un UUID nativo distinto —el
    // push trae nativeCallUUID y el broadcast a veces solo conversationId— y
    // la guarda de duplicados no las reconocia como la misma llamada: sonaba
    // dos veces, y ademas la segunda colgaba a la primera con endCall().
    [nativeUUID, requestedUUID, fullContext.roomName, fullContext.conversationId, fullContext.callSessionId]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .forEach((alias) => this.nativeCallAliases.set(normalizeCallKey(alias), nativeUUID));
  }

  private getNativeCallContext(uuid: string): NativeCallContext | undefined {
    const nativeUUID = this.resolveCallUUID(uuid);
    return this.nativeCallContexts.get(normalizeCallKey(nativeUUID));
  }

  private buildContextFromPayload(payload: unknown): NativeCallContext {
    const data = asPayloadObject(payload);
    return {
      roomName: getBoundedString(data.roomName, 256),
      conversationId: getBoundedString(data.conversationId, 128),
      callSessionId: getBoundedString(data.callSessionId || data.call_session_id, 128),
      senderId: getBoundedString(data.senderId || data.sender_id, 128),
      senderName: getBoundedString(data.senderName || data.callerName || data.handle, 120),
    };
  }

  private getRequestedUUIDFromPayload(payload: unknown, fallbackUUID?: string): string | undefined {
    const data = asPayloadObject(payload);
    return getBoundedString(
      data.nativeCallUUID ||
      data.callUUID ||
      data.uuid ||
      data.roomName ||
      data.conversationId ||
      fallbackUUID,
      256,
    );
  }

  private rememberDisplayedCallFromPayload(nativeUUID: string, payload: unknown, fallbackContext: NativeCallContext = {}) {
    const requestedUUID = this.getRequestedUUIDFromPayload(payload, nativeUUID) || nativeUUID;
    const payloadContext = this.buildContextFromPayload(payload);
    const context: NativeCallContext = {
      ...fallbackContext,
      ...payloadContext,
    };
    this.registerIncomingCallContext(nativeUUID, requestedUUID, context, true);
  }

  private handleVoipNotificationPayload = (notificationObj: unknown) => {
    void this.handleIncomingCallPayload(notificationObj, { nativeAlreadyDisplayed: true }).catch(() => {
      // A malformed/stale native push must not destabilize the JS bridge.
    });
  };

  setup() {
    if (this.initialized) return this.setupPromise;

    try {
      this.setupPromise = Promise.resolve(RNCallKeep.setup(options)).then(() => {
        if (Platform.OS === 'android') {
          RNCallKeep.setAvailable(true);
        }
      }).catch(() => {
        // Native call UI may still be available when setup was already done
        // by the cold-start path. Never turn this into an auth/session failure.
      });

      RNCallKeep.addEventListener('answerCall', this.handleAnswerCall);
      RNCallKeep.addEventListener('endCall', this.handleEndCall);
      RNCallKeep.addEventListener('didDisplayIncomingCall', this.handleDidDisplayIncomingCall);

      if (Platform.OS === 'ios') {
        // Con la llamada CallKit viva tras contestar, es CallKit quien activa la
        // AVAudioSession (p. ej. contestada desde lock screen con la app en
        // background). WebRTC/LiveKit debe arrancar su audio en ese momento.
        RNCallKeep.addEventListener('didActivateAudioSession', this.handleDidActivateAudioSession);
      }

      this.initialized = true;
      void this.consumeInitialCallKeepEvents();
    } catch {
      this.setupPromise = Promise.resolve();
      this.initialized = true;
    }

    return this.setupPromise;
  }

  async ensureReady() {
    this.setup();
    await this.setupPromise;
  }

  private handleDidActivateAudioSession = () => {
    try {
      const { AudioSession } = require('@livekit/react-native');
      AudioSession.startAudioSession().catch(() => undefined);
    } catch {
      // LiveKit may not be loaded in the native/headless path yet.
    }
  };

  private async consumeInitialCallKeepEvents() {
    try {
      await this.setupPromise;
      const events = await RNCallKeep.getInitialEvents();
      if (!Array.isArray(events)) return;

      for (const event of events) {
        const name = (event as any)?.name;
        const data = (event as any)?.data;
        if (name === 'RNCallKeepPerformAnswerCallAction') {
          const callUUID = getBoundedString(data?.callUUID, 128);
          if (callUUID) await this.handleAnswerCall({ callUUID });
        } else if (name === 'RNCallKeepPerformEndCallAction') {
          const callUUID = getBoundedString(data?.callUUID, 128);
          if (callUUID) await this.handleEndCall({ callUUID });
        } else if (name === 'RNCallKeepDidDisplayIncomingCall') {
          this.handleDidDisplayIncomingCall(data);
        } else if (name === 'RNCallKeepDidActivateAudioSession') {
          this.handleDidActivateAudioSession();
        }
      }

      RNCallKeep.clearInitialEvents();
    } catch {
      // Initial events are best-effort; live listeners remain active.
    }
  }

  private handleAnswerCall = async ({ callUUID }: { callUUID: string }) => {
    if (this.consumeSuppressedAnswerCall(callUUID)) {
      console.log('[CallKeep] Suppressing answerCall for UUID answered by app UI:', callUUID);
      return;
    }

    console.log('[CallKeep] Answered call:', callUUID);
    if (Platform.OS === 'android') {
      RNCallKeep.setCurrentCallActive(callUUID);
    }
    this.clearIncomingCallTimeout(callUUID);
    const context = this.getNativeCallContext(callUUID);
    const fallbackConversationId = CallState.getIncomingCallConversationId(callUUID);
    CallState.clearIncomingCall(context?.conversationId || callUUID);

    // Persistir ANTES de traer la app al frente.
    //
    // Con la app muerta, backToForeground provoca un arranque en frio que lee
    // pendingCallActionStorage nada mas montar. Si se llamaba primero, se
    // competia con esta escritura y el arranque podia encontrar el almacen
    // vacio: la app abria sin saber a que llamada iba.
    await pendingCallActionStorage.set({
      type: 'answer',
      callUUID,
      roomName: context?.roomName,
      conversationId: context?.conversationId || fallbackConversationId,
      callSessionId: context?.callSessionId,
      senderId: context?.senderId,
      senderName: context?.senderName,
      createdAt: Date.now(),
    }).catch((error) => console.warn('[CallKeep] Could not persist pending answer action:', error));

    if (Platform.OS === 'android') {
      RNCallKeep.backToForeground();
    }

    DeviceEventEmitter.emit('CallKeep_AnswerCall', {
      callUUID,
      conversationId: context?.conversationId || fallbackConversationId,
      roomName: context?.roomName || (fallbackConversationId ? `conv_${fallbackConversationId}` : undefined),
      callSessionId: context?.callSessionId,
      senderId: context?.senderId,
      senderName: context?.senderName,
    });
  };

  private handleEndCall = async ({ callUUID }: { callUUID: string }) => {
    if (this.consumeSuppressedEndCall(callUUID)) {
      console.log('[CallKeep] Suppressing endCall for UUID ended by internal cleanup:', callUUID);
      this.forgetNativeCall(callUUID);
      return;
    }

    console.log('[CallKeep] Ended call (native event triggered):', callUUID);
    const context = this.getNativeCallContext(callUUID);
    const nativeUUID = this.resolveCallUUID(callUUID);
    const fallbackConversationId = CallState.getIncomingCallConversationId(callUUID);
    const wasInsideCallScreen =
      CallState.isInsideCallScreen ||
      CallState.matchesActiveCallScreen({
        callUUID: nativeUUID,
        nativeCallUUID: nativeUUID,
        roomName: context?.roomName,
        conversationId: context?.conversationId || fallbackConversationId,
        callSessionId: context?.callSessionId,
      });
    CallState.clearIncomingCall(context?.conversationId || fallbackConversationId || callUUID);
    this.displayedNativeCallUUIDs.delete(nativeUUID);

    // El propio usuario acaba de colgar: se anota la sesion como terminada para
    // que un aviso posterior de ESTA MISMA llamada no vuelva a sonar.
    //
    // markSessionTerminated solo se alimentaba de eventos terminales ENTRANTES,
    // asi que este caso —yo cuelgo y el emisor aun no lo sabe, su push de
    // llamada sigue en vuelo— no quedaba cubierto: el aviso llegaba, no
    // encontraba lapida y CallKit volvia a mostrar la llamada un par de
    // segundos hasta que el emisor procesaba el rechazo.
    // Solo identificadores PROPIOS de esta llamada. conversationId y roomName
    // NO: se repiten en cada llamada de la misma conversacion (roomName es
    // `conv_<conversationId>`), asi que anotarlos bloqueaba la conversacion
    // entera y la rellamada inmediata se colgaba sola.
    this.markSessionTerminated([
      callUUID,
      nativeUUID,
      context?.callSessionId,
    ]);
    // Covers the rejected-without-answering path too: the duplicate guard is
    // dropped here, before any of the returns below reach forgetNativeCall.
    this.markCallEnded(nativeUUID, {
      ...context,
      conversationId: context?.conversationId || fallbackConversationId,
    });
    DeviceEventEmitter.emit('CallKeep_EndCall', {
      callUUID,
      ...context,
      conversationId: context?.conversationId || fallbackConversationId,
      wasInsideCallScreen,
    });

    if (wasInsideCallScreen) {
      console.log('[CallKeep] Native end belongs to an active CallScreen; CallScreen will persist call_ended.');
      this.forgetNativeCall(callUUID);
      return;
    }

    try {
      console.log('[CallKeep] Attempting to read user from MMKV...');
      const { userStorage } = require('../lib/secure-storage');
      const userStr = await userStorage.getUser();

      if (!userStr) {
        console.warn('[CallKeep] userStr is empty! Cannot send call_rejected to backend.');
        return;
      }

      const user = JSON.parse(userStr);
      console.log('[CallKeep] User found in MMKV:', user.id);

      const realConvId = context?.conversationId || fallbackConversationId || (callUUID.startsWith('conv_') ? callUUID.replace('conv_', '') : undefined);
      if (!realConvId) {
        console.warn('[CallKeep] Cannot send call_rejected without conversation context for native UUID:', callUUID);
        return;
      }
      const rejectedRoomName = context?.roomName && !UUID_REGEX.test(context.roomName)
        ? context.roomName
        : `conv_${realConvId}`;

      // El callSessionId identifica la llamada CONCRETA que se rechaza. Si no
      // viaja, el emisor recibe un call_rejected que no puede asociar a su
      // sesion activa y no lo aplica: su llamada sigue viva y el receptor
      // vuelve a recibir el aviso, con el efecto de "cuelgo y me vuelve a
      // llamar".
      //
      // context puede estar ya vacio al colgar, asi que se recupera del
      // registro de sesiones antes de darlo por perdido.
      const sesionRechazada =
        context?.callSessionId ||
        this.getNativeCallContext(this.resolveCallUUID(callUUID))?.callSessionId;

      if (!sesionRechazada) {
        console.warn(
          '[CallKeep] call_rejected sin callSessionId: el emisor no podra asociarlo a su llamada.',
          callUUID,
        );
      }

      console.log('[CallKeep] Sending call_rejected for conversation:', realConvId);

      const { chatService } = require('./chat.service');
      await chatService.sendMessage({
        conversationId: realConvId,
        senderId: user.id,
        content: 'Llamada rechazada',
        type: 'call_rejected' as any,
        metadata: {
          roomName: rejectedRoomName,
          callSessionId: sesionRechazada,
        },
      });
      console.log('[CallKeep] Successfully notified backend of native rejection.');
    } catch (e) {
      console.log('[CallKeep] Failed to report native rejection:', e);
    } finally {
      this.forgetNativeCall(callUUID);
    }
  };

  private handleDidDisplayIncomingCall = ({ error, callUUID, handle, localizedCallerName, payload }: any = {}) => {
    if (error || !callUUID) return;

    // Terminal VoIP pushes are reported to CallKit only for PushKit compliance
    // (iOS requires every VoIP push to report a call). Never register them as an
    // active incoming call: dismiss immediately so CallState stays clean.
    const payloadType = getStringValue(asPayloadObject(payload).type);
    if (payloadType === 'call_ended' || payloadType === 'call_missed' || payloadType === 'call_rejected') {
      this.reportCallEndedSilently(callUUID, CONSTANTS.END_CALL_REASONS.REMOTE_ENDED);
      return;
    }

    this.rememberDisplayedCallFromPayload(callUUID, payload, {
      senderName: getStringValue(localizedCallerName || handle),
    });
  };

  displayIncomingCall(uuid: string, handle: string, localizedCallerName: string, context: NativeCallContext = {}) {
    const resolvedUUID = this.resolveCallUUID(uuid);

    // A push for a session that already ended here would otherwise ring again:
    // forgetNativeCall() dropped the duplicate guard, and the backend reuses the
    // same CallKit UUID for the whole session.
    if (this.isEndedCall([uuid, resolvedUUID, context.conversationId, context.roomName], context.callSessionId)) {
      console.log('[CallKeep] Ignoring displayIncomingCall for a call that already ended here:', resolvedUUID);
      return resolvedUUID;
    }

    // El evento terminal de esta sesion ya llego: el emisor colgo antes de que
    // contestaramos. isEndedCall no lo detecta porque nunca hubo llamada local
    // que dejara lapida —deja pasar cuando no encuentra el callSessionId—, asi
    // que se comprueba aparte.
    if (this.isSessionTerminated([uuid, resolvedUUID, context.callSessionId])) {
      console.log('[CallKeep] Ignoring displayIncomingCall: la sesión ya recibió su evento terminal:', resolvedUUID);
      return resolvedUUID;
    }

    const nativeUUID = Platform.OS === 'ios' && !UUID_REGEX.test(resolvedUUID) ? createUuid() : resolvedUUID;
    this.rememberNativeCall(nativeUUID, uuid, context);
    if (!this.canUseNativeUUID(nativeUUID, 'displayIncomingCall')) return nativeUUID;

    if (this.displayedNativeCallUUIDs.has(nativeUUID)) {
      console.log('[CallKeep] Ignoring duplicate displayIncomingCall for native UUID:', nativeUUID);
      return nativeUUID;
    }

    RNCallKeep.displayIncomingCall(nativeUUID, handle, localizedCallerName, 'generic', true);
    this.displayedNativeCallUUIDs.add(nativeUUID);
    CallState.setIncomingCallActive(context.conversationId, nativeUUID);

    const timeout = setTimeout(() => {
      // Timeout local ≠ rechazo del usuario: cerrar en silencio. endCall aquí
      // disparaba el evento nativo endCall → handleEndCall enviaba un
      // call_rejected espurio y, si el usuario ya estaba en OTRA llamada de la
      // misma conversación, wasInsideCallScreen cerraba ese CallScreen activo.
      console.log(`[CallKeepService] Dismissing unanswered incoming call ${nativeUUID} after ${INCOMING_CALL_RING_TIMEOUT_MS}ms timeout.`);
      this.reportCallEndedSilently(nativeUUID, CONSTANTS.END_CALL_REASONS.MISSED);
    }, INCOMING_CALL_RING_TIMEOUT_MS);
    this.incomingCallTimeouts.set(nativeUUID, timeout);
    return nativeUUID;
  }

  async handleIncomingCallPayload(payload: unknown, options: { nativeAlreadyDisplayed?: boolean } = {}) {
    const notification = normalizeCallNotificationPayload(payload);
    if (!notification) return false;

    const notificationType = notification.type;
    const requestedUUID = this.getRequestedUUIDFromPayload(notification);
    const completionUUID = getBoundedString(
      notification.nativeCallUUID || notification.callUUID || notification.uuid || requestedUUID,
      128,
    );

    if (TERMINAL_CALL_NOTIFICATION_TYPES.has(notificationType)) {
      // Se anota SIEMPRE, exista o no una llamada local: si el 'incoming_call'
      // de esta misma sesion llega despues (el emisor colgo antes de que el
      // receptor contestara), hay con que rechazarlo.
      // Mismo criterio: sin conversationId ni roomName, que se reutilizan.
      this.markSessionTerminated([
        requestedUUID,
        notification.originalCallUUID,
        notification.callSessionId,
      ]);

      const terminalIds = Array.from(new Set([
        requestedUUID,
        notification.originalCallUUID,
        notification.conversationId,
        notification.roomName,
      ].filter(Boolean))) as string[];

      terminalIds.forEach((id) => {
        try {
          this.dismissIncomingCall(id);
        } catch {
          // Native CallKit may already have dismissed this identifier.
        }
      });

      // Tombstone explicitly: forgetNativeCall() can only record what it still
      // has in memory, and a terminal push may arrive before (or instead of) any
      // locally tracked call — the ordering that lets a delayed 'call' push for
      // the same session ring afterwards.
      this.markCallEnded(this.resolveCallUUID(requestedUUID || ''), {
        conversationId: getBoundedString(notification.conversationId, 128),
        roomName: getBoundedString(notification.roomName, 256),
        callSessionId: getBoundedString(notification.callSessionId || notification.call_session_id, 128),
      });
      if (completionUUID && typeof VoipPushNotification.onVoipNotificationCompleted === 'function') {
        VoipPushNotification.onVoipNotificationCompleted(completionUUID);
      }
      return true;
    }

    if (!requestedUUID) return false;

    const context = this.buildContextFromPayload(notification);
    const callerName = getBoundedString(notification.callerName || notification.senderName, 120) || 'Tincadia';
    const handle = getBoundedString(notification.handle || notification.senderName, 120) || 'Tincadia Call';

    // A push the OS queued past the ring window would ring for a call nobody is
    // still placing. Android already does this via remoteMessage.sentTime in its
    // FCM handlers; PushKit carries the timestamp in the payload instead.
    const sentAt = Number(asPayloadObject(notification).sentAt);
    if (Number.isFinite(sentAt) && sentAt > 0 && Date.now() - sentAt > STALE_CALL_PUSH_MS) {
      console.log('[CallKeep] Dropping stale incoming call push (delayed by OS):', requestedUUID);
      if (options.nativeAlreadyDisplayed) {
        await this.ensureReady();
        this.reportCallEndedSilently(requestedUUID, CONSTANTS.END_CALL_REASONS.MISSED);
      }
      if (completionUUID && typeof VoipPushNotification.onVoipNotificationCompleted === 'function') {
        VoipPushNotification.onVoipNotificationCompleted(completionUUID);
      }
      return true;
    }

    // Late VoIP push for a session that already ended on this device (the user
    // hung up or rejected while it was in flight). Android filters these by age
    // in its FCM handlers; the PushKit path had no equivalent guard.
    if (this.isEndedCall(
      [requestedUUID, this.resolveCallUUID(requestedUUID), context.conversationId, context.roomName],
      context.callSessionId,
    )) {
      console.log('[CallKeep] Dropping incoming call push for an already-ended session:', requestedUUID);
      if (options.nativeAlreadyDisplayed) {
        // iOS requires every VoIP push to report a call, so the banner CallKit
        // already showed must be ended explicitly rather than just ignored.
        await this.ensureReady();
        this.reportCallEndedSilently(requestedUUID, CONSTANTS.END_CALL_REASONS.REMOTE_ENDED);
      }
      if (completionUUID && typeof VoipPushNotification.onVoipNotificationCompleted === 'function') {
        VoipPushNotification.onVoipNotificationCompleted(completionUUID);
      }
      return true;
    }

    if (options.nativeAlreadyDisplayed) {
      this.registerIncomingCallContext(this.resolveCallUUID(requestedUUID), requestedUUID, {
        ...context,
        senderName: context.senderName || callerName,
      }, true);
    } else {
      await this.ensureReady();
      this.displayIncomingCall(requestedUUID, handle, callerName, context);
    }

    if (completionUUID && typeof VoipPushNotification.onVoipNotificationCompleted === 'function') {
      VoipPushNotification.onVoipNotificationCompleted(completionUUID);
    }
    return true;
  }

  async handleBackgroundCallKeepMessage(value: unknown) {
    const data = asPayloadObject(value);
    const explicitType = getBoundedString(data.type, 32);

    // RNCallKeep's Android headless task is normally used for native outgoing
    // call reachability/actions. Only display an incoming call when the task
    // explicitly carries an incoming-call type; generic callUUID/name/handle
    // data must not create a phantom incoming call.
    if (explicitType === 'call' || explicitType === 'incoming_call') {
      await this.handleIncomingCallPayload(data);
      return;
    }

    const callUUID = getBoundedString(data.callUUID, 128);
    if (!callUUID) return;

    if (data.name === 'RNCallKeepPerformAnswerCallAction' || data.action === 'answer') {
      await this.handleAnswerCall({ callUUID });
    } else if (data.name === 'RNCallKeepPerformEndCallAction' || data.action === 'end') {
      await this.handleEndCall({ callUUID });
    }
  }

  endCall(uuid: string) {
    const nativeUUID = this.resolveCallUUID(uuid);
    const context = this.getNativeCallContext(nativeUUID);
    if (!this.canUseNativeUUID(nativeUUID, 'endCall')) return;
    this.clearIncomingCallTimeout(nativeUUID);
    RNCallKeep.endCall(nativeUUID);
    this.displayedNativeCallUUIDs.delete(nativeUUID);
    this.markCallEnded(nativeUUID, context);
    CallState.clearIncomingCall(context?.conversationId || nativeUUID);
  }

  endCallSilently(uuid: string) {
    const nativeUUID = this.resolveCallUUID(uuid);
    if (!this.canUseNativeUUID(nativeUUID, 'endCallSilently')) return;
    this.suppressEndCallOnce(nativeUUID);
    this.clearIncomingCallTimeout(nativeUUID);
    RNCallKeep.endCall(nativeUUID);
    this.forgetNativeCall(nativeUUID);
  }

  dismissIncomingCall(uuid: string) {
    this.reportCallEndedSilently(uuid, CONSTANTS.END_CALL_REASONS.REMOTE_ENDED);
  }

  answerIncomingCallFromApp(uuid: string): boolean {
    const nativeUUID = this.resolveCallUUID(uuid);
    const context = this.getNativeCallContext(nativeUUID);
    const hasNativeCallToAnswer = this.displayedNativeCallUUIDs.has(nativeUUID) || Boolean(context);
    if (!hasNativeCallToAnswer) return false;
    if (!this.canUseNativeUUID(nativeUUID, 'answerIncomingCall')) return false;

    this.clearIncomingCallTimeout(nativeUUID);
    CallState.clearIncomingCall(context?.conversationId || nativeUUID);
    this.suppressAnswerCallOnce(nativeUUID);

    try {
      RNCallKeep.answerIncomingCall(nativeUUID);
    } catch (error) {
      console.warn('[CallKeep] Failed to answer native incoming call from app UI:', error);
      return false;
    }

    if (Platform.OS === 'android') {
      RNCallKeep.setCurrentCallActive(nativeUUID);
      RNCallKeep.backToForeground();
    }

    setTimeout(() => {
      try {
        // The React Native CallScreen owns the actual LiveKit media session.
        // After marking the native incoming call as answered, remove the native
        // call UI without letting CallKit emit a rejection/end side effect.
        this.endCallSilently(nativeUUID);
      } catch (error) {
        console.warn('[CallKeep] Failed to clear native answered call from app UI:', error);
      }
    }, Platform.OS === 'ios' ? 250 : 0);

    return true;
  }

  endAllCalls() {
    try {
      RNCallKeep.endAllCalls();
    } catch (error) {
      console.warn('[CallKeep] Failed to end all calls:', error);
    } finally {
      this.clearNativeCallMemory();
    }
  }

  endAllCallsSilently() {
    const nativeUUIDs = Array.from(this.displayedNativeCallUUIDs);
    nativeUUIDs.forEach((nativeUUID) => this.suppressEndCallOnce(nativeUUID));

    try {
      RNCallKeep.endAllCalls();
    } catch (error) {
      console.warn('[CallKeep] Failed to silently end all calls:', error);
    } finally {
      this.clearNativeCallMemory();
    }
  }

  setupVoipPush(onVoipToken?: (token: string) => void) {
    if (Platform.OS !== 'ios') return;
    this.voipTokenHandler = onVoipToken;

    if (this.voipPushInitialized) {
      VoipPushNotification.registerVoipToken();
      return;
    }
    this.voipPushInitialized = true;

    VoipPushNotification.addEventListener('didLoadWithEvents', (events: any) => {
      if (!Array.isArray(events)) return;

      events.forEach((event) => {
        if (event?.name === 'RNVoipPushRemoteNotificationsRegisteredEvent') {
          const token = getStringValue(event.data);
          if (token) {
            this.voipTokenHandler?.(token);
          }
        }

        if (event?.name === 'RNVoipPushRemoteNotificationReceivedEvent') {
          this.handleVoipNotificationPayload(event.data);
        }
      });
    });

    VoipPushNotification.addEventListener('register', (token) => {
      this.voipTokenHandler?.(token);
    });

    VoipPushNotification.addEventListener('notification', this.handleVoipNotificationPayload);

    VoipPushNotification.registerVoipToken();
  }

  removeListeners() {
    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didDisplayIncomingCall');
    if (Platform.OS === 'ios') {
      RNCallKeep.removeEventListener('didActivateAudioSession');
    }

    if (Platform.OS === 'ios') {
      VoipPushNotification.removeEventListener('register');
      VoipPushNotification.removeEventListener('notification');
      VoipPushNotification.removeEventListener('didLoadWithEvents');
    }
  }
}

export const callKeepService = new CallKeepService();
