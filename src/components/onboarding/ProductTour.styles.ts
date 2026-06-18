import { StyleSheet } from 'react-native';

export const tourStyles = StyleSheet.create({
  /* ── Overlay container ─────────────────────────────── */
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
  },

  /* ── Tooltip wrapper (absolute positioning) ────────── */
  tooltipWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
  },

  /* ── Tooltip card ──────────────────────────────────── */
  tooltip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    marginBottom: 20,
  },

  /* ── Footer: skip + nav buttons ────────────────────── */
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  navBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  prevBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  prevText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  nextBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#83A98A',
    minWidth: 80,
    alignItems: 'center',
  },
  nextText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  /* ── Step indicator dots ───────────────────────────── */
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: '#83A98A',
    width: 18,
    borderRadius: 4,
  },

  /* ── Tooltip arrow (rotated square) ────────────────── */
  arrow: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
});
