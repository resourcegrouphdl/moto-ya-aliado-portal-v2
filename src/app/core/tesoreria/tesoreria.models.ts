// Espeja los DTOs reales de motoya-api (com.motoya.api.tesoreria) — BC-05
// Pagos a Tienda / BC-06 Comisión a Vendedor, expuestos bajo /partner/tesoreria.
export type TipoOrdenPago = 'INICIAL' | 'DESEMBOLSO';
export type EstadoOrdenPago =
  | 'PENDIENTE'
  | 'APROBADA_1'
  | 'APROBADA_2'
  | 'AUTORIZADA'
  | 'EN_PROCESAMIENTO'
  | 'PROCESADA'
  | 'CONCILIADA'
  | 'RECHAZADA'
  | 'ANULADA';
export type EstadoComision = 'PENDIENTE' | 'PAGADA';

export interface OrdenPagoResumen {
  id: string;
  contratoId: string;
  tipo: TipoOrdenPago;
  monto: number;
  fechaProgramada: string;
  estado: EstadoOrdenPago;
  motivoRechazo: string | null;
  referenciaConciliacion: string | null;
  comprobanteUrl: string | null;
  creadoEn: string;
}

export interface ComisionResumen {
  id: string;
  contratoId: string;
  vendedorUsuarioId: string;
  vendedorNombre: string | null;
  monto: number;
  estado: EstadoComision;
  comprobanteUrl: string | null;
  pagadoEn: string | null;
  creadoEn: string;
}

export const TIPO_ORDEN_PAGO_LABEL: Record<TipoOrdenPago, string> = {
  INICIAL: 'Pago inicial',
  DESEMBOLSO: 'Desembolso de capital'
};

export const ESTADO_ORDEN_PAGO_LABEL: Record<EstadoOrdenPago, string> = {
  PENDIENTE: 'Pendiente de aprobación',
  APROBADA_1: 'Aprobada (1ra firma)',
  APROBADA_2: 'Aprobada (2da firma)',
  AUTORIZADA: 'Autorizada',
  EN_PROCESAMIENTO: 'En procesamiento',
  PROCESADA: 'Procesada',
  CONCILIADA: 'Pagado',
  RECHAZADA: 'Rechazada',
  ANULADA: 'Anulada'
};

export const ESTADO_COMISION_LABEL: Record<EstadoComision, string> = {
  PENDIENTE: 'Pendiente de pago',
  PAGADA: 'Pagada'
};

// Contratos migrados (motorCalculo=LEGACY_TASA_FIJA_MIGRADO): no tienen
// OrdenPago en Postgres, su estado se consulta en vivo contra el Firestore
// del sistema legacy (ver /partner/tesoreria/facturas-legado).
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
