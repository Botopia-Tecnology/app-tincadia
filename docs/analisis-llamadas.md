# Análisis de arquitectura de llamadas y diagnóstico de bugs

> Fase 1 y 2 del plan de estabilización de llamadas. Generado antes de modificar código.

## 1. Arquitectura general

### Componentes

| Capa | Tecnología | Rol |
|---|---|---|
| Media (WebRTC) | LiveKit (`@livekit/react-native`) | Salas de video. El backend emite tokens en `POST /calls/token`. |
| Señalización rápida | Supabase Realtime (broadcasts) | Canales `user:{userId}` (incoming_call, call_ended, new_message) y `chat:{convId}` (new_message, call_ended, read, etc.). |
| Persistencia | Postgres (Supabase) + `postgres_changes` | Mensajes tipo `call`, `call_ended`, `call_rejected`, `call_missed`. |
| Push iOS | APNs VoIP (PushKit) vía `apn` en backend (`notifications.service.ts`) | Topic `com.tincadia.app.voip`. Despierta la app aunque esté cerrada. |
| Push Android | FCM data-only (firebase-admin) | `setBackgroundMessageHandler` en `index.ts` muestra CallKeep. |
| Push genérico | Expo Push | Fallback para usuarios sin token nativo; chat normal. |
| UI nativa de llamada | `react-native-callkeep` + `react-native-voip-push-notification` | CallKit (iOS) / ConnectionService (Android). AppDelegate inyectado por `plugins/withVoipAppDelegate.js`. |
| Estado local | SQLite (`chatDatabase`) + `CallState` (memoria) + `DeviceEventEmitter` | La UI (lista de chats, caja "Unirse ahora") se deriva de mensajes locales + `CallState`. |

### Flujo de llamada saliente (A llama a B)

1. `ChatView.handleCall` genera `roomName = conv_<convId>` y `callSessionId = call_<convId>_<ts>`, envía mensaje tipo `call` (sin await) y navega a `CallScreen`.
2. Backend `chat.service.sendMessage`: persiste el mensaje, y por cada destinatario:
   - VoIP push (si `voip_token`) — **genera `callUUID: crypto.randomUUID()` nuevo en cada push**.
   - FCM data (si `fcm_token`).
   - Broadcast `new_message` + `incoming_call` en `user:{recipientId}`.
3. `CallScreen` de A conecta a LiveKit; `RingingSoundManager` suena y agenda timeout de 30 s si nadie entra.

### Flujo de llamada entrante (B)

- **iOS (app cerrada/fondo)**: PushKit → AppDelegate reporta **incondicionalmente** `reportNewIncomingCall` a CallKit (obligación de Apple) → JS (`index.ts` / `callkeep.service`) registra contexto (roomName/conversationId/callSessionId) y marca `CallState.setIncomingCallActive`.
- **iOS (app viva)**: fallback por broadcast `incoming_call` con delay de 800 ms (solo si PushKit no registró ya la llamada).
- **Android**: FCM foreground (`useNotifications`) o background (`index.ts`) → `callKeepService.displayIncomingCall` (timeout local de 35 s).

### Contestar / rechazar / colgar

- **Contestar (UI nativa)**: `CallKeep answerCall` → `CallKeep_AnswerCall` → `useNotifications` resuelve routing (contexto nativo → CallState → metadata local) → cierra UI nativa (`endCallSilently`) → navega a `CallScreen`.
- **Contestar (caja "Unirse ahora")**: `ChatView.handleJoinCall` → `answerIncomingCallFromApp` o `endAllCallsSilently` → navega.
- **Rechazar (UI nativa)**: `CallKeep endCall` → `handleEndCall` → si no está suprimido: emite `CallKeep_EndCall`; `useNotifications` guarda mensaje optimista, broadcast rápido `call_ended` en `chat:{convId}` y `chatService.sendMessage(call_ended)`. Si la app estaba muerta, `callkeep.service` intenta enviar `call_rejected` leyendo el usuario de MMKV.
- **Colgar (dentro de la llamada)**: `ControlsView.handleDisconnect` → desconecta LiveKit, guarda `call_ended` optimista, broadcast rápido a `chat:{convId}`, API `sendMessage`.
- **Timeout 30 s (llamador)**: `handleCallTimeout` → `call_missed` (optimista + broadcast + API).
- **Timeout 35 s (receptor)**: timer en `callkeep.service.displayIncomingCall` → `endCall` (solo corre si JS está vivo).

### Cómo se refleja el fin de llamada en el receptor

