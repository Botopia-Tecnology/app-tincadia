import { useEffect, useState } from 'react';

/**
 * Hook global para aplicar debounce a un valor
 * Útil para búsquedas en tiempo real, filtros, etc.
 * 
 * @param value - El valor a aplicar debounce
 * @param delay - El tiempo de retraso en milisegundos (default: 500ms)
 * @returns El valor con debounce aplicado
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 500);
 * 
 * useEffect(() => {
 *   // Ejecutar búsqueda con debouncedSearch
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

