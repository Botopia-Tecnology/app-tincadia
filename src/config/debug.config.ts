/**
 * Debug logging is opt-in. Keep disabled in release builds by default.
 * Set EXPO_PUBLIC_ENABLE_DEBUG_LOGS=true only for a diagnostic build.
 */
const rawDebugLogs = String(process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS ?? '').trim().toLowerCase();

export const ENABLE_DEBUG_LOGS = rawDebugLogs === 'true' || rawDebugLogs === '1';

if (!ENABLE_DEBUG_LOGS) {
  console.log = () => undefined;
  console.debug = () => undefined;
  console.info = () => undefined;
  console.warn = () => undefined;
}
