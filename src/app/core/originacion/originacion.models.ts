// Espeja los DTOs reales de motoya-api (com.motoya.api.originacion.infrastructure.adapter.in.web).
// Un solo punto de verdad para el wizard de Nueva Solicitud.

export type Canal = 'TIENDA_ALIADA' | 'VENTA_DIRECTA';
export type TipoDocumentoIdentidad = 'DNI' | 'CARNET_EXTRANJERIA';
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
  creadoPor: string | null;
  creadoEn: string | null;
}

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
