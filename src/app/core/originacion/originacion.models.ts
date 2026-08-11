// Espeja los DTOs reales de motoya-api (com.motoya.api.originacion.infrastructure.adapter.in.web).
// Un solo punto de verdad para el wizard de Nueva Solicitud.

import { BadgeVariant } from '../../shared/ui/badge/badge.component';

export type Canal = 'TIENDA_ALIADA' | 'VENTA_DIRECTA';
export type TipoDocumentoIdentidad = 'DNI' | 'CARNET_EXTRANJERIA';

// json.pe (DNI/CE) no provee fecha de nacimiento ni nacionalidad — se capturan
// a mano en el wizard; edad se calcula al vuelo (frontend en vivo, backend en
// ClienteResponse) para que nadie tenga que restar años manualmente.
export type Nacionalidad =
  | 'PERU'
  | 'VENEZUELA'
  | 'COLOMBIA'
  | 'ECUADOR'
  | 'BOLIVIA'
  | 'CHILE'
  | 'ARGENTINA'
  | 'BRASIL'
  | 'PARAGUAY'
  | 'URUGUAY'
  | 'MEXICO'
  | 'HAITI'
  | 'REPUBLICA_DOMINICANA'
  | 'CUBA'
  | 'OTRO';

export const NACIONALIDAD_LABEL: Record<Nacionalidad, string> = {
  PERU: 'Perú',
  VENEZUELA: 'Venezuela',
  COLOMBIA: 'Colombia',
  ECUADOR: 'Ecuador',
  BOLIVIA: 'Bolivia',
  CHILE: 'Chile',
  ARGENTINA: 'Argentina',
  BRASIL: 'Brasil',
  PARAGUAY: 'Paraguay',
  URUGUAY: 'Uruguay',
  MEXICO: 'México',
  HAITI: 'Haití',
  REPUBLICA_DOMINICANA: 'República Dominicana',
  CUBA: 'Cuba',
  OTRO: 'Otro'
};

// Requerido por el texto legal del Pagaré (Anexo 3, "JUAN PEREZ, Soltero(a),
// identificado con DNI..."), no se capturaba hasta ahora (2026-07-30).
export type EstadoCivil = 'SOLTERO' | 'CASADO' | 'DIVORCIADO' | 'VIUDO' | 'CONVIVIENTE';

export const ESTADO_CIVIL_LABEL: Record<EstadoCivil, string> = {
  SOLTERO: 'Soltero(a)',
  CASADO: 'Casado(a)',
  DIVORCIADO: 'Divorciado(a)',
  VIUDO: 'Viudo(a)',
  CONVIVIENTE: 'Conviviente'
};
export type EstadoSolicitud =
  | 'BORRADOR'
  | 'INCOMPLETA'
  | 'COMPLETA'
  | 'EN_EVALUACION'
  | 'CERRADA'
  | 'DESISTIDA'
  | 'VENCIDA';

export interface CrearClienteRequest {
  tipoDocumento: TipoDocumentoIdentidad;
  numeroDocumento: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  telefono?: string;
  email?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  latitud?: number | null;
  longitud?: number | null;
  /** Sugerencia de Google al marcar el pin en el mapa — nunca se usa en documentos generados, solo para uso futuro. */
  direccionSugerida?: string | null;
  fechaNacimiento?: string | null;
  nacionalidad?: Nacionalidad | null;
  estadoCivil?: EstadoCivil | null;
}

export interface ClienteResponse {
  id: string;
  tipoDocumento: TipoDocumentoIdentidad;
  numeroDocumento: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  telefono: string | null;
  email: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  /** Sugerencia de Google al marcar el pin en el mapa — nunca se usa en documentos generados, solo para uso futuro. */
  direccionSugerida: string | null;
  /** Nunca se persiste — motoya-api la calcula al vuelo desde fechaNacimiento. */
  fechaNacimiento: string | null;
  edad: number | null;
  nacionalidad: Nacionalidad | null;
  estadoCivil: EstadoCivil | null;
  creadoPor: string | null;
  creadoEn: string | null;
}