Tres vías redundantes:
1. Broadcast `call_ended` en `user:{id}` (solo si el socket Supabase está vivo → **solo foreground**).
2. Push VoIP/FCM tipo `call_ended|call_missed|call_rejected` → limpia UI nativa (`endNativeCallFromPayload` / `handleVoipNotificationPayload`). **No persiste el mensaje terminal ni actualiza el preview local.**
3. `postgres_changes`/broadcast en `chat:{convId}` (solo si ese chat está abierto).

### Estados que gobiernan la UI

- **Caja "Unirse ahora"** (`MessageList`): se muestra para cada mensaje `call` que (a) tenga menos de 2 min, (b) no tenga terminal con el mismo `callSessionId`, y (c) no tenga terminal "legacy" (sin sessionId) dentro de su ventana de mensajes.
- **"Llamada entrante"** (`ChatListItem`): se muestra si `item.hasActiveIncomingCall` (=`CallState.hasIncomingCall(convId)`, estado **en memoria**) es true y el `lastMessage` menciona "llamada" sin ser terminal.

### Listeners y ciclo de vida

- `useNotifications`: FCM onMessage (solo foreground), canal `user:{id}` (foreground), CallKeep events, Expo notifications.
- `useChat`: canal `chat:{convId}` (solo con el chat abierto).
- `CallScreen`: canal `chat:{convId}` + `active-call:{convId}` + `external_call_ended` + `CallKeep_EndCall` + `HANDOFF`.
- **No existe ningún listener de `AppState` que re-sincronice nada al volver a foreground.** Este es el hueco transversal más importante (bugs 4, 5, 6, 7).

## 2. Archivos involucrados

App: `src/services/callkeep.service.ts`, `src/hooks/useNotifications.ts`, `src/lib/callState.ts`, `src/screens/CallScreen.tsx`, `src/components/chat/ChatView.tsx`, `src/components/chat/components/MessageList.tsx`, `src/components/chat/components/ChatListItem.tsx`, `src/hooks/useChat.ts`, `src/hooks/useChatList.ts`, `src/app/App.tsx`, `index.ts`, `plugins/withVoipAppDelegate.js`, `app.json`.

Backend: `chat-ms/src/chat/chat.service.ts`, `chat-ms/src/notifications/notifications.service.ts`.

## 3. Diagnóstico por bug

### Bug 1 — VoIP no funciona en App Store (sí en Debug/Release/TestFlight)

**No es (probablemente) código de la app.** Hallazgos de configuración:

1. **El backend decide sandbox vs producción por entorno**: `notifications.service.ts` usa `APN_PRODUCTION` y, si no existe, `NODE_ENV === 'production'`. Si el despliegue productivo no define ninguno, los pushes van al **gateway sandbox** y todo token de build de tienda falla con `BadDeviceToken`.
2. **El fallback enmascara el problema en pruebas**: en iOS con la app viva, el broadcast `incoming_call` muestra la UI nativa **sin necesidad de APNs** (delay 800 ms). Los testers de Debug/TestFlight suelen tener la app recién abierta → "funciona". En App Store el usuario real tiene la app cerrada → solo el push VoIP real puede despertar la app → falla. Esto explica por qué "TestFlight funciona" aunque APNs esté mal: TestFlight también usa APNs de producción, así que si de verdad llegaran pushes en TF con la app cerrada, deberían llegar igual en App Store.
3. `notification.expiry = 0` en el push VoIP = un solo intento de entrega; si el dispositivo está momentáneamente sin conexión, el push se descarta.
4. Tokens obsoletos: `result.failed` se loguea pero nunca invalida `voip_token` en BD.

**Verificación (antes de tocar nada)**: revisar logs del chat-ms en producción buscando `VoIP Push failed` (razones típicas: `BadDeviceToken` = mismatch sandbox/producción; `TopicDisallowed` = bundle id; `ExpiredProviderToken` = llave .p8). Confirmar en el despliegue: `APN_PRODUCTION=true`, `APN_KEY(_PATH)`, `APN_KEY_ID`, `APN_TEAM_ID`, `BUNDLE_ID=com.tincadia.app`.

### Bug 2 — El teclado queda abierto al entrar una llamada (iOS)

Hay varios `Keyboard.dismiss()` (en `navigate('call')`, en el callback de `useNotifications` y al montar `CallScreen`), pero **todos pueden ejecutarse mientras la app está `inactive`/`background`** (la UI de CallKit a pantalla completa pone la app en background). En iOS, `Keyboard.dismiss()` en ese estado es un no-op y iOS restaura el teclado al volver a `active`, cuando los efectos de montaje ya corrieron.

