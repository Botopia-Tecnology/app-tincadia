/**
 * Product Tour Context
 *
 * Manages the entire tour lifecycle:
 *   • Target registration via refs (registerTarget)
 *   • Measuring target positions on screen (measureInWindow)
 *   • Step navigation (next / prev / skip)
 *   • Persistence via AsyncStorage (remembers completed tours)
 *
 * The Provider renders the overlay component directly, so consumers only
 * need to wrap their tree with <ProductTourProvider> — no extra placement.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProductTourOverlay } from '../components/onboarding/ProductTour';
import type { TourStep, TargetLayout } from '../types/tour.types';

export interface MeasurableTarget {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
}

// ────────────────────────────────────────────────────
// Context shape
// ────────────────────────────────────────────────────

interface ProductTourContextValue {
  /** Whether a tour is currently being shown */
  isActive: boolean;
  /** Zero-based index of the current step */
  currentStep: number;
  /** Start the tour (checks persistence first; skips if already completed) */
  startTour: (steps: TourStep[], tourId?: string) => Promise<void>;
  /** Advance to the next step (completes tour on last step) */
  nextStep: () => void;
  /** Go back to the previous step */
  prevStep: () => void;
  /** Skip / dismiss the tour (persists "completed") */
  skipTour: () => void;
  /** Register a target element — returns a ref callback for <View ref={…}> */
  registerTarget: <T extends MeasurableTarget>(key: string) => (ref: T | null) => void;
  /** Clear the "completed" flag so the tour shows again */
  resetTour: (tourId?: string) => Promise<void>;
}

const STORAGE_PREFIX = '@tincadia/tour_';

const ProductTourContext = createContext<ProductTourContextValue | null>(null);

export function useProductTourContext(): ProductTourContextValue {
  const ctx = useContext(ProductTourContext);
  if (!ctx) {
    throw new Error(
      'useProductTourContext must be used inside <ProductTourProvider>',
    );
  }
  return ctx;
}

// ────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────

export function ProductTourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [targetLayouts, setTargetLayouts] = useState<Record<string, TargetLayout>>({});
  const activeTourId = useRef('default');
  const targetRefs = useRef<Map<string, MeasurableTarget>>(new Map());

  // ── Target registration ──

  const registerTarget = useCallback(<T extends MeasurableTarget>(key: string) => {
    return (ref: T | null) => {
      if (ref) {
        targetRefs.current.set(key, ref);
      }
      // Intentionally not deleting on null — refs can temporarily unmount
      // during screen transitions / animations and remount shortly after.
    };
  }, []);

  // ── Measure all target positions ──

  const measureTargets = useCallback(
    async (keys: string[]): Promise<Record<string, TargetLayout>> => {
      const layouts: Record<string, TargetLayout> = {};

      for (const key of keys) {
        const ref = targetRefs.current.get(key);
        if (!ref) continue;

        try {
          const layout = await new Promise<TargetLayout | null>((resolve) => {
            ref.measureInWindow((x, y, width, height) => {
              if (width > 0 && height > 0) {
                resolve({ x, y, width, height });
              } else {
                resolve(null);
              }
            });
          });
          if (layout) layouts[key] = layout;
        } catch {
          // Target not measurable — skip silently
        }
      }

      return layouts;
    },
    [],
  );

  // ── Complete / persist ──

  const completeTour = useCallback(async () => {
    setIsActive(false);
    setCurrentStep(0);
    try {
      await AsyncStorage.setItem(
        `${STORAGE_PREFIX}${activeTourId.current}`,
        'true',
      );
    } catch {
      // Non-critical — tour will just show again next time
    }
  }, []);

  // ── Public actions ──

  const startTour = useCallback(
    async (tourSteps: TourStep[], tourId = 'default') => {
      // Don't interrupt an active tour
      if (isActive) return;

      // Check if this tour was already completed
      try {
        const completed = await AsyncStorage.getItem(`${STORAGE_PREFIX}${tourId}`);
        if (completed === 'true') return;
      } catch {}

      activeTourId.current = tourId;

      // Wait for layout to settle (e.g. after login transition)
      await new Promise((r) => setTimeout(r, 600));

      const keys = tourSteps.map((s) => s.targetKey);
      const layouts = await measureTargets(keys);

      // Only include steps whose target was successfully measured
      const validSteps = tourSteps.filter((s) => layouts[s.targetKey]);
      if (validSteps.length === 0) return;

      setSteps(validSteps);
      setTargetLayouts(layouts);
      setCurrentStep(0);
      setIsActive(true);
    },
    [isActive, measureTargets],
  );

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= steps.length - 1) {
        completeTour();
        return prev;
      }
      return prev + 1;
    });
  }, [steps.length, completeTour]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const skipTour = useCallback(async () => {
    await completeTour();
  }, [completeTour]);

  const resetTour = useCallback(async (tourId = 'default') => {
    try {
      await AsyncStorage.removeItem(`${STORAGE_PREFIX}${tourId}`);
    } catch {}
  }, []);

  // ── Render ──

  const value: ProductTourContextValue = {
    isActive,
    currentStep,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    registerTarget,
    resetTour,
  };

  return (
    <ProductTourContext.Provider value={value}>
      {children}
      {isActive && (
        <ProductTourOverlay
          steps={steps}
          currentStep={currentStep}
          targetLayouts={targetLayouts}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
        />
      )}
    </ProductTourContext.Provider>
  );
}
