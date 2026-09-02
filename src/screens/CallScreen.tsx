import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, Image, Dimensions, DeviceEventEmitter, Platform, ScrollView, Keyboard, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    AudioSession,
    LiveKitRoom,
    useTracks,
    VideoTrack,
    registerGlobals,
    useLocalParticipant,
    useRoomContext,
    useParticipants,
} from '@livekit/react-native';
import { Track, RoomEvent, ConnectionState, type RemoteParticipant } from 'livekit-client';
import { Audio } from 'expo-av';
import { API_URL } from '../config/api.config';
import { CameraIcon, MicrophoneIcon, PhoneIcon, SyncIcon } from '../components/icons/NavigationIcons';
import { chatService } from '../services/chat.service';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { saveMessage, deleteMessage, updateConversationPreview } from '../database/chatDatabase';
import { useSubscription } from '../hooks/useSubscription';
import { UpgradeModal } from '../components/UpgradeModal';
import { supabase } from '../lib/supabase';
import { callKeepService } from '../services/callkeep.service';
import { callScreenStyles as styles } from '../styles/CallScreen.styles';
import { CallState, HANDOFF_ACTIVE_CALL_EVENT } from '../lib/callState';

// Initialize WebRTC
registerGlobals();

type LayoutMode = 'grid' | 'interpreter';

type TranscriptCaption = {
    id: string;
    speaker: string;
    text: string;
};

type PartialCaption = {
    speaker: string;
    text: string;
};

const CaptionsVisibilityContext = React.createContext<{
    captionsVisible: boolean;
    setCaptionsVisible: (visible: boolean) => void;
}>({
    captionsVisible: true,
    setCaptionsVisible: () => undefined,
});

/**
 * Transcripciones de TODOS los participantes, indexadas por identity.
 *
 * Antes cada overlay se suscribía por su cuenta a RoomEvent.DataReceived y
 * descartaba lo que no fuera suyo. Como los overlays cuelgan de los tracks de
 * cámara (useTracks([Track.Source.Camera])), quien tuviera la cámara apagada
 * —o cuyo vídeo aún no hubiera llegado— no tenía overlay montado, así que sus
 * subtítulos se descartaban sin que nadie los mostrara: el bot los publicaba
 * bien, pero no había quien escuchara por esa identidad.
 *
 * Ahora hay un único listener a nivel de sala que reparte por speakerId. El
 * estado existe aunque el participante no tenga vídeo, y el overlay solo lee
 * lo que le corresponde.
 */
type TranscriptState = {
    finals: TranscriptCaption[];
    partial: PartialCaption | null;
};

const TranscriptionsContext = React.createContext<Record<string, TranscriptState>>({});

function TranscriptionsProvider({ children }: { children: React.ReactNode }) {
    const room = useRoomContext();
    const [bySpeaker, setBySpeaker] = useState<Record<string, TranscriptState>>({});
    const captionIdRef = useRef(0);

    useEffect(() => {
        if (!room) return;

        const onDataReceived = (
            payload: Uint8Array,
            participant?: RemoteParticipant,
            _kind?: unknown,
            _topic?: string,
        ) => {
            const bytes = payloadToUint8Array(payload);
            if (!bytes || bytes.byteLength === 0) return;
            try {
                // Decodificación robusta para React Native (UTF-8)
                const str = decodeURIComponent(
                    Array.from(bytes)
                        .map(b => '%' + ('00' + b.toString(16)).slice(-2))
                        .join('')
                );

                const data = JSON.parse(str) as {
                    type?: string;
                    text?: string;
                    isFinal?: boolean;
                    speakerId?: string;
                };

                if (data.type !== 'transcription' || typeof data.text !== 'string') return;
                const trimmed = data.text.trim();
                if (!trimmed) return;

                const rawSpeaker = data.speakerId || participant?.identity || '';
                if (!rawSpeaker) return;

                // Clean up identity labels (transcriber-room-identity)
                const speaker = rawSpeaker
                    .replace(/^transcriber-[^-]+-?/i, '')
                    .replace(/^transcriber-/i, '')
                    .split('-')[0] || 'AI';

                setBySpeaker((prev) => {
                    const current = prev[rawSpeaker] ?? { finals: [], partial: null };

                    if (data.isFinal === true) {
                        captionIdRef.current += 1;
                        return {
                            ...prev,
                            [rawSpeaker]: {
                                finals: [
                                    ...current.finals.slice(-8),
                                    { id: `cc-${captionIdRef.current}`, speaker, text: trimmed },
                                ],
                                partial: null,
                            },
                        };
                    }

                    return {
                        ...prev,
                        [rawSpeaker]: { ...current, partial: { speaker, text: trimmed } },
                    };
                });
            } catch (err) {
                console.log('Error parsing transcription packet:', err);
            }
        };

        room.on(RoomEvent.DataReceived, onDataReceived);
        return () => {
            room.off(RoomEvent.DataReceived, onDataReceived);
        };
    }, [room]);

    return (
        <TranscriptionsContext.Provider value={bySpeaker}>
            {children}
        </TranscriptionsContext.Provider>
    );
}

/**
 * Visibilidad de la barra de controles. VideoView la necesita —aunque no la
 * renderice— porque los nombres y subtítulos se posicionan reservando el alto
 * de la barra: con la barra oculta ese hueco los deja "volando" sobre el vídeo.
 *
 * `controlsVisible` es la preferencia del usuario (la que alterna la pestañita).
 * `controlsOccupySpace` es si la barra ocupa REALMENTE sitio abajo: en PiP se
 * renderiza reducida aunque el usuario la hubiera ocultado. VideoView usa esta
 * segunda para no bajar los nombres sobre una barra que sí está visible.
 */
const ControlsVisibilityContext = React.createContext<{
    controlsVisible: boolean;
    controlsOccupySpace: boolean;
    setControlsVisible: (visible: boolean) => void;
}>({
    controlsVisible: true,
    controlsOccupySpace: true,
    setControlsVisible: () => undefined,
});

/** Alto aproximado que ocupa la barra de controles sobre el borde inferior. */
const CONTROLS_BAR_HEIGHT = 110;
/** Alto de la pestañita que queda cuando la barra está oculta. */
const CONTROLS_TAB_HEIGHT = 34;

/**
 * Colores bien diferenciados sobre fondo oscuro (nombre = un color estable por hash).
 * Tonos saturados para que se note la diferencia entre personas.
 */
const SPEAKER_NAME_COLORS = [
    '#FF6B6B',
    '#4ECDC4',
    '#FFE066',
    '#A78BFA',
    '#FF8FAB',
    '#74C0FC',
    '#8CE99A',
    '#FFB347',
    '#E599F7',
    '#66D9E8',
    '#FFD43B',
    '#FF8787',
];

/**
 * How long the caller keeps ringing before giving up on an unanswered call.
 *
 * Must stay below the callee's native ring timeout in callkeep.service.ts: the
 * caller has to hang up while the incoming banner is still on screen, otherwise
 * the callee keeps ringing for a call nobody is placing any more.
 */
const UNANSWERED_CALL_TIMEOUT_MS = 60_000;

/**
 * Tope para establecer la conexion con LiveKit.
 *
 * Los reintentos solo se disparan con onDisconnected u onError. Si el socket se
 * queda colgando en silencio —red muy mala, un firewall que bloquea WebRTC— no
 * llega ninguno de los dos eventos y la pantalla se quedaba cargando para
 * siempre, sin error y sin salida.
 *
 * Por debajo de UNANSWERED_CALL_TIMEOUT_MS: si no se conecto en 20s, no va a
 * conectar, y es mejor decirlo que dejar al usuario esperando un minuto.
 */
const CONNECTION_TIMEOUT_MS = 20_000;

function colorForSpeakerName(name: string): string {
    const key = name.trim().toLowerCase() || '_';
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return SPEAKER_NAME_COLORS[Math.abs(h) % SPEAKER_NAME_COLORS.length];
}

function asOptionalString(value: unknown): string | undefined {
    if (value == null) return undefined;
    const text = String(value);
    return text.length > 0 ? text : undefined;
}

function getCallSessionIdFromPayload(payload: any): string | undefined {
    return asOptionalString(
        payload?.callSessionId ||
        payload?.call_session_id ||
        payload?.metadata?.callSessionId ||
        payload?.metadata?.call_session_id
    );
}

