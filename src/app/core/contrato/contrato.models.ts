// Espeja los DTOs reales de motoya-api (com.motoya.api.contrato) — BC-03
// Contratos, expuestos bajo /partner/contrato/contratos para el pool tienda.
export type Canal = 'TIENDA_ALIADA' | 'VENTA_DIRECTA';
export type EstadoFormalizacion = 'GENERADO' | 'PENDIENTE_DOCUMENTOS' | 'PENDIENTE_FIRMA' | 'FIRMADO' | 'CANCELADO';
export type EstadoCredito = 'ACTIVO' | 'LIQUIDADO' | 'REFINANCIADO' | 'EN_PROCESO_JUDICIAL' | 'CASTIGADO';
export type TipoDocumentoContrato = 'BOUCHER' | 'FACTURA' | 'EVIDENCIA_FIRMA' | 'TIVE' | 'SOAT' | 'PLACA' | 'ACTA_ENTREGA';
export type EstadoDocumento = 'PENDIENTE' | 'VALIDADO' | 'RECHAZADO';

export interface ContratoResumen {
  id: string;
  numeroContrato: string;
  canal: Canal;
  evaluacionId: string;
  productoCreditoId: string;
  tiendaId: string | null;
  fuenteFondeoId: string | null;
  precioVehiculo: number | null;
  inicialEsperada: number | null;
  estadoFormalizacion: EstadoFormalizacion;
  estadoCredito: EstadoCredito | null;
  motorCalculo: string;
  fechaFirma: string | null;
  documentoUrl: string | null;
  creadoPor: string;
  creadoEn: string;
  vendedorNombre: string | null;
}

export interface DocumentoContrato {
  id: string;
  contratoId: string;
  tipoDocumento: TipoDocumentoContrato;
  url: string;
  monto: number | null;
  estado: EstadoDocumento;
  subidoPor: string;
  subidoEn: string;
  validadoPor: string | null;
  validadoEn: string | null;
  notas: string | null;
}

export interface SolicitudSubidaDocumento {
  uploadUrl: string;
  publicUrl: string;
  headerRequeridoNombre: string;
  headerRequeridoValor: string;
}

export const ESTADO_FORMALIZACION_LABEL: Record<EstadoFormalizacion, string> = {
  GENERADO: 'Generado',
  PENDIENTE_DOCUMENTOS: 'Pendiente de documentos',
  PENDIENTE_FIRMA: 'Pendiente de firma',
  FIRMADO: 'Firmado',
  CANCELADO: 'Cancelado'
};

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumentoContrato, string> = {
  BOUCHER: 'Boucher de pago inicial',
  FACTURA: 'Factura de la moto',
  EVIDENCIA_FIRMA: 'Evidencia de firma',
  TIVE: 'TIVE',
  SOAT: 'SOAT',
  PLACA: 'Placa de rodaje',
  ACTA_ENTREGA: 'Acta de entrega'
};

export const ESTADO_DOCUMENTO_LABEL: Record<EstadoDocumento, string> = {
  PENDIENTE: 'Pendiente de revisión',
  VALIDADO: 'Validado',
  RECHAZADO: 'Rechazado'
};
