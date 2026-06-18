/**
 * ProductTourOverlay
 *
 * Purely presentational component — all state comes via props from the
 * ProductTourProvider.  Renders:
 *   1. An SVG overlay with a spotlight "cutout" around the active target
 *      (even-odd fill rule on a single Path).
 *   2. A tooltip card positioned above or below the target with an arrow.
 *   3. Navigation controls: Skip, Previous, Next / Done.
 *   4. Step indicator dots.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tourStyles as styles } from './ProductTour.styles';
import type { TourStep, TargetLayout } from '../../types/tour.types';

// ────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────

const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_RADIUS = 12;
const TOOLTIP_GAP = 16; // vertical gap between spotlight edge and tooltip
const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.75)';

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

export interface ProductTourOverlayProps {
  steps: TourStep[];
  currentStep: number;
  targetLayouts: Record<string, TargetLayout>;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

// ────────────────────────────────────────────────────
// SVG path helper
// ────────────────────────────────────────────────────

/**
 * Creates an SVG path string that covers the entire screen with a
 * rounded-rectangle hole at the target location.
 *
 * It draws two sub-paths:
 *   • Outer rectangle (full screen, clockwise)
 *   • Inner rounded rect (clockwise)
 * Combined with fillRule="evenodd", the inner area becomes transparent.
 */
function createSpotlightPath(
  sw: number,
  sh: number,
  target: TargetLayout,
  padding: number,
  radius: number,
): string {
  const x = target.x - padding;
  const y = target.y - padding;
  const w = target.width + padding * 2;
  const h = target.height + padding * 2;
  const r = Math.min(radius, w / 2, h / 2);

  return [
    // Outer rectangle
    `M0,0 H${sw} V${sh} H0 Z`,
    // Inner rounded rectangle
    `M${x + r},${y}`,
    `H${x + w - r}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `V${y + h - r}`,
    `A${r},${r} 0 0 1 ${x + w - r},${y + h}`,
    `H${x + r}`,
    `A${r},${r} 0 0 1 ${x},${y + h - r}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    `Z`,
  ].join(' ');
}

// ────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────

export function ProductTourOverlay({
  steps,
  currentStep,
  targetLayouts,
  onNext,
  onPrev,
  onSkip,
}: ProductTourOverlayProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const overlayRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const [tooltipHeight, setTooltipHeight] = useState(180);
  const [overlayOffset, setOverlayOffset] = useState({ x: 0, y: 0 });

  const step = steps[currentStep];
  const rawTarget = step ? targetLayouts[step.targetKey] : null;
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  // En Android a veces StatusBar.currentHeight devuelve 0 o falla, pero el SVG se desfasa.
  // Usamos insets.top de react-native-safe-area-context que es mucho más confiable.
  // Ajuste fino: si insets.top lo sube DEMASIADO, lo bajamos un poco sumándole 15px.
  const topOffset = Platform.OS === 'android' ? insets.top : 0;

  const target = rawTarget ? {
    ...rawTarget,
    x: rawTarget.x - overlayOffset.x,
    y: rawTarget.y - overlayOffset.y - topOffset + 25 + (step.yOffset || 0)
  } : null;

  // Fade-in animation on each step change
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentStep, fadeAnim]);

  if (!step || !target) return null;

  // ── Tooltip positioning ──
  const targetCenterY = target.y + target.height / 2;
  const showAbove = targetCenterY > screenH * 0.5;

  const rawTop = showAbove
    ? target.y - SPOTLIGHT_PADDING - TOOLTIP_GAP - tooltipHeight
    : target.y + target.height + SPOTLIGHT_PADDING + TOOLTIP_GAP;

  // Clamp so the tooltip never goes off-screen
  const tooltipTop = Math.max(20, Math.min(screenH - tooltipHeight - 20, rawTop));

  // ── Arrow positioning (horizontally aligned to target center) ──
  const tooltipLeft = 20;
  const tooltipWidth = screenW - tooltipLeft * 2;
  const targetCenterX = target.x + target.width / 2;
  const arrowLeft = Math.max(24, Math.min(targetCenterX - tooltipLeft - 7, tooltipWidth - 38));

  // ── SVG path ──
  const svgPath = createSpotlightPath(screenW, screenH, target, SPOTLIGHT_PADDING, SPOTLIGHT_RADIUS);

  return (
    <View
      ref={overlayRef}
      style={styles.container}
      onLayout={() => {
        overlayRef.current?.measureInWindow((x, y) => {
          if (x !== overlayOffset.x || y !== overlayOffset.y) {
            setOverlayOffset({ x, y });
          }
        });
      }}
    >
      {/* 1 ─ SVG dark overlay with spotlight cutout */}
      <Svg
        width={screenW}
        height={screenH}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Path d={svgPath} fill={OVERLAY_COLOR} fillRule="evenodd" />
      </Svg>

      {/* 2 ─ Touch-blocking layer (prevents taps on background content) */}
      <View style={StyleSheet.absoluteFill} />

      {/* 3 ─ Tooltip */}
      <Animated.View
        style={[styles.tooltipWrapper, { top: tooltipTop, opacity: fadeAnim }]}
        onLayout={(e) => setTooltipHeight(e.nativeEvent.layout.height)}
      >
        {/* Arrow pointing toward the target */}
        <View
          style={[
            styles.arrow,
            { left: arrowLeft },
            showAbove ? { bottom: -7 } : { top: -7 },
          ]}
        />

        <View style={styles.tooltip}>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          {/* Navigation controls */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onSkip} style={styles.skipBtn} activeOpacity={0.6}>
              <Text style={styles.skipText}>Saltar</Text>
            </TouchableOpacity>

            <View style={styles.navBtns}>
              {!isFirst && (
                <TouchableOpacity onPress={onPrev} style={styles.prevBtn} activeOpacity={0.7}>
                  <Text style={styles.prevText}>Anterior</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onNext} style={styles.nextBtn} activeOpacity={0.7}>
                <Text style={styles.nextText}>{isLast ? '¡Listo!' : 'Siguiente'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Step indicator dots */}
          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentStep && styles.dotActive]} />
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
