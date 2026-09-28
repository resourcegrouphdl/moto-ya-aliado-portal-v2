/** Catálogo de modelo de motocicleta (api-operaciones, DEC-060/DEC-062) — venta interna
 * (propia y vendedor libre) solo, nunca tiendas aliadas (ver rol.model.ts). */
export interface ModeloCatalogo {
  id: string;
  marca: string;
  modelo: string;
  categoria: string | null;
  precioCatalogo: number;
  precioMinimoNegociacion: number;
  activo: boolean;
}

/**
 * Subconjunto de campos de la unidad que el wizard necesita para elegir una moto del stock
 * (DEC-075). Trae el **estado real**, que antes no venía: sin él, el vendedor libre no podía
 * distinguir una moto que está en el salón de una que todavía viene del importador, ni ver una
 * reservada por otra solicitud (simplemente no aparecía).
 */
export interface UnidadDisponible {
  id: string;
  vin: string;
  modeloId: string | null;
  anioModelo: number | null;
  estadoComercial: 'DISPONIBLE' | 'RESERVADA' | 'VENDIDA' | 'BLOQUEADA';
  estadoAbastecimiento: 'POR_RECIBIR' | 'RECIBIDA';
  /** `null` mientras la moto no llegó: la ventana de la reserva arranca cuando llega (DEC-074). */
  reservaExpiraEn: string | null;
  ubicacionTipo: string;
  ubicacionRefId: string | null;
}

/** ¿Se puede elegir esta moto? Libre —esté en el salón o viniendo (DEC-074)— sí; reservada, no: la
 * reserva del que llegó primero manda (DEC-061). Vendida y bloqueada ni se listan. */
export function esElegible(unidad: UnidadDisponible): boolean {
  return unidad.estadoComercial === 'DISPONIBLE';
}

/** Cuánto le queda a una reserva, en frase corta (`null` si la moto no está reservada o su ventana
 * todavía no arrancó). Es solo presentación: la ventana real la manda el backend. */
export function cuentaRegresivaReserva(reservaExpiraEn: string | null): string | null {
  if (!reservaExpiraEn) return null;
  const restanteMs = new Date(reservaExpiraEn).getTime() - Date.now();
  // Redondeo hacia arriba: «Vencida» aparece cuando la ventana terminó de verdad, no hasta 30 s
  // antes (mismo criterio que la vista de stock de admin-v2).
  if (restanteMs <= 0) return 'Vencida';
  const minutos = Math.ceil(restanteMs / 60000);
  if (minutos < 60) return `Vence en ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Vence en ${horas} h`;
  const dias = Math.floor(horas / 24);
  const resto = horas % 24;
  return resto > 0 ? `Vence en ${dias} d ${resto} h` : `Vence en ${dias} d`;
}

/** La frase de estado del selector: dice **por qué** se puede elegir o no, en el mismo vocabulario
 * que la vista de stock de administración. */
export function estadoDeStock(unidad: UnidadDisponible): string {
  if (unidad.estadoComercial === 'RESERVADA') {
    const contador = cuentaRegresivaReserva(unidad.reservaExpiraEn);
    return contador ? `Reservada · ${contador.toLowerCase()}` : 'Reservada · en camino';
  }
  return unidad.estadoAbastecimiento === 'POR_RECIBIR' ? 'En camino' : 'Libre';
}