function broadcastCallEndedToChat(
    conversationId: string,
    senderId: string,
    messageId: string,
    createdAt: string,
    roomName?: string,
    callSessionId?: string,
) {
    const channel = supabase.channel(`chat:${conversationId.toLowerCase()}`);
    let sent = false;

    const cleanup = () => {
        void supabase.removeChannel(channel);
    };

    const timeout = setTimeout(cleanup, 2500);

    channel.subscribe(async (status) => {
        console.log('[CALL_DEBUG] CallScreen.broadcastCallEnded.subscribe', {
            status,
            sent,
            conversationId,
            senderId,
            messageId,
            createdAt,
            roomName,
            callSessionId,
        });

        if (status !== 'SUBSCRIBED' || sent) return;
        sent = true;
        clearTimeout(timeout);

        try {
            console.log('[CALL_DEBUG] CallScreen.broadcastCallEnded.send', {
                conversationId,
                senderId,
                messageId,
                createdAt,
                roomName,
                callSessionId,
            });
            await channel.send({
                type: 'broadcast',
                event: 'new_message',
                payload: {
                    id: messageId,
                    conversationId,
                    senderId,
                    content: 'Llamada finalizada',
                    type: 'call_ended',
                    createdAt,
                    conversation_id: conversationId,
                    sender_id: senderId,
                    created_at: createdAt,
                    isMine: false,
                    metadata: {
                        roomName,
                        callSessionId,
                    },
                },
            });
        } catch (error) {
            console.warn('Could not broadcast call_ended fast path:', error);
        } finally {
            cleanup();
        }
    });
}

export interface CallScreenProps {
    roomName: string;
    username: string;
    conversationId?: string;
    userId?: string;
    callSessionId?: string;
    onBack: () => void;
    onCallRejected?: () => void;
    isManualPipMode?: boolean;
    onRestoreFromPip?: () => void;
    onMinimize?: () => void;
    onNavigate?: (screen: string, params?: any) => void;
    isIncomingCall?: boolean;
    /** Reingreso a una llamada ya activa (p. ej. "Unirse ahora"): sin timbre de salida. */
    suppressRinging?: boolean;
    nativeCallUUID?: string;
}

