import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BandejaDeAvisos,
  ConsultaDePlaca,
  DetalleDelPago,
  DocumentoDelCliente,
  EstadoSolicitudSoat,
  EventoSolicitud,
  Formalizacion,
  InstruccionDePago,
  LecturaDelVoucher,
  RegistrarSolicitudRequest,
  RegistrarVoucherRequest,
  ResumenSolicitud,
  Seguimiento,
  Simulacion,
  TipoDeCobro
} from './soat.models';

/**
 * La sección de SOAT de motoya-api para el portal del aliado (`/partner/soat`, DEC-200). Quién es el originador, su tienda y su empresa lo sella el servidor
 * por su rol; este cliente nunca los manda, y el servidor solo devuelve las solicitudes que esa persona puede ver.
 */
@Injectable({ providedIn: 'root' })
export class SoatApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.gatewayBaseUrl}/partner/soat`;

  consultarPlaca(placa: string): Observable<ConsultaDePlaca> {
    return this.http.get<ConsultaDePlaca>(`${this.base}/consultas/placa/${encodeURIComponent(placa)}`);
  }

  avisos(): Observable<BandejaDeAvisos> {
    return this.http.get<BandejaDeAvisos>(`${this.base}/avisos`);
  }

  marcarAvisosVistos(): Observable<void> {
    return this.http.put<void>(`${this.base}/avisos/vistos`, {});
  }

  listar(estado: EstadoSolicitudSoat | null = null): Observable<ResumenSolicitud[]> {
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    return this.http.get<ResumenSolicitud[]>(`${this.base}/solicitudes`, { params });
  }

  registrar(solicitud: RegistrarSolicitudRequest): Observable<Seguimiento> {
    return this.http.post<Seguimiento>(`${this.base}/solicitudes`, solicitud);
  }

  seguimiento(id: string): Observable<Seguimiento> {
    return this.http.get<Seguimiento>(`${this.base}/solicitudes/${id}`);
  }

  historial(id: string): Observable<EventoSolicitud[]> {
    return this.http.get<EventoSolicitud[]>(`${this.base}/solicitudes/${id}/historial`);
  }

  /** Cumple un requisito con su archivo (ya subido a Document Management) o con una declaración. */
  cumplirHito(id: string, tipo: 'CONSENTIMIENTO' | DocumentoDelCliente, documentoId: string | null, detalle: string | null): Observable<Seguimiento> {
    return this.http.put<Seguimiento>(`${this.base}/solicitudes/${id}/hitos/${tipo}`, { documentoId, detalle });
  }

  pedirCotizacion(id: string): Observable<unknown> {
    return this.http.post(`${this.base}/solicitudes/${id}/cotizaciones`, {});
  }

  aceptarPrecio(id: string): Observable<Seguimiento> {
    return this.http.put<Seguimiento>(`${this.base}/solicitudes/${id}/precio/aceptar`, {});
  }

  desistir(id: string, motivo: string): Observable<Seguimiento> {
    return this.http.put<Seguimiento>(`${this.base}/solicitudes/${id}/desistir`, { motivo });
  }

  /** Las cuotas del crédito con el precio de la solicitud (o el referencial si todavía no hay precio). */
  simular(id: string, cuotas = 8): Observable<Simulacion> {
    return this.http.get<Simulacion>(`${this.base}/solicitudes/${id}/simulacion`, { params: { cuotas } });
  }

  /** Evalúa el crédito: devuelve en qué quedó (aprobada, en revisión o rechazada), sin los motivos del bureau. */
  evaluar(id: string): Observable<Seguimiento> {
    return this.http.put<Seguimiento>(`${this.base}/solicitudes/${id}/evaluacion`, {});
  }

  iniciarFormalizacion(id: string): Observable<Formalizacion> {
    return this.http.put<Formalizacion>(`${this.base}/solicitudes/${id}/formalizacion/iniciar`, {});
  }

  formalizacion(id: string): Observable<Formalizacion> {
    return this.http.get<Formalizacion>(`${this.base}/solicitudes/${id}/formalizacion`);
  }

  generarContrato(id: string): Observable<Formalizacion> {
    return this.http.put<Formalizacion>(`${this.base}/solicitudes/${id}/formalizacion/contrato`, {});
  }

  urlDelContrato(id: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.base}/solicitudes/${id}/formalizacion/contrato/url`);
  }

  sincronizarFirma(id: string): Observable<Formalizacion> {
    return this.http.put<Formalizacion>(`${this.base}/solicitudes/${id}/formalizacion/firma/sincronizar`, {});
  }

  /** Abre el cobro (el pago completo del contado o la inicial del crédito) y dice adónde depositar. Repetirlo devuelve lo mismo. */
  iniciarCobro(id: string, cobro: TipoDeCobro): Observable<InstruccionDePago> {
    return this.http.put<InstruccionDePago>(`${this.base}/solicitudes/${id}/${cobro}/iniciar`, {});
  }

  cobro(id: string, cobro: TipoDeCobro): Observable<DetalleDelPago> {
    return this.http.get<DetalleDelPago>(`${this.base}/solicitudes/${id}/${cobro}`);
  }

  leerVoucher(id: string, documentoId: string, cobro: TipoDeCobro): Observable<LecturaDelVoucher> {
    return this.http.get<LecturaDelVoucher>(`${this.base}/solicitudes/${id}/${cobro}/voucher/lectura`, { params: { documentoId } });
  }

  registrarVoucher(id: string, voucher: RegistrarVoucherRequest, cobro: TipoDeCobro): Observable<DetalleDelPago> {
    return this.http.post<DetalleDelPago>(`${this.base}/solicitudes/${id}/${cobro}/voucher`, voucher);
  }
}
