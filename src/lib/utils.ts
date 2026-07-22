import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';

/**
 * Combina múltiples estilos de React Native
 * Útil para aplicar estilos condicionales o combinar estilos base con variantes
 */
export function combineStyles<T extends ViewStyle | TextStyle | ImageStyle>(
  ...styles: (T | false | null | undefined)[]
): T {
  return Object.assign({}, ...styles.filter(Boolean)) as T;
}

/**
 * Crea un delay (útil para animaciones o efectos)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Formatea un número como moneda colombiana
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Valida formato de email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida formato de teléfono colombiano
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(\+57|57)?[1-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Valida un número local según el país seleccionado: Colombia exige 10 dígitos;
 * para el resto solo se comprueba un largo plausible (E.164 permite 7-15).
 */
export function isValidPhoneForCountry(phone: string, dialCode?: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (dialCode === '+57') return isValidPhone(digits);
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Trunca un texto a una longitud máxima
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