export const CallScreen = ({
    roomName,
    username,
    conversationId,
    userId,
    callSessionId,
    onBack,
    onCallRejected,
    isManualPipMode = false,
    onRestoreFromPip,
    onMinimize,
    onNavigate,
    isIncomingCall = false,
    suppressRinging = false,
    nativeCallUUID
}: CallScreenProps) => {
    const [token, setToken] = useState<string | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
    const [isFrontCamera, setIsFrontCamera] = useState(true);
    const [captionsVisible, setCaptionsVisible] = useState(true);
    // La barra arranca visible y solo se oculta/muestra con su pestañita, igual
    // que el patrón de los subtítulos (CC). No hay auto-ocultado por inactividad:
    // durante una llamada en lengua de señas las manos están ocupadas y una barra
    // que desaparece sola obligaría a tocar la pantalla para recuperarla.
    const [controlsVisible, setControlsVisible] = useState(true);
    // En PiP la barra se renderiza siempre (reducida), así que ahí sigue
    // ocupando sitio abajo aunque el usuario la hubiera ocultado. Se expone
    // aparte de la preferencia para que ocultar + entrar y salir de PiP no
    // "resucite" la barra: al volver se respeta lo que el usuario eligió.
    const controlsOccupySpace = controlsVisible || isManualPipMode;
    // Memoizado: sin esto, un objeto nuevo en cada render invalidaría el
    // contexto y volvería a renderizar todo el árbol de vídeo en cada tick.
    const controlsVisibilityValue = useMemo(
        () => ({ controlsVisible, controlsOccupySpace, setControlsVisible }),
        [controlsVisible, controlsOccupySpace]
    );
    const [roomRenderKey, setRoomRenderKey] = useState(0);
    const [isRoomConnected, setIsRoomConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const hasExitedRef = useRef(false);
    const hasConnectedRef = useRef(false);
    const reconnectAttemptsRef = useRef(0);
    // Humanos remotos actualmente en la sala (lo mantiene RoomEvents). Un
    // evento terminal remoto con 2+ humanos aún conectados solo significa que
    // ALGUIEN colgó, no que la llamada haya terminado para nosotros.
    const remoteHumansRef = useRef(0);

    const handleRemoteHumanCountChange = useCallback((count: number) => {
        remoteHumansRef.current = count;
    }, []);

    useEffect(() => {
        Keyboard.dismiss();
        CallState.setActiveCallScreen({
            roomName,
            conversationId,
            callSessionId,
            nativeCallUUID,
        });
        return () => {
            CallState.clearActiveCallScreen();
            // Garantizar que la llamada nativa muera cuando salimos de la pantalla (evita que se quede atascada)
            try {
                callKeepService.endAllCallsSilently();
            } catch (e) {
                console.warn('[CallScreen] Error ending native call on unmount:', e);
            }
        };
    }, [roomName, conversationId, callSessionId, nativeCallUUID]);

    useEffect(() => {
        Keyboard.dismiss();
    }, [roomName, callSessionId]);

    const safeOnBack = useCallback(() => {
        if (hasExitedRef.current) return;
        hasExitedRef.current = true;
        onBack();
    }, [onBack]);

    const hasSavedRemoteEndRef = useRef(false);
    // When the remote side ends the call, the terminal message travels from the
    // other device's JS (which iOS may kill mid-flight). Persist a local marker
    // so this side's "Unirse ahora" card always dies even if that message is lost.
    const persistRemoteEndLocally = useCallback((messageType?: string) => {
        if (hasSavedRemoteEndRef.current || !conversationId) return;
        hasSavedRemoteEndRef.current = true;

        let content = 'Llamada finalizada';
        if (messageType === 'call_rejected') content = 'Llamada rechazada';
        if (messageType === 'call_missed') content = 'Llamada perdida';

        const localMsgs = require('../database/chatDatabase').getMessages(conversationId);
        const latestCall = [...localMsgs].reverse().find((m: any) => m.type === 'call');
        let markerTime = Date.now();
        if (latestCall?.createdAt) {
            const callTimeMs = new Date(String(latestCall.createdAt).replace(' ', 'T')).getTime();
            if (markerTime <= callTimeMs) markerTime = callTimeMs + 1000;
        }
        const now = new Date(markerTime).toISOString();
        const markerId = `call_remote_end_${Date.now()}`;

        saveMessage({
            id: markerId,
            serverId: markerId,
            conversationId,
            senderId: 'system',
            content,
            type: 'call_ended',
            status: 'sent',
            createdAt: now,
            updatedAt: now,
            isMine: false,
            metadata: {
                roomName,
                callSessionId,
            },
        });
        updateConversationPreview(conversationId, content, now, false);
        DeviceEventEmitter.emit('chat_local_update', conversationId);
        DeviceEventEmitter.emit('conversations_updated');
    }, [conversationId, roomName, callSessionId]);

    // Cierre por "quedé solo en la sala" (RoomEvents). En el flujo normal el
    // penúltimo en colgar ya emitió el call_ended, pero si su app murió sin
    // colgar (crash, pérdida de red, batería) nadie emite el terminal que
    // apaga la caja "Unirse ahora" en los chats del resto: lo emite aquí el
    // último humano al salir. Si ya procesamos un fin remoto
    // (hasSavedRemoteEndRef), el terminal ya existe y solo salimos.
    const emitTerminalAsLastHuman = useCallback(() => {
        if (!hasExitedRef.current && conversationId && userId && !hasSavedRemoteEndRef.current) {
            console.log('[CALL_DEBUG] Last human leaving room; emitting terminal call_ended.', {
                conversationId,
                roomName,
                callSessionId,
            });
            persistRemoteEndLocally('call_ended');

            const tempId = `call_last_leave_${Date.now()}`;
            const now = new Date().toISOString();
            broadcastCallEndedToChat(conversationId, userId, tempId, now, roomName, callSessionId);
            chatService.sendMessage({
                conversationId,
                senderId: userId,
                content: 'Llamada finalizada',
                type: 'call_ended',
                metadata: {
                    roomName,
                    callSessionId,
                },
            }).catch(e => console.log('Could not send last-participant call_ended:', e));
        }
        safeOnBack();
    }, [conversationId, userId, roomName, callSessionId, persistRemoteEndLocally, safeOnBack]);

    // En llamadas grupales, los eventos terminales remotos (call_ended,
    // call_rejected) llegan a TODOS los participantes aunque solo uno haya
    // colgado. Si todavía quedan 2+ humanos en la sala, la llamada sigue viva
    // para nosotros; con 1 o 0 el evento sí es un cierre real (o el emisor es
    // ese último humano cuyo disconnect de LiveKit aún no se registró).
    const shouldKeepGroupCallAlive = useCallback((source: string) => {
        if (remoteHumansRef.current >= 2) {
            console.log('[CALL_DEBUG] Ignoring remote terminal event; group call still has other humans.', {
                source,
                remoteHumans: remoteHumansRef.current,
                conversationId,
                roomName,
                callSessionId,
            });
            return true;
        }
        return false;
    }, [conversationId, roomName, callSessionId]);

    const retryRoomConnection = useCallback(() => {
        setConnectionError(null);
        setIsRoomConnected(false);
        hasConnectedRef.current = false;
        reconnectAttemptsRef.current = 0;
        setRoomRenderKey((value) => value + 1);
    }, []);

    const handleRoomConnected = useCallback(() => {
        console.log('[CALL_DEBUG] LiveKit connected.', { roomName, conversationId, callSessionId });
        hasConnectedRef.current = true;
        reconnectAttemptsRef.current = 0;
        setConnectionError(null);
        setIsRoomConnected(true);
        // El backend crea el mensaje 'call' al iniciar la sesión; sin este sync
        // el chat abierto debajo no muestra la cajita de llamada en vivo.
        if (conversationId) {
            DeviceEventEmitter.emit('chat_sync_requested', conversationId);
        }
    }, [roomName, conversationId, callSessionId]);

    // Red de seguridad: si en CONNECTION_TIMEOUT_MS no se establecio la
    // conexion, se corta con un mensaje en vez de dejar la pantalla cargando.
    // Solo actua en la conexion INICIAL: una vez conectado, las caidas
    // posteriores las gestiona el reconector de LiveKit.
    useEffect(() => {
        if (isRoomConnected || connectionError || hasConnectedRef.current) return;
        if (!token || !url) return;

        const temporizador = setTimeout(() => {
            if (hasConnectedRef.current || hasExitedRef.current) return;
            console.warn('[CALL_DEBUG] Tiempo de conexión agotado sin respuesta de LiveKit.');
            setConnectionError('La llamada tardó demasiado en conectar. Revisa tu conexión e intenta de nuevo.');
        }, CONNECTION_TIMEOUT_MS);

        return () => clearTimeout(temporizador);
    }, [token, url, isRoomConnected, connectionError, roomRenderKey]);

    const handleRoomDisconnected = useCallback(() => {
        console.log('[CALL_DEBUG] LiveKit disconnected.', {
            roomName,
            conversationId,
            callSessionId,
            hasExited: hasExitedRef.current,
            hadConnected: hasConnectedRef.current,
            reconnectAttempts: reconnectAttemptsRef.current,
        });

        setIsRoomConnected(false);

        if (hasExitedRef.current) return;

        if (!hasConnectedRef.current && reconnectAttemptsRef.current < 2) {
            reconnectAttemptsRef.current += 1;
            setRoomRenderKey((value) => value + 1);
            return;
        }

        if (!hasConnectedRef.current) {
            setConnectionError('No se pudo conectar la llamada. Intent? de nuevo.');
        }
    }, [roomName, conversationId, callSessionId]);

    const handleRoomError = useCallback((error: Error) => {
        console.error('[CALL_DEBUG] LiveKit connection error:', error);
        setIsRoomConnected(false);

        if (hasExitedRef.current) return;

        if (!hasConnectedRef.current && reconnectAttemptsRef.current < 2) {
            reconnectAttemptsRef.current += 1;
            setRoomRenderKey((value) => value + 1);
            return;
        }

        setConnectionError('No se pudo conectar la llamada. Intent? de nuevo.');
    }, []);

    // FAST BROADCAST LISTENER
    // Escucha directamente en el canal del chat para recibir el rechazo de la llamada a la velocidad de la luz
    useEffect(() => {
        if (!conversationId || !userId) return;

        const channel = supabase.channel(`chat:${conversationId.toLowerCase()}`)
            .on('broadcast', { event: 'call_ended' }, (payload) => {
                const data = payload.payload;
                const eventCallSessionId = getCallSessionIdFromPayload(data);

                if (callSessionId && eventCallSessionId && eventCallSessionId !== callSessionId) {
                    console.log('[CALL_DEBUG] Ignoring stale call_ended broadcast for different session.', {
                        currentCallSessionId: callSessionId,
                        eventCallSessionId,
                        conversationId,
                        roomName,
                    });
                    return;
                }

                if (data.senderId !== userId && (data.roomName === roomName || data.conversationId === conversationId)) {
                    if (shouldKeepGroupCallAlive('fast_broadcast')) return;
                    console.log('[CALL_DEBUG] Fast Broadcast remote call end detected, terminating local call...');
                    persistRemoteEndLocally(asOptionalString(data?.type));
                    safeOnBack();
                }
            })
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [conversationId, roomName, userId, callSessionId, safeOnBack, persistRemoteEndLocally, shouldKeepGroupCallAlive]);

    const handleCallTimeout = useCallback(() => {
        console.log(`Call timed out after ${UNANSWERED_CALL_TIMEOUT_MS}ms. Disconnecting...`);
        if (conversationId && userId) {
            // 1. Optimistic Local Save for Instant UI Feedback
            const tempId = `call_${Date.now()}`;
            const now = new Date().toISOString();
            
            saveMessage({
                id: tempId,
                serverId: tempId,
                conversationId,
                senderId: userId,
                content: 'Llamada perdida',
                type: 'call_missed',
                status: 'pending',
                createdAt: now,
                updatedAt: now,
                isMine: true,
                metadata: {
                    roomName,
                    callSessionId,
                },
            });
            
            // AVISO RÁPIDO PARA LIMPIAR PANTALLA RECEPTOR
            broadcastCallEndedToChat(conversationId, userId, tempId, now, roomName, callSessionId);

            DeviceEventEmitter.emit('chat_local_update', conversationId);
            updateConversationPreview(conversationId, 'Llamada perdida', now, false);
            DeviceEventEmitter.emit('conversations_updated');

            // 2. Network Sync
            chatService.sendMessage({
                conversationId,
                senderId: userId,
                content: 'Llamada perdida',
                type: 'call_missed',
                metadata: {
                    roomName,
                    callSessionId,
                },
            }).then(({ message: serverMsg }) => {
                deleteMessage(tempId);
                saveMessage({
                    id: serverMsg.id,
                    serverId: serverMsg.id,
                    conversationId,
                    senderId: userId,
                    content: serverMsg.content,
                    type: serverMsg.type,
                    status: 'sent',
                    createdAt: serverMsg.createdAt,
                    updatedAt: (serverMsg as any).updatedAt || now,
                    isMine: true,
                    metadata: {
                        roomName,
                        callSessionId,
                    },
                });
                DeviceEventEmitter.emit('chat_local_update', conversationId);
            }).catch(e => {
                console.log('Error sending timeout message:', e);
            });
        }
        safeOnBack();
    }, [conversationId, userId, roomName, callSessionId, safeOnBack]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('CallKeep_EndCall', (data) => {
            if (!data?.wasInsideCallScreen || isRoomConnected) return;

            const eventCallSessionId = getCallSessionIdFromPayload(data);
            if (callSessionId && eventCallSessionId && eventCallSessionId !== callSessionId) {
                return;
            }

            const eventConversationId = asOptionalString(data?.conversationId || data?.conversation_id);
            const eventRoomName = asOptionalString(data?.roomName || data?.room_name);
            const eventCallUUID = asOptionalString(data?.callUUID || data?.call_uuid);
            const hasRoutingData = Boolean(eventConversationId || eventRoomName || eventCallUUID);
            const matchesConversation = Boolean(eventConversationId && conversationId && eventConversationId.toLowerCase() === conversationId.toLowerCase());
            const matchesRoom = Boolean(eventRoomName && eventRoomName === roomName);
            const matchesUUID = Boolean(eventCallUUID && (eventCallUUID === roomName || eventCallUUID === conversationId));

            if (hasRoutingData && !matchesConversation && !matchesRoom && !matchesUUID) return;

            console.log('[CALL_DEBUG] Native CallKeep end while CallScreen is connecting; ending app call.');
            if (conversationId && userId) {
                const tempId = `call_native_end_${Date.now()}`;
                const now = new Date().toISOString();

                saveMessage({
                    id: tempId,
                    serverId: tempId,
                    conversationId,
                    senderId: userId,
                    content: 'Llamada finalizada',
                    type: 'call_ended',
                    status: 'pending',
                    createdAt: now,
                    updatedAt: now,
                    isMine: true,
                    metadata: {
                        roomName,
                        callSessionId,
                    },
                });
                broadcastCallEndedToChat(conversationId, userId, tempId, now, roomName, callSessionId);
                DeviceEventEmitter.emit('chat_local_update', conversationId);
                updateConversationPreview(conversationId, 'Llamada finalizada', now, false);
                DeviceEventEmitter.emit('conversations_updated');

                chatService.sendMessage({
                    conversationId,
                    senderId: userId,
                    content: 'Llamada finalizada',
                    type: 'call_ended',
                    metadata: {
                        roomName,
                        callSessionId,
                    },
                }).then(({ message: serverMsg }) => {
                    deleteMessage(tempId);
                    saveMessage({
                        id: serverMsg.id,
                        serverId: serverMsg.id,
                        conversationId,
                        senderId: userId,
                        content: 'Llamada finalizada',
                        type: 'call_ended',
                        status: 'sent',
                        createdAt: (serverMsg as any).createdAt || (serverMsg as any).created_at || now,
                        updatedAt: now,
                        isMine: true,
                        metadata: {
                            roomName,
                            callSessionId,
                        },
                    });
                    DeviceEventEmitter.emit('chat_local_update', conversationId);
                }).catch(e => console.log('Could not send native call_ended message:', e));
            }

            safeOnBack();
        });

        return () => sub.remove();
    }, [isRoomConnected, conversationId, userId, roomName, callSessionId, safeOnBack]);

    // Listen for remote call rejections/hang-ups
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('external_call_ended', (data) => {
            const eventCallSessionId = getCallSessionIdFromPayload(data);

            if (callSessionId && eventCallSessionId && eventCallSessionId !== callSessionId) {
                console.log('[CALL_DEBUG] Ignoring stale external_call_ended for different session.', {
                    currentCallSessionId: callSessionId,
                    eventCallSessionId,
                    conversationId,
                    roomName,
                });
                return;
            }

            if (data.conversationId === conversationId || data.roomName === roomName) {
                if (shouldKeepGroupCallAlive('external_call_ended')) return;
                console.log('[CALL_DEBUG] Remote call end detected, terminating local call...');
                persistRemoteEndLocally(asOptionalString(data?.type));
                safeOnBack();
            }
        });
        return () => sub.remove();
    }, [conversationId, roomName, callSessionId, safeOnBack, persistRemoteEndLocally, shouldKeepGroupCallAlive]);

    useEffect(() => {
        if (!conversationId) return;

        const activeCallChannel = supabase.channel(`active-call:${conversationId.toLowerCase()}`);

        activeCallChannel
            .on('broadcast', { event: 'new_message' }, (payload) => {
                const message = payload.payload as {
                    type?: string;
                    conversationId?: string;
                    conversation_id?: string;
                    senderId?: string;
                    sender_id?: string;
                    callSessionId?: string;
                    call_session_id?: string;
                    metadata?: { roomName?: string; callSessionId?: string; call_session_id?: string };
                    isGroup?: boolean | string;
                };

                const messageType = asOptionalString(message?.type);
                if (!messageType || !['call_ended', 'call_rejected', 'call_missed'].includes(messageType)) {
                    return;
                }

                // If it's a group call, one person rejecting the call doesn't mean the call ends for everyone.
                const isGroup = message?.isGroup === true || message?.isGroup === 'true';
                if (messageType === 'call_rejected' && isGroup) {
                    return;
                }

                const messageConversationId = asOptionalString(message?.conversationId || message?.conversation_id);
                const messageSenderId = asOptionalString(message?.senderId || message?.sender_id);
                const messageRoomName = asOptionalString(message?.metadata?.roomName);
                const messageCallSessionId = getCallSessionIdFromPayload(message);

                if (callSessionId && messageCallSessionId && messageCallSessionId !== callSessionId) {
                    console.log('[CALL_DEBUG] Ignoring stale terminal call event for different session.', {
                        conversationId,
                        roomName,
                        messageType,
                        currentCallSessionId: callSessionId,
                        messageCallSessionId,
                    });
                    return;
                }

                const matchesConversation = messageConversationId?.toLowerCase() === conversationId.toLowerCase();
                const matchesRoom = messageRoomName === roomName;

                if ((!matchesConversation && !matchesRoom) || (userId && messageSenderId === userId)) {
                    return;
                }

                if (shouldKeepGroupCallAlive('active_call_channel')) return;

                console.log('[CALL_DEBUG] Remote terminal call event received via chat broadcast, closing immediately.', {
                    conversationId,
                    roomName,
                    messageType,
                    messageConversationId,
                    messageSenderId,
                    messageRoomName,
                });
                persistRemoteEndLocally(messageType);
                safeOnBack();
            })
            .subscribe();

        return () => {
            void supabase.removeChannel(activeCallChannel);
        };
    }, [conversationId, roomName, userId, callSessionId, safeOnBack, persistRemoteEndLocally, shouldKeepGroupCallAlive]);

    // Do not save a generic call_ended marker on every unmount.
    // Hangup and remote-end flows already emit/persist terminal events; doing it here
    // creates duplicate call_ended rows and makes call-card matching noisy.

    // Apaga el agente Vosk en Model-ms al salir de la llamada (evita procesos colgados en active_agents).
    useEffect(() => {
        return () => {
            chatService.stopTranscription(roomName).catch(() => undefined);
        };
    }, [roomName]);

    useEffect(() => {
        let isMounted = true;
        hasExitedRef.current = false;
        setToken(null);
        setUrl(null);
        setIsRoomConnected(false);
        setConnectionError(null);
        hasConnectedRef.current = false;
        reconnectAttemptsRef.current = 0;
        setRoomRenderKey((value) => value + 1);

        const prepareSession = async () => {
            try {
                if (!userId) {
                    console.error('❌ Cannot request call token without userId');
                    if (isMounted) {
                        Alert.alert(
                            'Error',
                            'No se pudo identificar al usuario para unirse a la llamada.',
                            [{ text: 'Entendido', onPress: onCallRejected || safeOnBack }],
                            { cancelable: false },
                        );
                    }
                    return;
                }

                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                });

                const data = await apiClient<{ token?: string; url?: string; error?: string; message?: string }>('/calls/token', {
                    method: 'POST',
                    body: JSON.stringify({ roomName, username, userId }),
                });

                // El backend puede negar el token con una razón de negocio
                // (p. ej. la llamada ya tiene un intérprete conectado).
                if (data.error && isMounted) {
                    Alert.alert(
                        'Llamada ocupada',
                        data.message || 'Esta llamada ya se encuentra atendida por otro intérprete.',
                        [{ text: 'Entendido', onPress: onCallRejected || safeOnBack }],
                        { cancelable: false },
                    );
                    return;
                }

                if (data.token && isMounted) {
                    setToken(data.token);

                    if (typeof data.url === 'string' && data.url.startsWith('wss://')) {
                        setUrl(data.url);
                    } else {
                        console.error('❌ Backend did not provide a valid LiveKit URL. Connection failed.');
                        Alert.alert('Error', 'No se pudo configurar la conexión de video. Contacte a soporte.');
                    }
                }
            } catch (e) {
                // Antes esto solo hacia console.error: si /calls/token fallaba
                // (red, backend dormido, timeout) la pantalla se quedaba en el
                // estado de carga indefinidamente, sin error ni salida.
                console.error('Failed to setup call', e);
                if (isMounted) {
                    setConnectionError('No se pudo iniciar la llamada. Revisa tu conexión e intenta de nuevo.');
                }
            }
        };

        prepareSession();

        return () => { isMounted = false; };
    }, [roomName, username, userId, callSessionId, onCallRejected, safeOnBack]);

    if (connectionError) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>{connectionError}</Text>
                <View style={styles.connectionActions}>
                    <TouchableOpacity style={styles.retryButton} onPress={retryRoomConnection}>
                        <Text style={styles.retryButtonText}>Reintentar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.retryButton, styles.exitButton]} onPress={safeOnBack}>
                        <Text style={styles.retryButtonText}>Salir</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (!token || !url) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text style={styles.text}>Conectando a la sala...</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <LiveKitRoom
                key={`${roomName}-${roomRenderKey}`}
                serverUrl={url}
                token={token}
                connect={true}
                options={{ adaptiveStream: true }}
                audio={true}
                video={true}
                onConnected={handleRoomConnected}
                onDisconnected={handleRoomDisconnected}
                onError={handleRoomError}
            >
                {/* Montado desde el primer render de la sala: el timbre debe sonar
                    también durante la negociación de conexión, no solo tras
                    onConnected. El receptor no timbra pero conserva el timeout. */}
                <RingingSoundManager onTimeout={handleCallTimeout} shouldRing={!isIncomingCall && !suppressRinging} />
                {!isRoomConnected ? (
                    <View style={styles.connectingOverlay}>
                        <ActivityIndicator size="large" color="#7C3AED" />
                        <Text style={styles.text}>Conectando a la sala...</Text>
                    </View>
                ) : (
                    <CaptionsVisibilityContext.Provider value={{ captionsVisible, setCaptionsVisible }}>
                    <TranscriptionsProvider>
                    <ControlsVisibilityContext.Provider value={controlsVisibilityValue}>
                        <VideoView layoutMode={layoutMode} isFrontCamera={isFrontCamera} />
                        <ControlsView
                            onHangup={safeOnBack}
                            conversationId={conversationId}
                            userId={userId}
                            callSessionId={callSessionId}
                            roomName={roomName}
                            username={username}
                            layoutMode={layoutMode}
                            onToggleLayout={() => setLayoutMode(m => m === 'grid' ? 'interpreter' : 'grid')}
                            onToggleCameraFacing={() => setIsFrontCamera(prev => !prev)}
                            isFrontCamera={isFrontCamera}
                            isManualPipMode={isManualPipMode}
                            onRestoreFromPip={onRestoreFromPip}
                            onMinimize={onMinimize}
                            onBack={onBack}
                            onNavigate={onNavigate}
                        />
                        <RoomEvents
                            onLeave={safeOnBack}
                            exitIfEmptyAfterGrace={isIncomingCall}
                            onRemoteHumanCountChange={handleRemoteHumanCountChange}
                            onLastHumanLeft={emitTerminalAsLastHuman}
                        />
                    </ControlsVisibilityContext.Provider>
                    </TranscriptionsProvider>
                    </CaptionsVisibilityContext.Provider>
                )}
            </LiveKitRoom>
        </View>
    );
};