**Causa raíz**: falta un dismiss ligado al regreso a foreground cuando hay una llamada activa (y al momento en que empieza a sonar una entrante con la app viva).

### Bug 3 — B cuelga y la caja "Unirse ahora" sigue visible (iOS)

La caja desaparece solo cuando llega un mensaje terminal que "matchee" (por `callSessionId` o ventana legacy). Causas encontradas:

1. **El fin de llamada depende del JS del otro dispositivo**: cuando B rechaza desde la UI nativa con la app muerta, el envío del `call_rejected` corre en un contexto JS efímero (despertado por PushKit) que iOS puede matar antes de completar el POST → el backend nunca persiste el terminal → A nunca lo recibe.
2. **A no persiste ningún terminal cuando el cierre es remoto**: al recibir el broadcast rápido, `CallScreen` de A solo hace `safeOnBack()` (deliberado, para evitar duplicados), confiando en que el mensaje de B llegará. Si (1) falla, la caja queda viva hasta el expiry de 2 min.
3. `useChat` escucha `new_message` pero **no** el evento broadcast `call_ended` del canal `chat:{convId}` (el que B emite en su ruta de rechazo), así que esa vía rápida no guarda el terminal en A.

### Bug 4 — Tras el timeout de 30 s la lista sigue mostrando "Llamada entrante"

"Llamada entrante" aparece cuando `CallState.hasIncomingCall(convId)` es true. Causas:

1. **Los pushes terminales VoIP re-registran la llamada entrante (iOS)**: el AppDelegate reporta *todo* push VoIP como llamada entrante nueva (con `callUUID` **aleatorio nuevo por push**, generado por el backend). Ese reporte dispara `didDisplayIncomingCall` → `rememberDisplayedCallFromPayload` → `CallState.setIncomingCallActive(conversationId, …)` **incluso para `call_missed`/`call_ended`**. Si ese evento llega después del dismiss de `handleVoipNotificationPayload`, la conversación queda marcada con llamada entrante activa para siempre (estado en memoria, sin expiración).
2. La ruta de push en background (`index.ts`) **no persiste el mensaje terminal ni actualiza el preview** local; y al volver a foreground no hay resync (ver Bug 5), así que el preview queda en el estado previo.
3. El timer de 35 s del receptor (`callkeep.service`) es un `setTimeout` de JS: **no corre con la app en background/suspendida (iOS)**.

### Bug 5 — Callbacks que dejan de ejecutarse en background

Inventario de lo que muere en background:

| Mecanismo | iOS background | Android background |
|---|---|---|
| Supabase Realtime (`user:{id}`, `chat:{convId}`, `active-call:*`) | ❌ socket suspendido | ⚠️ Doze puede matarlo |
| `setTimeout` (timeout 35 s del receptor, handoff 450 ms) | ❌ | ⚠️ |
| FCM `onMessage` | n/a | ❌ (solo foreground; background va por `setBackgroundMessageHandler`) |
| Push VoIP/FCM (única vía confiable) | ✅ | ✅ |
| LiveKit/WebRTC callbacks en llamada activa | ✅ (background mode `voip`/`audio`) | ✅ (foreground service) |

**Causa raíz**: la app asume sockets siempre vivos y no tiene **reconciliación al volver a foreground** (re-sync de mensajes/estado de llamada, limpieza de `CallState` huérfano). El push background solo limpia UI nativa, no el estado de datos.

### Bug 6 — Dos cajas "Unirse ahora" simultáneas

`MessageList` renderiza una caja por **cada** mensaje `call` de menos de 2 min sin terminal asociado. Si el terminal de la primera llamada se perdió (bugs 3/5) y entra una segunda llamada dentro de la ventana, hay dos cajas. No hay regla de "máximo una llamada activa por conversación" en la UI.

### Bug 7 — Llamada fantasma tras background (crítico)

Cadena completa con las piezas anteriores:

1. B en background: sockets muertos; solo llega el push VoIP `call_ended` cuando A cuelga.
2. El backend genera un `callUUID` **aleatorio distinto** para el push terminal → el AppDelegate lo reporta como llamada nueva y el dismiss de JS termina **ese** UUID nuevo; la llamada original **puede quedar viva** en CallKit (y sus aliases `conv_<id>` → UUID viejo quedan en memoria, potencialmente re-mapeados al UUID nuevo).
3. `CallState`/aliases quedan sucios (Bug 4.1) y no hay reconciliación al volver a foreground (Bug 5).
4. Llega una llamada nueva. `handleJoinCall`/`answerIncomingCallFromApp(roomName)` resuelve `conv_<id>` contra el alias **viejo**, contesta/termina un UUID muerto, y el CallKit con una llamada fantasma activa retiene la sesión de audio → LiveKit no puede arrancar → `CallScreen` se queda en "Conectando a la sala..." indefinidamente.

