/**
 * Parity Design System — Premium Light Theme
 * Single source of truth for all design tokens.
 * No dark mode. No emojis. Typography-first.
 */

export const C = {
  // Backgrounds
  bgPrimary: '#F4F5F7',   // Page canvas — cool near-white
  bgCard:    '#FFFFFF',   // Card surface
  bgSubtle:  '#F9FAFB',   // Inner sections inside cards

  // Text — WCAG AA contrast on white
  txt1: '#0F1117',        // Headings / primary text — near-black
  txt2: '#4B5563',        // Secondary / body
  txt3: '#9CA3AF',        // Captions / hints

  // Brand
  brand:  '#1A2450',      // Parity navy

  // Semantic
  green:  '#059669',      // Active / success (Emerald-600, not lime-green)
  greenBg:'#ECFDF5',      // Green tint background
  amber:  '#D97706',      // Warnings / monthly highlight
  amberBg:'#FFFBEB',
  blue:   '#2563EB',      // Links / info
  blueBg: '#EFF6FF',
  red:    '#DC2626',      // Rejected / errors
  redBg:  '#FEF2F2',

  // Borders
  border: '#E5E7EB',      // Standard 1px divider
  borderStrong: '#D1D5DB',// Focused states
};

export const FONT = {
  // Sizes — modular scale (1.25 ratio)
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  30,
  hero: 38,

  // Weights as string literals for React Native
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
  heavy:   '800' as const,

  // Letter spacing
  tight:  -0.5,
  normal:  0,
  wide:    0.5,
  wider:   1.0,
};

export const RADIUS = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  full: 999,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
};