function payloadToUint8Array(payload: Uint8Array | ArrayBuffer | undefined): Uint8Array | null {
    if (payload == null) return null;
    if (payload instanceof Uint8Array) return payload;
    return new Uint8Array(payload);
}

function ParticipantTranscriptionOverlay({ participantIdentity, bottomOffset = 30 }: { participantIdentity: string, bottomOffset?: number }) {
    const room = useRoomContext();
    const { captionsVisible, setCaptionsVisible } = React.useContext(CaptionsVisibilityContext);
    const transcriptions = React.useContext(TranscriptionsContext);
    const [isLivekitConnected, setIsLivekitConnected] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    // La recepción vive en TranscriptionsProvider (un solo listener por sala).
    // Aquí solo se lee lo de este participante, así que un participante sin
    // vídeo ya no pierde sus subtítulos.
    const entry = transcriptions[participantIdentity];
    const finalLines = entry?.finals ?? [];
    const partialLine = entry?.partial ?? null;

    // Auto-scroll to bottom when new text arrives
    useEffect(() => {
        if (scrollRef.current) {
            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [finalLines, partialLine]);

    useEffect(() => {
        if (!room) return;
        const syncConnected = () => {
            setIsLivekitConnected(room.state === ConnectionState.Connected);
        };
        syncConnected();
        room.on(RoomEvent.ConnectionStateChanged, syncConnected);
        return () => {
            room.off(RoomEvent.ConnectionStateChanged, syncConnected);
        };
    }, [room]);

    if (!isLivekitConnected || !captionsVisible) return null;

    const hasContent = finalLines.length > 0 || !!partialLine;
    // Sin texto aún: no mostrar caja ni "esperando…" (menos invasivo).
    if (!hasContent) return null;

    return (
        <View style={[styles.participantTranscriptionContainer, { bottom: bottomOffset }]} pointerEvents="box-none">
            <TouchableOpacity
                style={styles.transcriptionCloseButton}
                onPress={() => setCaptionsVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Cerrar subtítulos"
            >
                <Text style={styles.transcriptionCloseText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.participantTranscriptionBox} pointerEvents="none">
                <ScrollView
                    ref={scrollRef}
                    style={styles.transcriptionScroll}
                    contentContainerStyle={styles.transcriptionScrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {finalLines.map((line) => (
                        <Text key={line.id} style={styles.transcriptionLineFinal}>
                            <Text style={styles.transcriptionUtterance}>{line.text}</Text>
                        </Text>
                    ))}
                    {partialLine ? (
                        <Text style={styles.transcriptionLinePartial}>
                            <Text style={styles.transcriptionUtterancePartial}>{partialLine.text}</Text>
                        </Text>
                    ) : null}
                </ScrollView>
            </View>
        </View>
    );
}

// Periodo de gracia tras conectar para que el otro participante aparezca (la
// negociación WebRTC no es instantánea). Si nunca llega, el otro colgó durante
// la conexión y hay que salir de inmediato, no esperar el timeout de llamada
// sin contestar (UNANSWERED_CALL_TIMEOUT_MS).
const EMPTY_ROOM_GRACE_MS = 3500;

function isHumanParticipant(participant: RemoteParticipant): boolean {
    const identity = participant.identity.toLowerCase();
    return !participant.isAgent &&
        !identity.includes('agent') &&
        !identity.includes('bot') &&
        !identity.includes('transcriber');
}

function RoomEvents({ onLeave, exitIfEmptyAfterGrace, onRemoteHumanCountChange, onLastHumanLeft }: {
    onLeave: () => void;
    exitIfEmptyAfterGrace: boolean;
    onRemoteHumanCountChange?: (count: number) => void;
    /** Cierre porque el último humano remoto se desconectó (yo quedé solo).
     * A diferencia de onLeave, aquí puede que nadie haya emitido el terminal
     * (crash del otro lado), así que el caller puede emitirlo antes de salir. */
    onLastHumanLeft?: () => void;
}) {
    const room = useRoomContext();

    const countRemoteHumans = useCallback(() => {
        if (!room) return 0;
        let count = 0;
        room.remoteParticipants.forEach((p) => {
            if (isHumanParticipant(p)) count++;
        });
        return count;
    }, [room]);

    // Mantiene en el CallScreen padre el conteo de humanos remotos para que
    // los listeners de cierre remoto sepan si la llamada grupal sigue viva.
    useEffect(() => {
        if (!room || !onRemoteHumanCountChange) return;

        const report = () => onRemoteHumanCountChange(countRemoteHumans());
        report();

        room.on('participantConnected', report);
        room.on('participantDisconnected', report);
        return () => {
            room.off('participantConnected', report);
            room.off('participantDisconnected', report);
            onRemoteHumanCountChange(0);
        };
    }, [room, onRemoteHumanCountChange, countRemoteHumans]);

    // 1. Cierre cuando el otro humano se desconecta de la sala (caso normal).
    useEffect(() => {
        if (!room) return;

        const onParticipantDisconnected = (participant: RemoteParticipant) => {
            if (!participant || !isHumanParticipant(participant)) return;
            if (countRemoteHumans() === 0) {
                (onLastHumanLeft || onLeave)();
            }
        };

        room.on('participantDisconnected', onParticipantDisconnected);
        return () => {
            room.off('participantDisconnected', onParticipantDisconnected);
        };
    }, [room, onLeave, onLastHumanLeft, countRemoteHumans]);

    // 2. Carrera "el receptor entra justo cuando el llamante cuelga": el otro
    // pudo colgar antes de aparecer en la sala, así que participantDisconnected
    // nunca dispara. Si tras un periodo de gracia sigue sin haber otro humano,
    // salir de inmediato en vez de quedar un minuto en una llamada fantasma.
    // SOLO para quien se une a una llamada ya existente (receptor): el llamante
    // espera legítimamente solo en la sala mientras al otro le suena — su caso
    // "nadie contesta" lo cubre UNANSWERED_CALL_TIMEOUT_MS del RingingSoundManager.
    useEffect(() => {
        if (!room || !exitIfEmptyAfterGrace) return;

        // Ya hay alguien: no aplica la salida por sala vacía.
        if (countRemoteHumans() > 0) return;

        const graceTimer = setTimeout(() => {
            if (countRemoteHumans() === 0) {
                console.log('[CALL_DEBUG] Room still empty after grace period; the other party hung up during connect. Leaving.');
                onLeave();
            }
        }, EMPTY_ROOM_GRACE_MS);

        // Si el otro llega dentro del periodo de gracia, cancelar la salida.
        const onParticipantConnected = (participant: RemoteParticipant) => {
            if (participant && isHumanParticipant(participant)) {
                clearTimeout(graceTimer);
            }
        };
        room.on('participantConnected', onParticipantConnected);

        return () => {
            clearTimeout(graceTimer);
            room.off('participantConnected', onParticipantConnected);
        };
    }, [room, onLeave, countRemoteHumans, exitIfEmptyAfterGrace]);

    return null;
}

function RingingSoundManager({ onTimeout, shouldRing = true }: { onTimeout?: () => void; shouldRing?: boolean }) {
    const participants = useParticipants();
    const room = useRoomContext();
    const soundRef = useRef<Audio.Sound | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const soundGenerationRef = useRef(0);

    // Keep a fresh reference to onTimeout to avoid re-triggering effects or stale closures
    const onTimeoutRef = useRef(onTimeout);
    useEffect(() => {
        onTimeoutRef.current = onTimeout;
    }, [onTimeout]);

    const humanCount = participants.filter(p => !p.identity.toLowerCase().startsWith('transcriber-')).length;

    const stopRingingSound = async () => {
        soundGenerationRef.current += 1;
        const sound = soundRef.current;
        soundRef.current = null;
        if (!sound) return;

        try {
            await sound.stopAsync();
        } catch { }
        try {
            await sound.unloadAsync();
        } catch { }
    };

    useEffect(() => {
        let isMounted = true;
        const generation = ++soundGenerationRef.current;

        const playSound = async () => {
            try {
                // If only local participant is in the room, play dialing sound
                if (humanCount <= 1) {
                    if (!timeoutRef.current) {
                        timeoutRef.current = setTimeout(() => {
                            if (onTimeoutRef.current) {
                                room.disconnect().catch(e => console.error('Error disconnecting room on timeout:', e));
                                onTimeoutRef.current();
                            }
                        }, UNANSWERED_CALL_TIMEOUT_MS);
                    }

                    if (!soundRef.current && shouldRing) {
                        const { sound } = await Audio.Sound.createAsync(
                            require('../../assets/ringing.wav'),
                            { shouldPlay: true, isLooping: true }
                        );
                        if (isMounted && generation === soundGenerationRef.current) {
                            soundRef.current = sound;
                            // expo-av re-aplica PlayAndRecord sin .defaultToSpeaker
                            // (allowsRecordingIOS) y iOS enruta al auricular, donde
                            // el timbre es inaudible. Forzar altavoz explícitamente;
                            // en una videollamada es la ruta esperada de todos modos.
                            if (Platform.OS === 'ios') {
                                AudioSession.selectAudioOutput('force_speaker').catch(() => undefined);
                            }
                        } else {
                            await sound.stopAsync().catch(() => undefined);
                            await sound.unloadAsync().catch(() => undefined);
                        }
                    }
                } else {
                    // Someone joined, stop ringing
                    if (timeoutRef.current) {
                        clearTimeout(timeoutRef.current);
                        timeoutRef.current = null;
                    }
                    await stopRingingSound();
                }
            } catch (error) {
                console.log('Error managing ringing sound', error);
            }
        };

        playSound();

        return () => {
            isMounted = false;
            void stopRingingSound();
        };
    }, [humanCount, room, shouldRing]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            void stopRingingSound();
        };
    }, []);

    return null;
}

function isInterpreterIdentity(identity: string): boolean {
    const normalized = identity.toLowerCase();
    return normalized.includes('interp') || normalized.includes('intérp');
}

/** Nombre visible en la UI de la llamada (p. ej. "Intérprete: Ana"). */
function formatParticipantDisplayName(identity: string): string {
    const trimmed = (identity || '').trim();
    if (/^interpreter:/i.test(trimmed)) {
        return 'Intérprete';
    }
    // Normaliza "interprete:" / "intérprete:" a "Intérprete: <nombre>"
    const match = trimmed.match(/^int[eé]rprete\s*:\s*(.+)$/i);
    if (match) {
        return `Intérprete: ${match[1].trim()}`;
    }
    return trimmed;
}

function VideoView({ layoutMode, isFrontCamera }: { layoutMode: LayoutMode, isFrontCamera: boolean }) {
    const tracks = useTracks([Track.Source.Camera]);
    const { height: screenHeight } = Dimensions.get('window');
    const insets = useSafeAreaInsets();
    // Se usa controlsOccupySpace (no la preferencia): en PiP la barra sigue
    // ocupando sitio, y bajar los nombres ahí los solaparía con ella.
    const { controlsOccupySpace } = React.useContext(ControlsVisibilityContext);

    const interpreterTracks = tracks.filter(t => isInterpreterIdentity(t.participant.identity));
    const otherTracks = tracks.filter(t => !isInterpreterIdentity(t.participant.identity));

    const renderParticipant = (track: typeof tracks[number], width: DimensionValue, height: DimensionValue, isBottomRow: boolean = true) => {
        // Use percentage-based offsets relative to the tile height so labels
        // render consistently across devices regardless of screen size / density.
        const numericHeight = typeof height === 'number' ? height : undefined;
        // Con la barra oculta solo queda la pestañita, así que el hueco que hay
        // que reservar abajo es mucho menor: si se mantuviera el de la barra,
        // el nombre se quedaría flotando en mitad del vídeo.
        const reservedBottom = controlsOccupySpace ? CONTROLS_BAR_HEIGHT : CONTROLS_TAB_HEIGHT;
        // The controls container takes up ~100px + insets.bottom.
        // We position the label safely above it using absolute math so they never cross.
        // El mínimo proporcional (18%/25%) solo aplica con la barra visible: es
        // un colchón para pantallas grandes, pero con la barra oculta volvería a
        // levantar el nombre justo lo que se pretende evitar.
        const labelBottom = isBottomRow
            ? (controlsOccupySpace
                ? Math.max(reservedBottom + insets.bottom, numericHeight ? numericHeight * 0.18 : reservedBottom)
                : reservedBottom + insets.bottom)
            : 8;
        const transcriptionBottom = isBottomRow
            ? (controlsOccupySpace
                ? Math.max(140 + insets.bottom, numericHeight ? numericHeight * 0.25 : 140)
                : reservedBottom + insets.bottom + 30)
            : 40;
        const displayName = formatParticipantDisplayName(track.participant.identity);

        return (
            <View key={track.participant.identity} style={[styles.participant, { width, height }]}>
                {track.publication.isMuted ? (
                    <View style={[styles.video, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ color: '#666' }}>{displayName}</Text>
                    </View>
                ) : (
                    <VideoTrack
                        trackRef={track}
                        style={styles.video}
                        mirror={track.participant.isLocal && isFrontCamera}
                    />
                )}
                <View style={[styles.participantLabel, { bottom: labelBottom }]}>
                    <Text style={styles.participantName} numberOfLines={1}>
                        {displayName}
                    </Text>
                </View>
                <ParticipantTranscriptionOverlay participantIdentity={track.participant.identity} bottomOffset={transcriptionBottom} />
            </View>
        );
    };

    if (layoutMode === 'grid' || interpreterTracks.length === 0) {
        const count = tracks.length;

        if (count <= 1) {
            return (
                <View style={styles.videoGrid}>
                    {tracks.map(t => renderParticipant(t, '100%', '100%', true))}
                </View>
            );
        }

        if (count === 2) {
            return (
                <View style={styles.videoGrid}>
                    {tracks.map((t, index) => renderParticipant(t, '100%', '50%', index === 1))}
                </View>
            );
        }

        if (count === 3) {
            return (
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', height: '50%' }}>
                        {renderParticipant(tracks[0], '50%', '100%', false)}
                        {renderParticipant(tracks[1], '50%', '100%', false)}
                    </View>
                    <View style={{ height: '50%' }}>
                        {renderParticipant(tracks[2], '100%', '100%', true)}
                    </View>
                </View>
            );
        }

        // 4+ participants: 2-column grid
        const cols = 2;
        const rows = Math.ceil(count / cols);
        const tileW: DimensionValue = `${100 / cols}%`;
        const tileH: DimensionValue = `${100 / rows}%`;

        return (
            <View style={styles.videoGrid}>
                {tracks.map((t, index) => {
                    const isBottomRow = index >= (rows - 1) * cols;
                    return renderParticipant(t, tileW, tileH, isBottomRow);
                })}
            </View>
        );
    }

    return (
        <View style={styles.interpreterLayout}>
            <View style={styles.mainVideoArea}>
                {interpreterTracks.length > 0 ? (
                    interpreterTracks.map((track) => {
                        const displayName = formatParticipantDisplayName(track.participant.identity);
                        return (
                        <View key={track.participant.identity} style={styles.mainParticipant}>
                            {track.publication.isMuted ? (
                                <View style={[styles.video, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={{ color: '#666', fontSize: 18 }}>{displayName} - Cámara off</Text>
                                </View>
                            ) : (
                                <VideoTrack
                                    trackRef={track}
                                    style={styles.video}
                                    mirror={track.participant.isLocal && isFrontCamera}
                                />
                            )}
                            <View style={[styles.interpreterMainLabel, { bottom: Math.max(110 + insets.bottom, screenHeight * 0.12) }]}>
                                <Text style={styles.interpreterMainName}>{displayName}</Text>
                            </View>
                            <ParticipantTranscriptionOverlay participantIdentity={track.participant.identity} bottomOffset={Math.max(140 + insets.bottom, screenHeight * 0.20)} />
                        </View>
                        );
                    })
                ) : (
                    <View style={[styles.video, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ color: '#666' }}>Esperando intérprete...</Text>
                    </View>
                )}
            </View>

            <View style={styles.participantsSidebar}>
                {otherTracks.map((track) => (
                    <View key={track.participant.identity} style={styles.sidebarVideo}>
                        {track.publication.isMuted ? (
                            <View style={[styles.video, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ color: '#666', fontSize: 10 }}>{formatParticipantDisplayName(track.participant.identity)}</Text>
                            </View>
                        ) : (
                            <VideoTrack
                                trackRef={track}
                                style={styles.video}
                                mirror={track.participant.isLocal && isFrontCamera}
                            />
                        )}
                        <View style={styles.sidebarLabel}>
                            <Text style={styles.sidebarName} numberOfLines={1}>
                                {formatParticipantDisplayName(track.participant.identity)}
                            </Text>
                        </View>
                        <ParticipantTranscriptionOverlay participantIdentity={track.participant.identity} bottomOffset={35} />
                    </View>
                ))}
            </View>
        </View>
    );
}

function ControlsView({
    onHangup,
    conversationId,
    userId,
    callSessionId,
    roomName,
    username,
    layoutMode,
    onToggleLayout,
    onToggleCameraFacing,
    isFrontCamera,
    isManualPipMode,
    onRestoreFromPip,
    onMinimize,
    onBack,
    onNavigate
}: {
    onHangup: () => void;
    conversationId?: string;
    userId?: string;
    callSessionId?: string;
    roomName: string;
    username: string;
    layoutMode: LayoutMode;
    onToggleLayout: () => void;
    onToggleCameraFacing: () => void;
    isFrontCamera: boolean;
    isManualPipMode: boolean;
    onRestoreFromPip?: () => void;
    onMinimize?: () => void;
    onBack: () => void;
    onNavigate?: (screen: string, params?: any) => void;
}) {
    const { user } = useAuth();
    const { isMicrophoneEnabled, isCameraEnabled, localParticipant, cameraTrack } = useLocalParticipant();
    const room = useRoomContext();
    const { captionsVisible, setCaptionsVisible } = React.useContext(CaptionsVisibilityContext);
    const { canUseInterpreter } = useSubscription(userId);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    // Vive en el contexto (no en estado local) porque VideoView también lo
    // necesita para bajar los nombres y subtítulos cuando la barra se oculta.
    const { controlsVisible, setControlsVisible } = React.useContext(ControlsVisibilityContext);
    const insets = useSafeAreaInsets();
    const hasDisconnectedRef = useRef(false);

    const toggleMic = async () => {
        const enabled = !isMicrophoneEnabled;
        await localParticipant.setMicrophoneEnabled(enabled);
    };

    const toggleCam = async () => {
        const enabled = !isCameraEnabled;
        await localParticipant.setCameraEnabled(enabled);
    };

    const flipCamera = async () => {
        try {
            const track = cameraTrack?.videoTrack as any;
            if (track && typeof track.restartTrack === 'function') {
                const newFacingMode = isFrontCamera ? 'environment' : 'user';
                await track.restartTrack({ facingMode: newFacingMode });
                onToggleCameraFacing();
            } else {
                console.error('No camera track or restartTrack available to switch');
            }
        } catch (e) {
            console.error('Error switching camera:', e);
        }
    };

    const handleDisconnect = useCallback(() => {
        if (hasDisconnectedRef.current) return;
        hasDisconnectedRef.current = true;

        // Si tras mi salida quedan 2+ humanos en la sala, la llamada grupal
        // sigue sin mí: no emitir ningún terminal call_ended (el broadcast y
        // el mensaje de API colgarían la llamada en todos los demás
        // dispositivos). El último par restante sí emite el terminal, y el
        // último humano solo se cierra vía RoomEvents.
        let remainingHumans = 0;
        room?.remoteParticipants?.forEach((p) => {
            if (isHumanParticipant(p)) remainingHumans++;
        });
        const groupCallContinues = remainingHumans >= 2;

        console.log('[CALL_DEBUG] CallScreen.handleDisconnect.start', {
            conversationId,
            userId,
            roomName,
            callSessionId,
            remainingHumans,
            groupCallContinues,
        });

        // Disconnect immediately to avoid UI hang
        if (room) {
            room.disconnect().catch(e => console.error('Error disconnecting room:', e));
        }
        onHangup();

        // Perform side-effects in the background
        if (conversationId && userId && !groupCallContinues) {
            const tempId = `call_${Date.now()}`;
            const now = new Date().toISOString();

            // Fetch the latest call to ensure our marker is strictly newer than the call message
            const localMsgs = require('../database/chatDatabase').getMessages(conversationId);
            const latestCall = localMsgs.find((m: any) => m.type === 'call');
            let markerTime = Date.now();
            if (latestCall && latestCall.createdAt) {
                const callTimeMs = new Date(latestCall.createdAt.replace(' ', 'T')).getTime();
                if (markerTime <= callTimeMs) {
                    markerTime = callTimeMs + 1000;
                }
            }
            const markerDateStr = new Date(markerTime).toISOString();
            console.log('[CALL_DEBUG] CallScreen.handleDisconnect.marker', {
                tempId,
                conversationId,
                userId,
                roomName,
                callSessionId,
                latestCallId: latestCall?.id,
                latestCallCreatedAt: latestCall?.createdAt,
                markerDateStr,
            });

            // 1. Optimistic Local Save — caller's chat updates instantly
            saveMessage({
                id: tempId,
                serverId: tempId,
                conversationId,
                senderId: userId,
                content: 'Llamada finalizada',
                type: 'call_ended',
                status: 'pending',
                createdAt: markerDateStr,
                updatedAt: markerDateStr,
                isMine: true,
                metadata: {
                    roomName,
                    callSessionId,
                },
            });
            broadcastCallEndedToChat(conversationId, userId, tempId, markerDateStr, roomName, callSessionId);
            DeviceEventEmitter.emit('chat_local_update', conversationId);
            updateConversationPreview(conversationId, 'Llamada finalizada', now, false);
            DeviceEventEmitter.emit('conversations_updated');

            // 2. SLOW PATH — API call for server persistence (creates the DB record)
            chatService.sendMessage({
                conversationId,
                senderId: userId,
                content: 'Llamada finalizada',
                type: 'call_ended',
                metadata: {
                    roomName,
                    callSessionId,
                },
            }).then(({ message: serverMsg }) => {
                deleteMessage(tempId);
                saveMessage({
                    id: serverMsg.id,
                    serverId: serverMsg.id,
                    conversationId,
                    senderId: userId,
                    content: 'Llamada finalizada',
                    type: 'call_ended',
                    status: 'sent',
                    createdAt: (serverMsg as any).createdAt || (serverMsg as any).created_at || now,
                    updatedAt: now,
                    isMine: true,
                    metadata: {
                        roomName,
                        callSessionId,
                    },
                });
                DeviceEventEmitter.emit('chat_local_update', conversationId);
            }).catch(e => console.log('Could not send call_ended message:', e));
        }

        if (user?.role === 'interpreter' && user.id) {
            chatService.updateInterpreterStatus(user.id, false)
                .catch(e => console.error('Error updating interpreter status:', e));
        }
    }, [room, onHangup, conversationId, userId, roomName, callSessionId, user?.role, user?.id]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('CallKeep_EndCall', (data) => {
            if (!data?.wasInsideCallScreen) return;

            const eventCallSessionId = getCallSessionIdFromPayload(data);
            if (callSessionId && eventCallSessionId && eventCallSessionId !== callSessionId) {
                console.log('[CALL_DEBUG] Ignoring native end for different call session.', {
                    currentCallSessionId: callSessionId,
                    eventCallSessionId,
                    conversationId,
                    roomName,
                });
                return;
            }

            const eventConversationId = asOptionalString(data?.conversationId || data?.conversation_id);
            const eventRoomName = asOptionalString(data?.roomName || data?.room_name);
            const eventCallUUID = asOptionalString(data?.callUUID || data?.call_uuid);
            const hasRoutingData = Boolean(eventConversationId || eventRoomName || eventCallUUID);
            const matchesConversation = Boolean(eventConversationId && conversationId && eventConversationId.toLowerCase() === conversationId.toLowerCase());
            const matchesRoom = Boolean(eventRoomName && eventRoomName === roomName);
            const matchesUUID = Boolean(eventCallUUID && (eventCallUUID === roomName || eventCallUUID === conversationId));

            if (hasRoutingData && !matchesConversation && !matchesRoom && !matchesUUID) {
                console.log('[CALL_DEBUG] Ignoring native end for unrelated call.', {
                    eventConversationId,
                    eventRoomName,
                    eventCallUUID,
                    conversationId,
                    roomName,
                });
                return;
            }

            console.log('[CALL_DEBUG] Native CallKeep end matched active CallScreen; hanging up app call.');
            handleDisconnect();
        });

        return () => sub.remove();
    }, [conversationId, roomName, callSessionId, handleDisconnect]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener(HANDOFF_ACTIVE_CALL_EVENT, (data) => {
            const eventCallSessionId = getCallSessionIdFromPayload(data);
            const eventConversationId = asOptionalString(data?.conversationId || data?.conversation_id);
            const eventRoomName = asOptionalString(data?.roomName || data?.room_name);
            const isSameCall = Boolean(
                (eventCallSessionId && callSessionId && eventCallSessionId === callSessionId) ||
                (eventConversationId && conversationId && eventConversationId.toLowerCase() === conversationId.toLowerCase()) ||
                (eventRoomName && eventRoomName === roomName)
            );

            if (isSameCall) {
                console.log('[CALL_DEBUG] Ignoring handoff event for the current active call.', {
                    conversationId,
                    roomName,
                    callSessionId,
                });
                return;
            }

            console.log('[CALL_DEBUG] Handoff requested; hanging up current CallScreen before joining incoming call.', {
                currentConversationId: conversationId,
                currentRoomName: roomName,
                currentCallSessionId: callSessionId,
                nextConversationId: eventConversationId,
                nextRoomName: eventRoomName,
                nextCallSessionId: eventCallSessionId,
            });
            handleDisconnect();
        });

        return () => sub.remove();
    }, [conversationId, roomName, callSessionId, handleDisconnect]);

    const handleInviteInterpreters = async () => {
        if (!userId) return;

        if (!canUseInterpreter) {
            setShowUpgradeModal(true);
            return;
        }

        try {
            Alert.alert(
                'Solicitar Intérprete',
                '¿Desea solicitar un intérprete para unirse a esta llamada?',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                        text: 'Solicitar',
                        onPress: async () => {
                            try {
                                const result = await chatService.inviteInterpreters({
                                    roomName,
                                    userId,
                                    username
                                });
                                if (result.success) {
                                    Alert.alert('Solicitud enviada', `Se ha notificado a ${result.count || 1} intérprete(s).`);
                                } else {
                                    Alert.alert('Info', result.message || 'No se pudo completar la solicitud.');
                                }
                            } catch (error) {
                                console.error('Error initiating invite:', error);
                                Alert.alert('Error', 'Hubo un error al solicitar intérprete.');
                            }
                        }
                    }
                ]
            );
        } catch (e) {
            console.error('Invite error', e);
        }
    };

    return (
        <>
            {isManualPipMode && (
                <TouchableOpacity
                    style={[styles.pipRestoreButton, { top: Math.max(insets.top + 10, 20) }]}
                    onPress={onRestoreFromPip}
                >
                    <Text style={{ fontSize: 24 }}>↗️</Text>
                </TouchableOpacity>
            )}

            {/* Con la barra oculta esta pestañita es el ÚNICO modo de traerla de
                vuelta, así que se renderiza siempre que la barra no esté visible.
                En PiP no aplica: ahí la barra se muestra reducida y sin toggle. */}
            {!controlsVisible && !isManualPipMode && (
                <TouchableOpacity
                    style={[
                        styles.controlsShowTab,
                        { marginBottom: Math.max(insets.bottom, 10) },
                    ]}
                    onPress={() => setControlsVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Mostrar barra de controles"
                    hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
                >
                    <Text style={styles.controlsTabText}>▲</Text>
                </TouchableOpacity>
            )}

            {(controlsVisible || isManualPipMode) && (
            <View style={[
                styles.controlsContainer,
                { paddingBottom: Math.max(insets.bottom, 10) + 16 },
                !isManualPipMode && {
                    left: -insets.left,
                    right: -insets.right,
                    paddingHorizontal: 20 + Math.max(insets.left, insets.right),
                },
                isManualPipMode && styles.controlsContainerMini
            ]}>
                {!isManualPipMode && (
                    <TouchableOpacity
                        style={styles.controlsHideTab}
                        onPress={() => setControlsVisible(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Ocultar barra de controles"
                        hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                    >
                        <Text style={styles.controlsTabText}>▼</Text>
                    </TouchableOpacity>
                )}
                {!captionsVisible && !isManualPipMode && (
                    <TouchableOpacity
                        style={styles.ccToggleBar}
                        onPress={() => setCaptionsVisible(true)}
                        accessibilityLabel="Mostrar subtítulos"
                    >
                        <Text style={styles.ccToggleBarText}>CC</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[styles.button, !isMicrophoneEnabled && styles.buttonDisabled]}
                    onPress={toggleMic}
                >
                    <MicrophoneIcon size={24} color={isMicrophoneEnabled ? '#000' : '#fff'} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: '#fff' }]}
                    onPress={handleInviteInterpreters}
                >
                    <Image
                        source={require('../../assets/icon.png')}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                        resizeMode="cover"
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.hangupButton]}
                    onPress={handleDisconnect}
                >
                    <PhoneIcon size={32} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, !isCameraEnabled && styles.buttonDisabled]}
                    onPress={toggleCam}
                >
                    <CameraIcon size={24} color={isCameraEnabled ? '#000' : '#fff'} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, !isCameraEnabled && styles.buttonDisabled]}
                    onPress={flipCamera}
                >
                    <SyncIcon size={24} color={isCameraEnabled ? '#000' : '#fff'} />
                </TouchableOpacity>
            </View>
            )}

            {/* Imported Modal Component for feature lock */}
            <UpgradeModal
                visible={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                feature="interpreter"
                onUpgradePress={() => {
                    setShowUpgradeModal(false);
                    // Defer the back and navigate to avoid crash from unmounting CallScreen while navigating
                    setTimeout(() => {
                        onBack();
                        if (onNavigate) {
                            onNavigate('profile', { openManagePlan: true });
                        }
                    }, 50);
                }}
            />
        </>
    );
}

