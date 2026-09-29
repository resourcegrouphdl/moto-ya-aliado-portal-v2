// Espeja los DTOs reales de motoya-api (com.motoya.api.tesoreria) — BC-06 Comisión a Vendedor y las facturas del
// legado, expuestos bajo /partner/tesoreria. (Las órdenes de pago del circuito viejo se retiraron con la pieza 5
// de la fase D, 2026-09-28.)
export type EstadoComision = 'PENDIENTE' | 'PAGADA';

export interface ComisionResumen {
  id: string;
  contratoId: string;
  numeroContrato: string | null;
  clienteNombre: string | null;
  vehiculoDescripcion: string | null;
  tiendaNombre: string | null;
  vendedorUsuarioId: string;
  vendedorNombre: string | null;
  monto: number;
  estado: EstadoComision;
  comprobanteUrl: string | null;
  pagadoEn: string | null;
  creadoEn: string;
}

export const ESTADO_COMISION_LABEL: Record<EstadoComision, string> = {
  PENDIENTE: 'Pendiente de pago',
  PAGADA: 'Pagada'
};

// Contratos migrados (motorCalculo=LEGACY_TASA_FIJA_MIGRADO): no tienen cronograma del motor nuevo, su estado
// se consulta en vivo contra el Firestore del sistema legacy (ver /partner/tesoreria/facturas-legado).
export type EstadoFacturaLegado = 'PAGADA' | 'PENDIENTE' | 'SIN_REGISTRO';

export interface FacturaLegadoResumen {
  contratoId: string;
  numeroContrato: string;
  estado: EstadoFacturaLegado;
}

export const ESTADO_FACTURA_LEGADO_LABEL: Record<EstadoFacturaLegado, string> = {
  PAGADA: 'Pagado',
  PENDIENTE: 'Pendiente de pago',
  SIN_REGISTRO: 'Sin registro'
};

// Comisión de vendedor de contratos migrados (motorCalculo=LEGACY_TASA_FIJA_MIGRADO):
// vive solo en finanzas_comisiones (Firestore legacy), nunca en Postgres.
export type EstadoComisionLegado = 'PENDIENTE' | 'EN_PROCESO' | 'PAGADO';

export interface ComisionLegadoResumen {
  id: string;
  numeroContrato: string | null;
  clienteNombre: string | null;
  clienteDocumento: string | null;
  vendedorNombre: string | null;
  tiendaNombre: string | null;
  montoComision: number;
  estado: EstadoComisionLegado;
  pagadoEn: string | null;
}

export const ESTADO_COMISION_LEGADO_LABEL: Record<EstadoComisionLegado, string> = {
  PENDIENTE: 'Pendiente de pago',
  EN_PROCESO: 'En proceso',
  PAGADO: 'Pagada'
};
