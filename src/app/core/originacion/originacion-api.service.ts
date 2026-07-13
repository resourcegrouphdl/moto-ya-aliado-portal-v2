import { HttpClient } from '@angular/common/http';
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
  DatosReferencia,
  DatosVehiculo,
  HistorialSolicitudCliente,
  ReferenciaResponse,
  SolicitudCreditoResponse,
  SolicitudResumen,
  TipoDocumentoIdentidad,
  VehiculoSolicitudResponse
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

  agregarAvalista(solicitudId: string, datos: DatosAvalista): Observable<AvalistaResponse> {
    return this.http.post<AvalistaResponse>(`${this.base}/solicitudes/${solicitudId}/avalista`, datos);
  }

  agregarVehiculo(solicitudId: string, datos: DatosVehiculo): Observable<VehiculoSolicitudResponse> {
    return this.http.post<VehiculoSolicitudResponse>(`${this.base}/solicitudes/${solicitudId}/vehiculo`, datos);
  }

  agregarReferencia(solicitudId: string, datos: DatosReferencia): Observable<ReferenciaResponse> {
    return this.http.post<ReferenciaResponse>(`${this.base}/solicitudes/${solicitudId}/referencias`, datos);
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
}