/** PATCH /clientes/{id}/direccion — se llama siempre tras resolver el id del cliente (creado o encontrado), ver OriginacionApiService. */
export interface ActualizarDireccionRequest {
  departamento?: string | null;
  provincia?: string | null;
  distrito?: string | null;
  direccion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  direccionSugerida?: string | null;
  fechaNacimiento?: string | null;
  nacionalidad?: Nacionalidad | null;
  estadoCivil?: EstadoCivil | null;
}

/** Respuesta de /partner/originacion/lookup/dni/{numero} y .../lookup/cee/{numero} — mismos 4 campos en ambos. */
export interface ConsultaDniResponse {
  numero: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

export type ConsultaCeeResponse = ConsultaDniResponse;

export interface CrearSolicitudRequest {
  canal: Canal;
  titularId: string;
  tiendaId?: string | null;
  documentosMinimosCompletos: boolean;
}

export interface SolicitudCreditoResponse {
  id: string;
  codigoSolicitud: string;
  canal: Canal;
  titularId: string;
  tiendaId: string | null;
  estado: EstadoSolicitud;
  creadoPor: string | null;
  creadoEn: string | null;
}

/**
 * Resultado de la evaluación BC-02 — {@code null} mientras Riesgo no ha
 * iniciado el análisis. Antes de esto la tienda solo veía `estado: 'CERRADA'`
 * sin saber si el crédito fue aprobado o rechazado (BC-01 no toma
 * decisiones de crédito, esa decisión vive en BC-02); gap cerrado 2026-07-21.
 */
export type EstadoExpediente = 'RECIBIDO' | 'EN_ANALISIS' | 'EN_COMITE' | 'APROBADO' | 'APROBADO_CON_CONDICIONES' | 'RECHAZADO';

/** "Mis clientes" del ejecutivo — junta solicitud+titular+(si existe) vehículo, ya resuelto por el backend. */
export interface SolicitudResumen {
  id: string;
  codigoSolicitud: string;
  canal: Canal;
  estado: EstadoSolicitud;
  creadoEn: string | null;
  titularTipoDocumento: TipoDocumentoIdentidad;
  titularNumeroDocumento: string;
  titularNombres: string;
  titularApellidoPaterno: string;
  titularApellidoMaterno: string;
  vehiculoMarca: string | null;
  vehiculoModelo: string | null;
  vehiculoPrecio: number | null;
  expedienteNumeroExpediente: string | null;
  expedienteEstado: EstadoExpediente | null;
  expedienteDecisionMotivo: string | null;
}

export const ESTADO_EXPEDIENTE_LABEL: Record<EstadoExpediente, string> = {
  RECIBIDO: 'Recibido',
  EN_ANALISIS: 'En análisis',
  EN_COMITE: 'En comité',
  APROBADO: 'Aprobado',
  APROBADO_CON_CONDICIONES: 'Aprobado con condiciones',
  RECHAZADO: 'Rechazado'
};

export const ESTADO_EXPEDIENTE_BADGE_VARIANT: Record<EstadoExpediente, BadgeVariant> = {
  RECIBIDO: 'neutral',
  EN_ANALISIS: 'info',
  EN_COMITE: 'warning',
  APROBADO: 'success',
  APROBADO_CON_CONDICIONES: 'success',
  RECHAZADO: 'error'
};

/**
 * Qué badge mostrar en la lista de clientes: mientras BC-02 no inició
 * evaluación, el estado de la solicitud (BC-01) ya dice todo lo que hay que
 * decir. Una vez que existe expediente, su resultado manda — 'CERRADA' por
 * sí solo no distingue aprobado de rechazado (BC-01 no decide crédito).
 */
export function estadoMostradoDe(
  resumen: SolicitudResumen,
  estadoSolicitudLabel: Record<EstadoSolicitud, string>,
  estadoSolicitudVariant: Record<EstadoSolicitud, BadgeVariant>
): { label: string; variant: BadgeVariant; motivo: string | null } {
  if (resumen.expedienteEstado) {
    return {
      label: ESTADO_EXPEDIENTE_LABEL[resumen.expedienteEstado],
      variant: ESTADO_EXPEDIENTE_BADGE_VARIANT[resumen.expedienteEstado],
      motivo: resumen.expedienteDecisionMotivo
    };
  }
  return { label: estadoSolicitudLabel[resumen.estado], variant: estadoSolicitudVariant[resumen.estado], motivo: null };
}

export interface DatosAvalista {
  clienteId: string;
  relacion: string | null;
}

export interface AvalistaResponse {
  id: string;
  solicitudId: string;
  clienteId: string;
  relacion: string | null;
}

export interface DatosVehiculo {
  marca: string;
  modelo: string;
  anio: number;
  color?: string | null;
  placa?: string | null;
  numeroMotor?: string | null;
  numeroChasis?: string | null;
  precioVehiculo: number;
  /** Inicial que el cliente dijo tener disponible — informativo, el analista decide el financiamiento real al iniciar evaluación. */
  inicialIngresada?: number | null;
  /** Cuotas que el cliente pidió — mismo criterio que inicialIngresada. */
  numeroPeriodos?: number | null;
  /**
   * A diferencia de inicialIngresada/numeroPeriodos, esta decisión SÍ es
   * vinculante (2026-08-10): viaja hasta la cotización real que sustenta
   * certificado y contrato — nunca se ignora silenciosamente.
   */
  incluyeSoat: boolean;
}

export interface VehiculoSolicitudResponse extends DatosVehiculo {
  id: string;
  solicitudId: string;
}

export interface DatosReferencia {
  numero: number;
  nombres: string;
  apellidos: string;
  telefono: string;
  relacion: string | null;
}

export interface ReferenciaResponse extends DatosReferencia {
  id: string;
  solicitudId: string;
}

export interface ExpedienteSolicitudResponse {
  solicitud: SolicitudCreditoResponse;
  titular: ClienteResponse;
  avalista: ClienteResponse | null;
  avalistaRelacion: string | null;
  vehiculo: VehiculoSolicitudResponse | null;
  referencias: ReferenciaResponse[];
}

/**
 * Antifraude/continuidad (BC-01) — historial de un documento, incluye
 * solicitudes migradas de Firestore. decisionFinal/motivo quedan null
 * cuando la solicitud es real (BC-02 todavía no existe) o nunca llegó a
 * una decisión.
 */
export interface HistorialSolicitudCliente {
  codigoSolicitud: string;
  estado: EstadoSolicitud;
  decisionFinal: string | null;
  motivoDecision: string | null;
  motivoRechazo: string | null;
  creadoEn: string | null;
}

// Documentos KYC de titular/aval (BC-01) — portados del formulario legacy
// (dniFrente/dniReverso/licencia/selfie/certificadoLaboral/reciboServicio/
// fachada + 2 slots "otros"), limpiado de duplicados y bugs de nombre.
export type RolPersonaSolicitud = 'TITULAR' | 'AVALISTA';
export type TipoDocumentoSolicitud =
  | 'DNI_FRENTE'
  | 'DNI_REVERSO'
  | 'LICENCIA_FRENTE'
  | 'LICENCIA_REVERSO'
  | 'SELFIE'
  | 'CERTIFICADO_LABORAL'
  | 'RECIBO_SERVICIO'
  | 'FACHADA'
  | 'OTRO_1'
  | 'OTRO_2';

export interface SolicitudSubidaDocumentoSolicitud {
  uploadUrl: string;
  publicUrl: string;
  headerRequeridoNombre: string;
  headerRequeridoValor: string;
}

// OCR de identidad (2026-07-20) — sube la foto del DNI/carné ANTES de que
// exista cliente/solicitud (staging en GCS), luego Document AI intenta
// prellenar numeroDocumento/fechaNacimiento/nacionalidad. Ver DocumentAiClient
// en motoya-api: NO existe un extractor de campos de identidad genérico en
// Document AI, se usa OCR_PROCESSOR (texto plano + regex) + ID_PROOFING_PROCESSOR
// (señales de fraude/calidad) en paralelo — todos los campos son best-effort,
// nunca autoritativos, y el formulario sigue 100% editable si el OCR falla.
export interface SolicitudSubidaDocumentoIdentidad {
  uploadUrl: string;
  publicUrl: string;
  gcsPath: string;
  headerRequeridoNombre: string;
  headerRequeridoValor: string;
}

export interface DatosDocumentoIdentidadExtraidos {
  numeroDocumento: string | null;
  fechaNacimiento: string | null;
  fechaEmision: string | null;
  fechaCaducidad: string | null;
  nacionalidad: Nacionalidad | null;
  posibleProblemaCalidad: boolean;
  detalleProblemaCalidad: string | null;
  /** true solo cuando el aviso viene de una señal de fraude real, no de un campo que el OCR simplemente no reconoció. */
  posibleFraude: boolean;
  /** Solo viene informado cuando el OCR detectó un tipo distinto al que tenía marcado el selector — corregirlo, no ignorarlo. */
  tipoDocumentoDetectado: TipoDocumentoIdentidad | null;
}

export type EstadoDocumentoSolicitud = 'PENDIENTE' | 'APROBADO' | 'OBSERVADO' | 'RECHAZADO';

export interface DocumentoSolicitudResponse {
  id: string;
  rol: RolPersonaSolicitud;
  tipo: TipoDocumentoSolicitud;
  url: string;
  subidoEn: string;
  estado: EstadoDocumentoSolicitud;
  observaciones: string | null;
  validadoEn: string | null;
}

export const ESTADO_DOCUMENTO_SOLICITUD_LABEL: Record<EstadoDocumentoSolicitud, string> = {
  PENDIENTE: 'Pendiente de revisión',
  APROBADO: 'Aprobado',
  OBSERVADO: 'Observado',
  RECHAZADO: 'Rechazado'
};

export const ESTADO_DOCUMENTO_SOLICITUD_BADGE_VARIANT: Record<EstadoDocumentoSolicitud, BadgeVariant> = {
  PENDIENTE: 'neutral',
  APROBADO: 'success',
  OBSERVADO: 'warning',
  RECHAZADO: 'error'
};

/** Slots de documentos por rol — SELFIE solo aplica a TITULAR (el aval no la requiere). */
export const DOCUMENTOS_TITULAR: { tipo: TipoDocumentoSolicitud; label: string }[] = [
  { tipo: 'DNI_FRENTE', label: 'DNI — frente' },
  { tipo: 'DNI_REVERSO', label: 'DNI — reverso' },
  { tipo: 'LICENCIA_FRENTE', label: 'Licencia de conducir — frente' },
  { tipo: 'LICENCIA_REVERSO', label: 'Licencia de conducir — reverso' },
  { tipo: 'SELFIE', label: 'Selfie' },
  { tipo: 'CERTIFICADO_LABORAL', label: 'Certificado laboral' },
  { tipo: 'RECIBO_SERVICIO', label: 'Recibo de servicio (domicilio)' },
  { tipo: 'FACHADA', label: 'Fachada de la vivienda' },
  { tipo: 'OTRO_1', label: 'Otro documento (1)' },
  { tipo: 'OTRO_2', label: 'Otro documento (2)' }
];

export const DOCUMENTOS_AVALISTA: { tipo: TipoDocumentoSolicitud; label: string }[] = DOCUMENTOS_TITULAR.filter(
  (d) => d.tipo !== 'SELFIE'
);
