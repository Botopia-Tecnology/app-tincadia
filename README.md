# App Tincadia

Aplicación móvil de Tincadia, plataforma de tecnología inclusiva que conecta a personas sordas, oyentes y organizaciones. Construida con React Native y Expo.

Ofrece chat, videollamadas con intérprete, tablero de comunicación, contactos de emergencia y reconocimiento de lengua de señas colombiana (LSC).

## Requisitos previos

- [Node.js](https://nodejs.org/) 18 o superior
- [Bun](https://bun.sh/) (gestor de paquetes del proyecto)
- Android Studio (para Android) o Xcode y macOS (para iOS)
- Una cuenta de [Expo](https://expo.dev/) con acceso al proyecto, para compilar con EAS

## Esta app no corre en Expo Go

Usa módulos nativos que Expo Go no incluye: CallKeep para la interfaz nativa de llamadas, Firebase Messaging, LiveKit y push VoIP. Hace falta un **development build**.

```bash
bun install
bun run android     # compila e instala en Android
bun run ios         # compila e instala en iOS (requiere macOS)
```

Con el build ya instalado en el dispositivo, para el día a día basta con levantar el servidor:

```bash
bun start
```

Después de tocar `app.json`, un config plugin o una dependencia nativa hay que **recompilar**; recargar el JS no alcanza.

## Scripts

| Comando | Qué hace |
|---|---|
| `bun start` | Servidor de desarrollo de Expo |
| `bun run android` | Compila e instala en Android |
| `bun run ios` | Compila e instala en iOS (macOS) |
| `bun run lint` | ESLint |
| `bun run type-check` | Comprobación de tipos (`tsc --noEmit`) |

`postinstall` ejecuta `patch-package`: hay parches sobre `react-native-callkeep` y `@react-native-voice/voice` en `patches/`. Si borras `node_modules`, se reaplican solos.

## Estructura

```
app-tincadia/
├── src/
│   ├── app/          # Navegación y punto de entrada
│   ├── components/   # Componentes reutilizables
│   ├── contexts/     # Contextos de React (i18n, sesión…)
│   ├── database/     # SQLite local (caché de chat)
│   ├── hooks/        # Hooks propios
│   ├── lib/          # Utilidades, almacenamiento seguro, estado de llamada
│   ├── locales/      # Traducciones (es, en, pt)
│   ├── screens/      # Pantallas
│   ├── services/     # Clientes de API y servicios nativos
│   └── types/
├── plugins/          # Config plugins de Expo (código nativo)
├── patches/          # Parches de dependencias (patch-package)
└── app.json          # Configuración de Expo
```

### Config plugins

En `plugins/` hay modificaciones del proyecto nativo que se aplican al compilar. Se declaran en `app.json` y **solo tienen efecto tras recompilar**:

| Plugin | Para qué |
|---|---|
| `withVoipAppDelegate` | Registra PushKit en el `AppDelegate` de iOS |
| `withFirebaseManifestFix` | Ajusta el manifiesto de Android para Firebase |
| `withModularHeaders` | Modular headers en el Podfile de iOS |
| `withPictureInPicture` | Picture-in-picture en llamadas |
| `withProguardRules` | Reglas de ProGuard en release de Android |
| `withTabletSupport` | Soporte de tablets |

## Llamadas y notificaciones

La parte más delicada del proyecto. Dos plataformas con contratos distintos:

### iOS: PushKit obliga a mostrar la llamada

Apple **exige** reportar una llamada a CallKit por cada push VoIP recibido, o mata la app. La pantalla de llamada se pinta **antes de que corra una sola línea de JS**, así que desde el cliente no se puede evitar que aparezca: solo cerrarla después.

De ahí que un push VoIP indebido produzca un "banner fantasma" de un par de segundos. La corrección real es **no enviar ese push** desde el backend, no filtrarlo aquí.

### Android: la optimización de batería mata el proceso

Si el sistema tiene restricciones de batería activas sobre la app, el proceso muere en segundo plano y las llamadas no entran. No es un problema de código, y por eso el onboarding pide desactivarlas.

A diferencia de iOS, FCM entrega los datos a JS sin pintar nada, así que aquí el código sí decide si muestra la llamada.

### Puntos de entrada

- `src/services/callkeep.service.ts` — interfaz nativa de llamadas, push VoIP y guardas contra pushes obsoletos o duplicados
- `src/hooks/useNotifications.ts` — registro de tokens (FCM, VoIP, Expo), reintentos y diagnóstico remoto
- `src/screens/CallScreen.tsx` — sala de LiveKit, participantes y eventos terminales

## Internacionalización

Español, inglés y portugués en `src/locales/`. El idioma se guarda en AsyncStorage.

```typescript
import { useTranslation } from '@/hooks/useTranslation';

const { t, locale, setLocale } = useTranslation();
t('common.loading');
```

Para añadir una traducción, edítala en los **tres** archivos (`es.json`, `en.json`, `pt.json`) usando notación de punto.

## Convenciones

- Path alias `@/` hacia `src/`
- Componentes en `PascalCase`, hooks en `camelCase` con prefijo `use`
- TypeScript en modo estricto

## Compilación y publicación

Con [EAS Build](https://docs.expo.dev/build/introduction/), según los perfiles de `eas.json`:

```bash
eas build --platform ios --profile production
eas build --platform android --profile preview
```

No hay OTA (`expo-updates` no está instalado): **cualquier cambio, incluso de solo JS, necesita un build nuevo**.

## Licencia

Privado — Tincadia.
