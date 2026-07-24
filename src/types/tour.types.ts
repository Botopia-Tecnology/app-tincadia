/**
 * Product Tour Types
 *
 * Shared type definitions used by the tour context, overlay component,
 * and consumer hooks. Kept in a dedicated file to prevent circular imports.
 */

/** A single step in the product tour */
export interface TourStep {
  /** Key that matches a registered target element */
  targetKey: string;
  /** Bold title shown in the tooltip */
  title: string;
  /** Descriptive text explaining the feature */
  description: string;
}

/** Absolute screen-space layout of a registered target element */
export interface TargetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}
