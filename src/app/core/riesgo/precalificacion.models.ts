/** Espeja ResultadoPreCalificacionResponse (motoya-api, BC-02) — a propósito solo trae zona+mensaje genérico, nunca el detalle del reporte crediticio del cliente. */
export type ZonaPreCalificacion = 'VERDE' | 'AMARILLO' | 'ROJO';

/**
 * El motor de reglas es el mismo para ambos (ver ReglasKoEvaluador.REGLAS_AVAL en el backend — el aval ya se
 * evalúa hoy solo con señales generales de riesgo, nunca capacidad de pago), pero el mensaje/consecuencia de un
 * rojo es distinta — un titular en rojo no tiene alternativa, un aval en rojo sí (pedir otro aval).
 */
export type RolPersonaPreCalificacion = 'TITULAR' | 'AVAL';

export interface ResultadoPreCalificacion {
  id: string;
  zona: ZonaPreCalificacion;
  /** Texto fijo ya resuelto por el backend según zona+rol (ver CriterioPreCalificacion.mensajeVendedor()) — null en zona VERDE. */
  mensaje: string | null;
}
