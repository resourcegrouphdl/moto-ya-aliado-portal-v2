/** Variantes semánticas compartidas por Alert y Toast (evita duplicar el mapeo ícono/variante). */
export type Variant = 'success' | 'warning' | 'error' | 'info';

export const VARIANT_ICON: Record<Variant, string> = {
  success: 'check_circle',
  warning: 'warning',
  error: 'error',
  info: 'info'
};
