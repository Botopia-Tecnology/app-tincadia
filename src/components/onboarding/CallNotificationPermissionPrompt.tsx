import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import * as IntentLauncher from 'expo-intent-launcher';

const CLAVE_MOSTRADO = 'tincadia_call_notif_prompt_visto';
const PAQUETE = 'com.tincadia.app';
const INCOMING_CALLS_CHANNEL_ID = 'tincadia_incoming_calls_v2';

/**
 * Pide al usuario que active las notificaciones flotantes para llamadas.
 *
 * Xiaomi (MIUI / HyperOS), Oppo, Vivo y otros fabricantes chinos bloquean
 * por defecto las notificaciones flotantes (heads-up / pop-up) para apps
 * que no están en su lista blanca (WhatsApp, Telegram, etc).
 *
 * Sin este permiso, la notificación de llamada entrante no aparece como
 * banner flotante sobre la pantalla y el usuario no puede contestar ni
 * rechazar la llamada desde la notificación.
 *
 * Este componente se muestra una sola vez (después de BatteryOptimizationPrompt)
 * y abre directamente los ajustes de notificación del canal de llamadas
 * entrantes de Tincadia, donde el usuario solo necesita activar
 * "Floating notifications" / "Notificaciones flotantes".
 */
export function CallNotificationPermissionPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let cancelado = false;

    const comprobar = async () => {
      try {
        const yaMostrado = await AsyncStorage.getItem(CLAVE_MOSTRADO);
        if (yaMostrado === 'true' || cancelado) return;

        // Verificar si las notificaciones del canal están bloqueadas o con
        // importancia baja (lo que impediría heads-up).
        try {
          const channel = await notifee.getChannel(INCOMING_CALLS_CHANNEL_ID);
          // Si el canal ya existe y tiene importancia HIGH (4) o MAX (5),
          // es probable que las notificaciones flotantes estén habilitadas.
          // Sin embargo, en Xiaomi la importancia del canal puede ser alta
          // pero las flotantes estar deshabilitadas a nivel de sistema,
          // así que mostramos el prompt de todos modos la primera vez.
          if (channel && channel.importance && channel.importance >= 4) {
            // El canal está bien configurado, pero igualmente mostramos
            // la primera vez para que el usuario verifique en Xiaomi.
          }
        } catch {
          // Si el canal no existe aún, mostramos igualmente.
        }

        if (!cancelado) setVisible(true);
      } catch {
        // Si falla la lectura del flag, no molestar.
      }
    };

    // Espera 5s para no competir con BatteryOptimizationPrompt (2.5s)
    // ni con los diálogos de permisos nativos de CallKeep.
    const t = setTimeout(comprobar, 5000);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, []);

  const marcarVisto = async () => {
    await AsyncStorage.setItem(CLAVE_MOSTRADO, 'true').catch(() => undefined);
  };

  const omitir = async () => {
    setVisible(false);
    await marcarVisto();
  };

  const abrirAjustes = async () => {
    setVisible(false);
    await marcarVisto();

    try {
      // Intenta abrir directamente los ajustes del canal de llamadas
      // entrantes. Notifee abre la pantalla exacta donde está el toggle
      // de "Floating notifications".
      await notifee.openNotificationSettings(INCOMING_CALLS_CHANNEL_ID);
    } catch {
      // Fallback 1: Abrir los ajustes de notificación de la app completa
      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.APP_NOTIFICATION_SETTINGS' as IntentLauncher.ActivityAction,
          { extra: { 'android.provider.extra.APP_PACKAGE': PAQUETE } },
        );
      } catch {
        // Fallback 2: Abrir los ajustes generales de la app
        try {
          await Linking.openSettings();
        } catch {
          // No hay pantalla disponible
        }
      }
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={omitir}>
      <View style={estilos.fondo}>
        <View style={estilos.tarjeta}>
          <Text style={estilos.emoji}>📞</Text>
          <Text style={estilos.titulo}>Activa las notificaciones de llamada</Text>

          <Text style={estilos.texto}>
            Para ver las <Text style={estilos.negrita}>llamadas entrantes como un
            pop-up</Text> en tu pantalla (igual que WhatsApp), necesitas activar
            las notificaciones flotantes.
          </Text>

          <Text style={estilos.texto}>
            En la pantalla que se abrirá, activa{' '}
            <Text style={estilos.negrita}>"Floating notifications"</Text>{' '}
            (Notificaciones flotantes).
          </Text>

          <Text style={estilos.nota}>
            Sin este permiso, las llamadas solo aparecerán en la barra de
            notificaciones y no podrás contestar directamente desde la pantalla.
          </Text>

          <View style={estilos.fila}>
            <TouchableOpacity style={estilos.botonSecundario} onPress={omitir}>
              <Text style={estilos.textoBotonSecundario}>Ahora no</Text>
            </TouchableOpacity>

            <TouchableOpacity style={estilos.botonPrincipal} onPress={abrirAjustes}>
              <Text style={estilos.textoBotonPrincipal}>Activar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tarjeta: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  emoji: {
    fontSize: 36,
    textAlign: 'center',
    marginBottom: 8,
  },
  titulo: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
    textAlign: 'center',
  },
  texto: {
    fontSize: 15,
    lineHeight: 21,
    color: '#333',
    marginBottom: 10,
  },
  negrita: { fontWeight: '700' },
  nota: {
    fontSize: 13,
    lineHeight: 18,
    color: '#777',
    marginBottom: 20,
  },
  fila: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  botonPrincipal: {
    backgroundColor: '#2E7D91',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  textoBotonPrincipal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  botonSecundario: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  textoBotonSecundario: {
    color: '#666',
    fontSize: 15,
  },
});
