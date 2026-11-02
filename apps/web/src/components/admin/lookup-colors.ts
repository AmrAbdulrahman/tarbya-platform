import type { LookupColor } from '@tarbya/api-client';

/** The lookup palette from design/screens/ActivityTypes.dc.html. */
export const lookupColors: Record<
  LookupColor,
  { swatch: string; tint: string; text: string }
> = {
  PURPLE: { swatch: '#7446F0', tint: '#EFEAFE', text: '#5A2FD6' },
  NAVY: { swatch: '#0F4C81', tint: '#E0EEFA', text: '#0F4C81' },
  GREEN: { swatch: '#047857', tint: '#ECFDF5', text: '#047857' },
  AMBER: { swatch: '#B45309', tint: '#FFFBEB', text: '#92400E' },
  ROSE: { swatch: '#BE185D', tint: '#FDF2F8', text: '#9D174D' },
  SLATE: { swatch: '#475569', tint: '#F1F5F9', text: '#334155' },
};
