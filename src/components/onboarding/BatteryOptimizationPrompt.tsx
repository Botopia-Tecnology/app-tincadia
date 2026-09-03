import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';

const CLAVE_MOSTRADO = 'tincadia_bateria_prompt_visto';
const PAQUETE = 'com.tincadia.app';

/**
 * Pide excluir a Tincadia de la optimizacion de bateria.
 *
 * Es EL permiso que decide si las llamadas entran con la app cerrada. Android
 * mata el proceso en segundo plano para ahorrar bateria, y entonces el push
 * llega pero no hay proceso que lo atienda: la llamada no suena, o se queda a
 * medias en la pantalla nativa.
 *
 * Verificado en dispositivo: al desactivar la restriccion de bateria, las
 * llamadas entran correctamente incluso con la app completamente cerrada.
 *
 * A diferencia de SYSTEM_ALERT_WINDOW, este permiso SI se puede conceder con un
 * dialogo del sistema (un si/no), siempre que
 * REQUEST_IGNORE_BATTERY_OPTIMIZATIONS este declarado en el manifest. Solo si
 * ese dialogo falla se recurre a la pantalla de Ajustes.
 */
export function BatteryOptimizationPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let cancelado = false;

    const comprobar = async () => {
      try {
        const yaMostrado = await AsyncStorage.getItem(CLAVE_MOSTRADO);
        if (yaMostrado === 'true' || cancelado) return;
        if (!cancelado) setVisible(true);
      } catch {
        // Si falla la lectura del flag, no se molesta al usuario.
      }
    };

    // Espera para no competir con los dialogos de notificaciones y cuenta de
    // llamadas, que salen al entrar.
    const t = setTimeout(comprobar, 2500);
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

  const activar = async () => {
    setVisible(false);
    await marcarVisto();

    try {
      // Dialogo del sistema: un si/no, sin salir de la app.
      await IntentLauncher.startActivityAsync(
        'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS' as IntentLauncher.ActivityAction,
        { data: `package:${PAQUETE}` },
      );
    } catch {
      // Algunos fabricantes bloquean ese dialogo: se abre la lista de Ajustes.
      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS' as IntentLauncher.ActivityAction,
        );
      } catch {
        // Sin pantalla disponible no hay nada mas que hacer.
      }
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={omitir}>
      <View style={estilos.fondo}>
        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>Permite el uso en segundo plano</Text>

          <Text style={estilos.texto}>
            Para recibir llamadas con la app cerrada, Tincadia necesita
            funcionar <Text style={estilos.negrita}>sin restricciones de
            batería</Text>.
          </Text>

          <Text style={estilos.texto}>
            En la pantalla que se abrirá, elige la opción{' '}
            <Text style={estilos.negrita}>“Sin restricciones”</Text> o{' '}
            <Text style={estilos.negrita}>“Permitir”</Text>.
          </Text>

          <Text style={estilos.nota}>
            Según tu teléfono puede aparecer como “Sin restricciones”, “No
            optimizar” o “Permitir actividad en segundo plano”.
          </Text>

          <View style={estilos.fila}>
            <TouchableOpacity style={estilos.botonSecundario} onPress={omitir}>
              <Text style={estilos.textoBotonSecundario}>Ahora no</Text>
            </TouchableOpacity>

            <TouchableOpacity style={estilos.botonPrincipal} onPress={activar}>
              <Text style={estilos.textoBotonPrincipal}>Continuar</Text>
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
  // Fila de acciones: la confirmacion va a la derecha, como en el resto de la app.
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
