/**
 * useProductTour
 *
 * Consumer hook for the Product Tour system.
 *
 * Usage:
 *   const { registerTarget, startTour } = useProductTour();
 *
 *   // Register a target in any component:
 *   <View ref={registerTarget('my-key')} />
 *
 *   // Start the tour (auto-skips if already completed):
 *   startTour(TOUR_STEPS, 'main_tour');
 */

import { useEffect, useRef } from 'react';
import { useProductTourContext } from '../contexts/ProductTourContext';
import type { TourStep } from '../types/tour.types';

// Re-export for convenience
export type { TourStep } from '../types/tour.types';

/**
 * Main hook — thin wrapper over the context.
 */
export function useProductTour() {
  return useProductTourContext();
}

/**
 * Auto-start a tour once (when the component mounts).
 *
 * The tour will only show if:
 *   1. It hasn't been completed/skipped before (AsyncStorage check).
 *   2. No other tour is currently active.
 *   3. At least one of the step targets is measurable on screen.
 *
 * @param steps  The tour steps to show.
 * @param tourId Unique ID for persistence (default: 'default').
 */
export function useAutoStartTour(steps: TourStep[], tourId = 'default') {
  const { startTour, isActive } = useProductTourContext();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || isActive) return;
    attempted.current = true;
    startTour(steps, tourId);
  }, []); // intentionally run once on mount
}

// ────────────────────────────────────────────────────
// Default tour steps for the main app
// ────────────────────────────────────────────────────

export const MAIN_TOUR_STEPS: TourStep[] = [
  {
    targetKey: 'nav-chats',
    title: 'Tus Conversaciones',
    description:
      'Acá podés ver y gestionar todos tus chats. Enviá mensajes de texto, audio y video a tus contactos.',
  },
  {
    targetKey: 'nav-courses',
    title: 'Cursos de Lengua de Señas',
    description:
      'Explorá nuestro catálogo de cursos interactivos para aprender lengua de señas colombiana.',
  },
  {
    targetKey: 'nav-tincadia',
    title: 'Acciones Rápidas',
    description:
      'Tocá el ícono central para escanear un código QR o solicitar un intérprete en vivo.',
  },
  {
    targetKey: 'nav-sos',
    title: 'Emergencia',
    description:
      'Accedé rápidamente a servicios de emergencia y a tus contactos de confianza.',
  },
  {
    targetKey: 'nav-profile',
    title: 'Tu Perfil',
    description:
      'Gestioná tu cuenta, tu suscripción, preferencias de accesibilidad y más.',
  },
];
