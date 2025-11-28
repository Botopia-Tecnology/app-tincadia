import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import esTranslations from '../locales/es.json';
import enTranslations from '../locales/en.json';
import ptTranslations from '../locales/pt.json';

export type Locale = 'es' | 'en' | 'pt';

type Translations = typeof esTranslations;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  translations: Translations;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const translationsMap: Record<Locale, Translations> = {
  es: esTranslations,
  en: enTranslations,
  pt: ptTranslations,
};

const STORAGE_KEY = 'tincadia-locale';

interface I18nProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

export function I18nProvider({ children, defaultLocale = 'es' }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  // Cargar el idioma guardado en AsyncStorage al iniciar
  useEffect(() => {
    const loadSavedLocale = async () => {
      try {
        const savedLocale = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedLocale && (savedLocale === 'es' || savedLocale === 'en' || savedLocale === 'pt')) {
          setLocaleState(savedLocale);
        }
      } catch (error) {
        console.error('Error loading saved locale:', error);
      }
    };

    loadSavedLocale();
  }, []);

  // Guardar el idioma en AsyncStorage cuando cambie
  const setLocale = async (newLocale: Locale) => {
    try {
      setLocaleState(newLocale);
      await AsyncStorage.setItem(STORAGE_KEY, newLocale);
    } catch (error) {
      console.error('Error saving locale:', error);
    }
  };

  // Función para obtener traducciones usando notación de punto (ej: "common.loading")
  const t = (key: string): any => {
    const keys = key.split('.');
    let value: any = translationsMap[locale];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Si no se encuentra la clave, intentar con español como fallback
        value = translationsMap.es;
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key; // Devolver la clave si no se encuentra
          }
        }
        break;
      }
    }

    // Devolver el valor tal cual (puede ser string, array, objeto, etc.)
    return value !== undefined ? value : key;
  };

  // Renderizar inmediatamente con el locale por defecto, luego actualizar cuando se cargue
  // Esto evita problemas de renderizado

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        translations: translationsMap[locale],
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

