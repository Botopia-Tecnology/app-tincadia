# Plan Consolidado: Módulos Nativos y Pizarra de Comunicación

## Objetivo
Realizar las instalaciones de módulos nativos pendientes e implementar la "Pizarra de Comunicación" offline. Estos cambios requieren un **Rebuild** de la aplicación nativa.

## Cambios Nativos a Instalar
1. **`expo-document-picker`**: Para restaurar el envío de documentos PDF/archivos.
2. **`expo-screen-orientation`**: Para rotar dinámicamente el `CallScreen` sin romper la app.
3. **`expo-speech`**: Para implementar Texto-a-Voz (TTS) nativo 100% offline y gratuito.

## Pizarra de Comunicación (TTS Offline)

### 1. Nuevo Componente: `CommunicationBoardModal.tsx`
- **Interfaz**: Un modal independiente del chat, pensado para comunicarse en persona.
- **Entrada de Texto**: Un gran `TextInput` con `fontSize` de unos `32px` a `40px` para que se lea fácilmente desde lejos.
- **Acciones (Botones Grandes)**:
  - **🗣️ Hablar (TTS)**: Usa `Speech.speak(text)` de `expo-speech` para que el celular lea el texto en voz alta.
  - **🗑️ Limpiar**: Para vaciar el texto y escribir algo nuevo rápido.
  - **✉️ Enviar al chat**: Un botón opcional para enviar lo que se escribió como un mensaje normal de texto al chat activo, y luego cerrar la pizarra.
  - **✕ Cerrar**: Vuelve al chat sin hacer nada.

### 2. Modificaciones en el Chat
- **[MODIFICAR]** `ChatView.tsx` / `ChatInput.tsx`:
  - Quitar el chequeo de plan premium (`canUseTTS`).
  - Quitar la llamada a la API que costaba dinero (`fetch('${API_URL}/model/tts')`).
  - El botón con el ícono de voz ahora abrirá directamente el `CommunicationBoardModal` en lugar de leer automáticamente el input del chat.

---
*Nota: Este plan está aprobado y listo para ser ejecutado tan pronto como el usuario autorice instalar los módulos y hacer el respectivo rebuild.*
