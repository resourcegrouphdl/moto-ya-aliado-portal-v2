import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ActualizarDireccionRequest,
  AvalistaResponse,
  ClienteResponse,
  ConsultaCeeResponse,
  ConsultaDniResponse,
  CrearClienteRequest,
  CrearSolicitudRequest,
  DatosAvalista,
  DatosDocumentoIdentidadExtraidos,
  DatosReferencia,
  DatosVehiculo,
  DocumentoSolicitudResponse,
  EstadoVerificacionEmail,
  ExpedienteSolicitudResponse,
  HistorialSolicitudCliente,
  ReferenciaResponse,
  RolPersonaSolicitud,
  SolicitudCreditoResponse,
  SolicitudResumen,
  SolicitudSubidaDocumentoIdentidad,
  SolicitudSubidaDocumentoSolicitud,
  TipoDocumentoIdentidad,
  TipoDocumentoSolicitud,
  VehiculoSolicitudResponse,
  VerificacionDomicilioResponse
} from './originacion.models';

/**
 * Wrapper delgado sobre /partner/originacion/** (BC-01, motoya-api) — el
 * interceptor de auth ya adjunta el Bearer token para cualquier request que
 * empiece con environment.gatewayBaseUrl, ver auth.interceptor.ts.
 */
@Injectable({ providedIn: 'root' })
export class OriginacionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.gatewayBaseUrl}/partner/originacion`;

  buscarClientePorDocumento(tipo: TipoDocumentoIdentidad, numero: string): Observable<ClienteResponse> {
    return this.http.get<ClienteResponse>(`${this.base}/clientes/documento/${tipo}/${numero}`);
  }

  crearCliente(datos: CrearClienteRequest): Observable<ClienteResponse> {
    return this.http.post<ClienteResponse>(`${this.base}/clientes`, datos);
  }

  /**
   * Se llama siempre después de resolver el id de un cliente (titular o
   * aval), tanto si se acaba de crear como si ya existía — crearCliente no
   * es find-or-create, así que la dirección/GPS tipeada en la corrida actual
   * del wizard se perdía si el cliente ya estaba registrado.
   */
  actualizarDireccionCliente(clienteId: string, datos: ActualizarDireccionRequest): Observable<ClienteResponse> {
    return this.http.patch<ClienteResponse>(`${this.base}/clientes/${clienteId}/direccion`, datos);
  }

  crearSolicitud(datos: CrearSolicitudRequest): Observable<SolicitudCreditoResponse> {
    return this.http.post<SolicitudCreditoResponse>(`${this.base}/solicitudes`, datos);
  }

  /**
   * Estado del código de verificación vigente de un correo (2026-09-23, etapa 2): el bloque del wizard se
   * reconstruye con esto al volver a un paso o al recargar la página, en vez de pedir un código nuevo.
   */
  estadoVerificacionEmail(email: string): Observable<EstadoVerificacionEmail> {
    return this.http.get<EstadoVerificacionEmail>(`${this.base}/verificacion-email/estado`, { params: { email } });
  }

  /** Detalle completo para la pantalla "mi solicitud" del vendedor (fase 3) — titular/avalista/vehículo/referencias. */
  obtenerExpediente(solicitudId: string): Observable<ExpedienteSolicitudResponse> {
    return this.http.get<ExpedienteSolicitudResponse>(`${this.base}/solicitudes/${solicitudId}/expediente`);
  }

  /** Se llama tras subir los documentos mínimos de titular y aval — ver MarcarSolicitudCompletaUseCase en motoya-api. */
  marcarSolicitudCompleta(solicitudId: string): Observable<SolicitudCreditoResponse> {
    return this.http.post<SolicitudCreditoResponse>(`${this.base}/solicitudes/${solicitudId}/marcar-completa`, {});
  }

  agregarAvalista(solicitudId: string, datos: DatosAvalista): Observable<AvalistaResponse> {
    return this.http.post<AvalistaResponse>(`${this.base}/solicitudes/${solicitudId}/avalista`, datos);
  }

  /** Quita el aval actual y agrega el nuevo en la misma operación — ver ReemplazarAvalistaUseCase. */
  reemplazarAvalista(solicitudId: string, datos: DatosAvalista): Observable<AvalistaResponse> {
    return this.http.put<AvalistaResponse>(`${this.base}/solicitudes/${solicitudId}/avalista`, datos);
  }

  agregarVehiculo(solicitudId: string, datos: DatosVehiculo): Observable<VehiculoSolicitudResponse> {
    return this.http.post<VehiculoSolicitudResponse>(`${this.base}/solicitudes/${solicitudId}/vehiculo`, datos);
  }

  /** Reemplaza los datos del vehículo ya registrado — se usa al retroceder al paso "Moto" y volver a tocar "Continuar". */
  actualizarVehiculo(solicitudId: string, datos: DatosVehiculo): Observable<VehiculoSolicitudResponse> {
    return this.http.put<VehiculoSolicitudResponse>(`${this.base}/solicitudes/${solicitudId}/vehiculo`, datos);
  }

  agregarReferencia(solicitudId: string, datos: DatosReferencia): Observable<ReferenciaResponse> {
    return this.http.post<ReferenciaResponse>(`${this.base}/solicitudes/${solicitudId}/referencias`, datos);
  }

  // --- Verificación de correo del wizard de venta (2026-08-16) — ver VerificacionEmailController en motoya-api.
  // Enforcement es solo de frontend: mt-verificacion-email es quien decide cuándo llamar a estos 2 métodos.

  enviarCodigoVerificacionEmail(email: string): Observable<void> {
    return this.http.post<void>(`${this.base}/verificacion-email/enviar-codigo`, { email });
  }

  confirmarCodigoVerificacionEmail(email: string, codigo: string): Observable<{ verificado: boolean }> {
    return this.http.post<{ verificado: boolean }>(`${this.base}/verificacion-email/confirmar-codigo`, { email, codigo });
  }

  /** Solicitudes creadas por el usuario logueado — nunca se manda un id de vendedor, lo resuelve el backend desde la sesión. */
  listarMisClientes(): Observable<SolicitudResumen[]> {
    return this.http.get<SolicitudResumen[]>(`${this.base}/solicitudes/mis-clientes`);
  }

  /** Clientes de todos los vendedores de la tienda — administrador de aliado, control administrativo. */
  listarClientesTienda(): Observable<SolicitudResumen[]> {
    return this.http.get<SolicitudResumen[]>(`${this.base}/solicitudes/clientes-tienda`);
  }

  /** Antifraude/continuidad — historial de un documento, incluye solicitudes migradas. */
  verificarHistorial(tipoDocumento: TipoDocumentoIdentidad, numeroDocumento: string): Observable<HistorialSolicitudCliente[]> {
    return this.http.get<HistorialSolicitudCliente[]>(`${this.base}/clientes/documento/${tipoDocumento}/${numeroDocumento}/historial`);
  }

  /** Antifraude — ¿el avalista propuesto ya fue titular con este titular propuesto de avalista? */
  verificarRelacionCircular(clienteTitularId: string, clienteAvalistaId: string): Observable<boolean> {
    return this.http
      .get<{ existeRelacionCircular: boolean }>(`${this.base}/clientes/${clienteTitularId}/relacion-circular/${clienteAvalistaId}`)
      .pipe(map((r) => r.existeRelacionCircular));
  }

  /** Autocompletado de nombres/apellidos (json.pe, proxeado por el backend — nunca se llama a json.pe directo desde el navegador). */
  consultarDni(numero: string): Observable<ConsultaDniResponse> {
    return this.http.get<ConsultaDniResponse>(`${this.base}/lookup/dni/${numero}`);
  }

  consultarCee(numero: string): Observable<ConsultaCeeResponse> {
    return this.http.get<ConsultaCeeResponse>(`${this.base}/lookup/cee/${numero}`);
  }

  // ── Documentos KYC (titular/aval) ────────────────────────────────────────

  solicitarSubidaDocumento(solicitudId: string, nombreArchivo: string, contentType: string): Observable<SolicitudSubidaDocumentoSolicitud> {
    return this.http.post<SolicitudSubidaDocumentoSolicitud>(`${this.base}/solicitudes/${solicitudId}/documentos/solicitar-subida`, {
      nombreArchivo,
      contentType
    });
  }

  /** PUT directo a Google Cloud Storage con la signed URL — el binario nunca pasa por motoya-api. */
  subirArchivoDocumento(solicitud: SolicitudSubidaDocumentoSolicitud, archivo: File): Observable<unknown> {
    const headers = new HttpHeaders({
      [solicitud.headerRequeridoNombre]: solicitud.headerRequeridoValor,
      'Content-Type': archivo.type
    });
    return this.http.put(solicitud.uploadUrl, archivo, { headers });
  }

  registrarDocumento(
    solicitudId: string,
    datos: { rol: RolPersonaSolicitud; tipo: TipoDocumentoSolicitud; url: string }
  ): Observable<DocumentoSolicitudResponse> {
    return this.http.post<DocumentoSolicitudResponse>(`${this.base}/solicitudes/${solicitudId}/documentos`, datos);
  }

  listarDocumentos(solicitudId: string): Observable<DocumentoSolicitudResponse[]> {
    return this.http.get<DocumentoSolicitudResponse[]>(`${this.base}/solicitudes/${solicitudId}/documentos`);
  }

  /** Solo para documentos RECHAZADO/OBSERVADO — sube uno nuevo con solicitarSubidaDocumento()+subirArchivoDocumento() y confirma acá. Vuelve a PENDIENTE. */
  reemplazarDocumento(solicitudId: string, documentoId: string, url: string): Observable<DocumentoSolicitudResponse> {
    return this.http.put<DocumentoSolicitudResponse>(`${this.base}/solicitudes/${solicitudId}/documentos/${documentoId}/reemplazar`, { url });
  }

  // ── Verificación de domicilio (etapa 5 de originación, DEC-030) ──────────

  /**
   * 404 si esa solicitud todavía no tiene verificación de domicilio (nunca se le pidió el link) — es un caso normal,
   * el caller lo trata como "sin verificación" y ofrece el botón de reenviar igual.
   */
  obtenerVerificacionDomicilio(solicitudId: string): Observable<VerificacionDomicilioResponse> {
    return this.http.get<VerificacionDomicilioResponse>(`${this.base}/solicitudes/${solicitudId}/verificacion-domicilio`);
  }

  /**
   * Reenvío del link a pedido expreso del titular (DEC-030): reemplaza el link anterior —deja de funcionar— y el
   * backend registra quién lo autorizó (`reenviadaPor`, resuelto desde la sesión).
   *
   * `clienteId` es opcional: sin él el backend se lo manda al titular de la solicitud, y ese es justo el caso de una
   * solicitud que nunca fue invitada — no hay nada que reenviar, este POST crea la primera.
   */
  reenviarVerificacionDomicilio(solicitudId: string, clienteId?: string): Observable<VerificacionDomicilioResponse> {
    return this.http.post<VerificacionDomicilioResponse>(`${this.base}/solicitudes/${solicitudId}/verificacion-domicilio/reenviar`, clienteId ? { clienteId } : null);
  }

  // ── OCR de identidad (staging, sin solicitudId — ver DocumentoIdentidadUploadComponent) ──

  solicitarSubidaDocumentoIdentidad(nombreArchivo: string, contentType: string): Observable<SolicitudSubidaDocumentoIdentidad> {
    return this.http.post<SolicitudSubidaDocumentoIdentidad>(`${this.base}/documentos-identidad/solicitar-subida`, {
      nombreArchivo,
      contentType
    });
  }

  subirArchivoDocumentoIdentidad(solicitud: SolicitudSubidaDocumentoIdentidad, archivo: File): Observable<unknown> {
    const headers = new HttpHeaders({
      [solicitud.headerRequeridoNombre]: solicitud.headerRequeridoValor,
      'Content-Type': archivo.type
    });
    return this.http.put(solicitud.uploadUrl, archivo, { headers });
  }

  /** Best-effort — motoya-api nunca falla esta llamada, devuelve campos null en vez de propagar el error si el OCR no reconoce el documento. */
  extraerDatosDocumentoIdentidad(
    gcsPath: string,
    contentType: string,
    tipoDocumento: TipoDocumentoIdentidad
  ): Observable<DatosDocumentoIdentidadExtraidos> {
    return this.http.post<DatosDocumentoIdentidadExtraidos>(`${this.base}/documentos-identidad/extraer`, {
      gcsPath,
      contentType,
      tipoDocumento
    });
  }
}
