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
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { tourStyles as styles } from './ProductTour.styles';
import type { TourStep, TargetLayout } from '../../types/tour.types';

// ────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────

// Padding proporcional al tamaño del botón, con un piso generoso: da margen
// suficiente para que el recuadro rodee el botón aunque queden 1-2px de
// desfase de medición, sin depender de constantes calibradas por dispositivo.
const SPOTLIGHT_PADDING_MIN = 14;
const SPOTLIGHT_PADDING_RATIO = 0.35; // 35% del lado más corto del botón
const SPOTLIGHT_PADDING_MAX = 28;
const SPOTLIGHT_RADIUS = 16;
const TOOLTIP_GAP = 16; // vertical gap between spotlight edge and tooltip
const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.75)';

function getSpotlightPadding(target: TargetLayout): number {
  const shortSide = Math.min(target.width, target.height);
  return Math.round(
    Math.min(
      SPOTLIGHT_PADDING_MAX,
      Math.max(SPOTLIGHT_PADDING_MIN, shortSide * SPOTLIGHT_PADDING_RATIO),
    ),
  );
}

// ────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────

export interface ProductTourOverlayProps {
  steps: TourStep[];
  currentStep: number;
  targetLayouts: Record<string, TargetLayout>;
  /** Live re-measure of a target by key; keeps the spotlight glued to the real element */
  measureTarget: (key: string) => Promise<TargetLayout | null>;
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
  measureTarget,
  onNext,
  onPrev,
  onSkip,
}: ProductTourOverlayProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const overlayRef = useRef<View>(null);
  const [tooltipHeight, setTooltipHeight] = useState(180);
  // null hasta que el overlay se mide a sí mismo: evita dibujar el spotlight con
  // un offset {0,0} provisional en el primer frame (causa de saltos por device).
  const [overlayOffset, setOverlayOffset] = useState<{ x: number; y: number } | null>(null);

  const step = steps[currentStep];
  // Posición real del target del paso actual: sembrada con el layout cacheado y
  // refrescada con una medición en vivo (ver efecto abajo) para seguir al botón.
  const [liveTarget, setLiveTarget] = useState<TargetLayout | null>(null);
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  // ── Re-medición en vivo del target de cada paso ──
  // Reintenta hasta obtener dos mediciones consecutivas iguales (posición
  // asentada), así nunca captura coordenadas de un frame de transición.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;

    // Arranca desde el layout cacheado de ESTE paso (o nada) para no mostrar por
    // un frame la posición del target anterior mientras llega la medición viva.
    setLiveTarget(targetLayouts[step.targetKey] ?? null);

    const measureUntilStable = async () => {
      let previous: TargetLayout | null = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const layout = await measureTarget(step.targetKey);
        if (cancelled) return;

        if (layout) {
          const settled =
            previous &&
            Math.abs(previous.x - layout.x) < 1 &&
            Math.abs(previous.y - layout.y) < 1 &&
            Math.abs(previous.width - layout.width) < 1 &&
            Math.abs(previous.height - layout.height) < 1;

          setLiveTarget(layout);
          if (settled) return; // posición estable → listo
          previous = layout;
        }
        // Espera un frame de layout antes de reintentar.
        await new Promise((r) => setTimeout(r, 60));
      }
    };

    void measureUntilStable();
    return () => {
      cancelled = true;
    };
  }, [step, currentStep, measureTarget, targetLayouts]);

  // measureInWindow del target y del overlay comparten origen de coordenadas en
  // ambas plataformas; restar overlayOffset ya normaliza cualquier diferencia
  // (barras de estado, safe areas, headers) sin constantes por dispositivo.
  const rawTarget = liveTarget;
  const target = rawTarget && overlayOffset ? {
    ...rawTarget,
    x: rawTarget.x - overlayOffset.x,
    y: rawTarget.y - overlayOffset.y,
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

  // No dibujar hasta tener target medido Y offset del overlay resuelto: así el
  // recuadro aparece ya en su sitio, nunca en una posición provisional.
  if (!step || !target) {
    return (
      <View
        ref={overlayRef}
        style={styles.container}
        onLayout={() => {
          overlayRef.current?.measureInWindow((x, y) => {
            setOverlayOffset((prev) =>
              prev && prev.x === x && prev.y === y ? prev : { x, y },
            );
          });
        }}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: OVERLAY_COLOR }]} pointerEvents="auto" />
      </View>
    );
  }

  const spotlightPadding = getSpotlightPadding(target);

  // ── Tooltip positioning ──
  const targetCenterY = target.y + target.height / 2;
  const showAbove = targetCenterY > screenH * 0.5;

  const rawTop = showAbove
    ? target.y - spotlightPadding - TOOLTIP_GAP - tooltipHeight
    : target.y + target.height + spotlightPadding + TOOLTIP_GAP;

  // Clamp so the tooltip never goes off-screen
  const tooltipTop = Math.max(20, Math.min(screenH - tooltipHeight - 20, rawTop));

  // ── Arrow positioning (horizontally aligned to target center) ──
  const tooltipLeft = 20;
  const tooltipWidth = screenW - tooltipLeft * 2;
  const targetCenterX = target.x + target.width / 2;
  const arrowLeft = Math.max(24, Math.min(targetCenterX - tooltipLeft - 7, tooltipWidth - 38));

  // ── SVG path ──
  const svgPath = createSpotlightPath(screenW, screenH, target, spotlightPadding, SPOTLIGHT_RADIUS);

  return (
    <View
      ref={overlayRef}
      style={styles.container}
      onLayout={() => {
        overlayRef.current?.measureInWindow((x, y) => {
          setOverlayOffset((prev) =>
            prev && prev.x === x && prev.y === y ? prev : { x, y },
          );
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
