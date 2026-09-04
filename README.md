<!-- prettier-ignore -->
<div align="center">

<img src="./assets/icon.png" alt="" align="center" height="72" />

# App Tincadia

[![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61dafb?style=flat-square&logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![LiveKit](https://img.shields.io/badge/LiveKit-1f1f1f?style=flat-square&logo=livekit&logoColor=white)](https://livekit.io)
[![Bun](https://img.shields.io/badge/Bun-fbf0df?style=flat-square&logo=bun&logoColor=black)](https://bun.sh)

**Aplicación móvil de Tincadia** — plataforma de tecnología inclusiva que conecta a personas sordas, oyentes y organizaciones.

[Empezar](#empezar) • [Comandos](#comandos) • [Estructura](#estructura) • [Configuración nativa](#configuración-nativa) • [Compilar](#compilar)

</div>

Chat, videollamadas con intérprete, tablero de comunicación, contactos de emergencia y reconocimiento de lengua de señas colombiana (LSC).

## Empezar

### Requisitos

- [Node.js](https://nodejs.org) 18 o superior
- [Bun](https://bun.sh) — gestor de paquetes del proyecto
- [Android Studio](https://developer.android.com/studio) (Android) o [Xcode](https://developer.apple.com/xcode/) y macOS (iOS)
- Cuenta de [Expo](https://expo.dev) con acceso al proyecto, para compilar con EAS

### Instalación

```bash
git clone https://github.com/Botopia-Tecnology/app-tincadia.git
cd app-tincadia
bun install
```

`bun install` ejecuta `patch-package` al terminar, que aplica los parches de `patches/` sobre `react-native-callkeep` y `@react-native-voice/voice`. Si borras `node_modules`, se reaplican solos.

### Ejecutar

> [!IMPORTANT]
> La app **no corre en Expo Go**. Usa módulos nativos que Expo Go no incluye: CallKeep para la interfaz nativa de llamadas, Firebase Messaging, LiveKit y push VoIP. Hace falta un *development build*.

La primera vez, compila e instala en el dispositivo:

```bash
bun run android     # Android
bun run ios         # iOS (requiere macOS)
```

Con el build ya instalado, para el día a día basta con levantar el servidor de desarrollo:

```bash
bun start
```

> [!NOTE]
> Recargar el JS no alcanza si tocaste `app.json`, un config plugin de `plugins/`, o una dependencia nativa. En esos casos toca volver a compilar.

## Comandos

| Comando | Descripción |
|---|---|
| `bun start` | Servidor de desarrollo de Expo |
| `bun run android` | Compila e instala en Android |
| `bun run ios` | Compila e instala en iOS (macOS) |
| `bun run web` | Arranca la versión web |
| `bun run lint` | ESLint |
| `bun run type-check` | Comprobación de tipos (`tsc --noEmit`) |

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
│   ├── styles/
│   └── types/
├── plugins/          # Config plugins de Expo (código nativo)
├── patches/          # Parches de dependencias (patch-package)
├── assets/
├── app.json          # Configuración de Expo
└── eas.json          # Perfiles de compilación
```

### Convenciones

- Path alias `@/` hacia `src/`
- Componentes en `PascalCase`, hooks en `camelCase` con prefijo `use`
- TypeScript en modo estricto
- Las traducciones van en los **tres** archivos de `src/locales/` (`es`, `en`, `pt`), con notación de punto

```typescript
import { useTranslation } from '@/hooks/useTranslation';

const { t, locale, setLocale } = useTranslation();
t('common.loading');
```

## Configuración nativa

En `plugins/` hay modificaciones del proyecto nativo que se aplican al compilar. Se declaran en `app.json` y solo surten efecto tras recompilar:

| Plugin | Para qué |
|---|---|
| `withVoipAppDelegate` | Registra PushKit en el `AppDelegate` de iOS |
| `withFirebaseManifestFix` | Ajusta el manifiesto de Android para Firebase |
| `withModularHeaders` | Modular headers en el Podfile de iOS |
| `withPictureInPicture` | Picture-in-picture durante las llamadas |
| `withProguardRules` | Reglas de ProGuard en release de Android |
| `withTabletSupport` | Soporte de tablets |

### Llamadas y notificaciones

| Archivo | Responsabilidad |
|---|---|
| `src/services/callkeep.service.ts` | Interfaz nativa de llamadas, push VoIP y guardas contra pushes obsoletos |
| `src/hooks/useNotifications.ts` | Registro de tokens (FCM, VoIP, Expo), reintentos y diagnóstico |
| `src/screens/CallScreen.tsx` | Sala de LiveKit, participantes y eventos terminales |

> [!CAUTION]
> Dos restricciones de plataforma a tener presentes al tocar esos archivos. En **iOS**, PushKit obliga a reportar una llamada a CallKit por cada push VoIP recibido o el sistema mata la app: la pantalla se pinta antes de que corra el JS, así que desde el cliente no se puede evitar que aparezca. En **Android**, con restricciones de batería activas el proceso muere en segundo plano y las llamadas no entran — por eso el onboarding pide desactivarlas.

## Compilar

Con [EAS Build](https://docs.expo.dev/build/introduction/), según los perfiles de `eas.json` (`development`, `preview`, `production`):

```bash
eas build --platform ios --profile production
eas build --platform android --profile preview
```

> [!WARNING]
> No hay OTA: `expo-updates` no está instalado, así que cualquier cambio —incluso de solo JS— necesita un build nuevo.