## 4. Plan de solución (cambios mínimos)

Ordenados por impacto; cada uno es independiente y pequeño:

1. **Backend — `callUUID` estable por sesión** (`notifications.service.ts`): derivar el UUID del push de `callSessionId` (UUIDv5/hash) en lugar de `crypto.randomUUID()`. El push terminal lleva el mismo UUID que el push de llamada → el dismiss nativo cierra la llamada correcta. *Riesgo: bajo; CallKit ignora reportes duplicados del mismo UUID y el JS ya los dedupa (`displayedNativeCallUUIDs`).*
2. **App — no registrar pushes terminales como llamada entrante** (`callkeep.service.ts`): en `handleDidDisplayIncomingCall` / `rememberDisplayedCallFromPayload`, si el payload trae `type` terminal, no llamar `setIncomingCallActive`; en su lugar despachar el dismiss. Elimina el "Llamada entrante" fantasma (Bug 4). *Riesgo: bajo.*
3. **App — reconciliación al volver a foreground** (nuevo efecto en `useNotifications`): listener de `AppState`; al pasar a `active`: (a) `chat_sync_requested` global, (b) limpiar `CallState` de conversaciones cuyo mensaje `call` local ya expiró o tiene terminal, (c) si `CallState.isInsideCallScreen` → `Keyboard.dismiss()`. Cubre Bugs 2, 4, 5, 6, 7. *Riesgo: medio-bajo; solo lecturas locales + un sync.*
4. **App — persistir terminal en el lado que recibe el cierre remoto** (`CallScreen`): en los handlers de cierre remoto (fast broadcast / `external_call_ended`), guardar localmente un marcador terminal con el `callSessionId` actual antes de `safeOnBack()` (sin API, solo SQLite + preview). Garantiza que la caja de A muera aunque el mensaje de B nunca llegue (Bug 3). *Riesgo: bajo; los terminales no se renderizan como burbuja y `isDuplicateCallTerminal` ya dedupa la vía entrante.*
5. **App — una sola caja "Unirse ahora" por conversación** (`MessageList`): renderizar la caja solo para el **último** mensaje `call`; los anteriores se muestran como "Llamada finalizada". Elimina el duplicado visual (Bug 6) con un cambio local puro. *Riesgo: bajo.*
6. **App — teclado**: además de 3(c), `Keyboard.dismiss()` cuando empieza a sonar una entrante con app viva (en los puntos que llaman `displayIncomingCall` desde foreground). (Bug 2). *Riesgo: nulo.*
7. **Backend — robustecer VoIP push** (Bug 1, tras verificación de entorno): `expiry` razonable (+30 s) en vez de 0; loguear `result.failed[].response.reason` explícito. El fix principal de Bug 1 es **operativo**: `APN_PRODUCTION=true` + validación de llaves en el despliegue productivo.

### Validaciones pendientes antes/durante implementación

- Bug 1: requiere acceso a logs/env del backend productivo (no verificable desde el repo).
- Bug 2: el mecanismo exacto (dismiss en estado `inactive`) debe confirmarse en dispositivo; el fix 3(c)+6 cubre ambas variantes.
- Bug 7: reproducir tras fixes 1–3 para confirmar que el "cargando indefinido" era la sesión de audio retenida por la llamada CallKit fantasma.

## 5. Implementación realizada (Fase 3)

