import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';

const CLAVE_MOSTRADO = 'tincadia_overlay_prompt_visto';

/**
 * Pide el permiso "Mostrar sobre otras apps" (SYSTEM_ALERT_WINDOW).
 *
 * Android no permite conceder este permiso con un dialogo: hay que abrir
 * Ajustes y activar un interruptor. Se usa MANAGE_APP_OVERLAY_PERMISSION para
 * caer directamente en la pantalla de Tincadia, de modo que el usuario solo
 * tenga que pulsar el interruptor.
 *
 * Sin este permiso las llamadas SIGUEN llegando: lo que falla es entrar directo
 * a la app al contestar con el telefono desbloqueado y la app en segundo plano
 * (Background Activity Start Restrictions de Android 10+). Por eso se puede
 * omitir y solo se muestra una vez.
 */
export function OverlayPermissionPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let cancelado = false;

    const comprobar = async () => {
      try {
        const yaMostrado = await AsyncStorage.getItem(CLAVE_MOSTRADO);
        if (yaMostrado === 'true' || cancelado) return;

        // No se comprueba si el permiso ya esta concedido: SYSTEM_ALERT_WINDOW
        // es un permiso especial y ni PermissionsAndroid ni CallKeep exponen una
        // forma de consultarlo desde JS. Haria falta un modulo nativo con
        // Settings.canDrawOverlays().
        //
        // Se muestra una sola vez y es omitible, asi que el coste de mostrarlo
        // a quien ya lo tenga concedido es un aviso descartable, no un bloqueo.
        if (!cancelado) setVisible(true);
      } catch {
        // Si falla la lectura del flag, no se molesta al usuario.
      }
    };

    // Pequeña espera para no competir con los dialogos de notificaciones y
    // cuenta de llamadas, que salen al entrar.
    const t = setTimeout(comprobar, 2500);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, []);

  const cerrar = async () => {
    setVisible(false);
    await AsyncStorage.setItem(CLAVE_MOSTRADO, 'true').catch(() => undefined);
  };

  const abrirAjustes = async () => {
    await cerrar();
    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.MANAGE_APP_OVERLAY_PERMISSION' as IntentLauncher.ActivityAction,
        { data: 'package:com.tincadia.app' },
      );
    } catch {
      // Algunos fabricantes no exponen la pantalla por app: se abre la general.
      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.MANAGE_OVERLAY_PERMISSION' as IntentLauncher.ActivityAction,
        );
      } catch {
        // Sin pantalla disponible no hay nada mas que hacer.
      }
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={cerrar}>
      <View style={estilos.fondo}>
        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>Entra directo a tus llamadas</Text>

          <Text style={estilos.texto}>
            Activa <Text style={estilos.negrita}>“Mostrar sobre otras apps”</Text> para
            que Tincadia se abra sola al contestar una llamada.
          </Text>

          <Text style={estilos.nota}>
            Sin esto seguirás recibiendo las llamadas, pero tendrás que tocar la
            notificación para entrar.
          </Text>

          <TouchableOpacity style={estilos.botonPrincipal} onPress={abrirAjustes}>
            <Text style={estilos.textoBotonPrincipal}>Activar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={estilos.botonSecundario} onPress={cerrar}>
            <Text style={estilos.textoBotonSecundario}>Ahora no</Text>
          </TouchableOpacity>
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
  titulo: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
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
  botonPrincipal: {
    backgroundColor: '#2E7D91',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  textoBotonPrincipal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  botonSecundario: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  textoBotonSecundario: {
    color: '#666',
    fontSize: 15,
  },
});