| # | Archivo | Cambio | Bugs |
|---|---|---|---|
| 1 | `chat-ms/src/notifications/notifications.service.ts` | `stableCallUUID(callSessionId)` (UUIDv5-like determinista) en vez de `crypto.randomUUID()` por push; `expiry = now+30s`; log de `response.reason` en fallos APNs. | 1, 4, 7 |
| 2 | `src/services/callkeep.service.ts` | `handleDidDisplayIncomingCall` detecta payloads terminales y los descarta con `reportCallEndedSilently` en vez de registrarlos como llamada entrante; el dismiss de pushes terminales ahora cierra por UUID + conversationId + roomName. | 4, 7 |
| 3 | `src/lib/callState.ts` | `activeIncomingConversations` pasa de Set a Map con timestamp; nuevo `getStaleIncomingConversationIds()` (>60 s = obsoleto); `Keyboard.dismiss()` al marcar entrante activa. | 2, 4 |
| 4 | `src/hooks/useNotifications.ts` | Corregida `UUID_REGEX` malformada (nunca detectaba UUIDs → un UUID podía usarse como roomName y unir a una sala equivocada); nuevo listener de `AppState` que al volver a `active`: cierra teclado si hay llamada, limpia marcadores de entrante obsoletos y emite `chat_sync_requested`. | 2, 4, 5, 6, 7 |
| 5 | `src/screens/CallScreen.tsx` | `persistRemoteEndLocally()`: al recibir cierre remoto (fast broadcast, `external_call_ended` o canal active-call) guarda un marcador terminal local con `callSessionId` y actualiza el preview, antes de cerrar la pantalla. | 3 |
| 6 | `src/components/chat/components/MessageList.tsx` | Solo el **último** mensaje `call` puede renderizar "Unirse ahora"; los anteriores se muestran como "Llamada finalizada" aunque su terminal se haya perdido. | 3, 6 |

**Pendiente operativo (Bug 1)**: verificar en el despliegue productivo del chat-ms: `APN_PRODUCTION=true` (o `NODE_ENV=production`), `APN_KEY`/`APN_KEY_PATH`, `APN_KEY_ID`, `APN_TEAM_ID`, `BUNDLE_ID=com.tincadia.app`; revisar logs `VoIP Push failed` (con el nuevo log sale la razón APNs exacta: `BadDeviceToken` = mismatch de entorno, `TopicDisallowed` = bundle id/entitlement, `ExpiredProviderToken` = llave).

### Cómo verificar cada corrección

1. **Bug 1**: con app **cerrada por completo** (swipe-kill) en un build de TestFlight, llamar desde otro dispositivo → debe sonar CallKit. Si no suena, mirar el nuevo log de razón APNs en chat-ms. Repetir tras corregir env.
2. **Bug 2**: abrir un chat con teclado activo en iOS, recibir llamada, contestar desde CallKit → al volver a la app el teclado debe estar cerrado.
3. **Bug 3**: A llama a B; B cuelga/rechaza (incluso matando la app de B justo después) → la caja de A debe pasar a "Llamada finalizada" al instante (marcador local).
4. **Bug 4**: dejar expirar una llamada (30 s) con B en background → al volver B a foreground, la lista debe dejar de decir "Llamada entrante" (reconciliación + sync).
5. **Bug 5/7**: escenario completo del bug 7: B en background, A cuelga, luego A llama de nuevo → B debe poder contestar y conectar sin quedarse en "Conectando...". El push terminal ahora cierra la llamada nativa original (UUID estable) y el estado local se reconcilia al foreground.
6. **Bug 6**: provocar dos mensajes `call` en <2 min sin terminales → solo el último muestra la caja.

### Casos límite y riesgos remanentes

- Push terminales VoIP siguen violando técnicamente la política de Apple (todo push VoIP debe reportar una llamada real). El AppDelegate ya reporta+descarta, lo que es el workaround estándar, pero a mediano plazo conviene migrar los eventos terminales a pushes APNs normales (background/alert) y dejar VoIP solo para `type: 'call'`.
- Mezcla de versiones app/backend: app nueva + backend viejo (UUID aleatorio) sigue cubierta por el dismiss por conversationId/roomName; backend nuevo + app vieja funciona igual que hoy (la app vieja tolera UUIDs repetidos por dedupe).
- El marcador local de `CallScreen` puede coexistir con el mensaje terminal real del servidor (dos filas terminales); no se renderizan como burbuja y el matching por `callSessionId` es idempotente.
- El timer de 35 s del receptor sigue sin correr en background (limitación de JS); la limpieza queda cubierta por push terminal + reconciliación en foreground.
- iOS: la app usa la variante Swift u Obj-C del AppDelegate según el prebuild; el plugin cubre ambas y no fue modificado.

## 6. Riesgos generales

- Tocar `callkeep.service.ts` afecta iOS y Android: cada cambio se condiciona por tipo de payload, no por plataforma, para no romper Android.
- El fix 5 cambia la semántica visual de llamadas antiguas (pasan a "finalizada"): coincide con la regla de negocio "solo una llamada activa por conversación".
- El fix 1 cambia el contrato del payload push: el UUID deja de ser único por push. El JS ya tolera UUIDs repetidos (dedupe y aliases), y el AppDelegate genera uno nuevo solo si el recibido no es UUID válido.
