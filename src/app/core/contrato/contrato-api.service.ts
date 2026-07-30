import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ContratoResumen, CronogramaVersion, DocumentoContrato, SolicitudSubidaDocumento } from './contrato.models';

/**
 * Wrapper sobre /partner/contrato/contratos (BC-03, motoya-api) — todo
 * scoped a la tienda de la sesión, el backend nunca recibe un tiendaId
 * explícito del cliente.
 */
@Injectable({ providedIn: 'root' })
export class ContratoApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.gatewayBaseUrl}/partner/contrato/contratos`;

  listarDeMiTienda(): Observable<ContratoResumen[]> {
    return this.http.get<ContratoResumen[]>(this.base);
  }

  obtener(id: string): Observable<ContratoResumen> {
    return this.http.get<ContratoResumen>(`${this.base}/${id}`);
  }

  listarDocumentos(id: string): Observable<DocumentoContrato[]> {
    return this.http.get<DocumentoContrato[]>(`${this.base}/${id}/documentos`);
  }

  /** Cronograma vigente — 404 si el contrato todavía no lo tiene emitido. */
  obtenerCronograma(id: string): Observable<CronogramaVersion> {
    return this.http.get<CronogramaVersion>(`${this.base}/${id}/cronograma`);
  }

  solicitarSubida(contratoId: string, nombreArchivo: string, contentType: string): Observable<SolicitudSubidaDocumento> {
    return this.http.post<SolicitudSubidaDocumento>(`${this.base}/${contratoId}/documentos/solicitar-subida`, {
      nombreArchivo,
      contentType
    });
  }

  /**
   * PUT directo a Google Cloud Storage con la signed URL — el binario nunca
   * pasa por motoya-api. No usa {@link base}: es otro host por completo, y
   * el interceptor de auth (que solo adjunta el Bearer token a requests que
   * empiezan con environment.gatewayBaseUrl) correctamente lo ignora.
   */
  subirArchivo(solicitud: SolicitudSubidaDocumento, archivo: File): Observable<unknown> {
    const headers = new HttpHeaders({
      [solicitud.headerRequeridoNombre]: solicitud.headerRequeridoValor,
      'Content-Type': archivo.type
    });
    return this.http.put(solicitud.uploadUrl, archivo, { headers });
  }

  registrarDocumento(
    contratoId: string,
    datos: {
      tipoDocumento: string;
      url: string;
      monto: number | null;
      numeroChasis?: string | null;
      color?: string | null;
      marca?: string | null;
      modelo?: string | null;
      anio?: number | null;
    }
  ): Observable<DocumentoContrato> {
    return this.http.post<DocumentoContrato>(`${this.base}/${contratoId}/documentos`, datos);
  }

  /**
   * Genera el PDF del contrato (cláusulas+anexos+cronograma) y lo sube a
   * Storage — sin body: la fecha de firma siempre es hoy (2026-07-28, el
   * momento en que se genera ES el momento en que el cliente firma en
   * sitio, ver GenerarDocumentoContratoUseCase en motoya-api). Habilitado
   * recién en PENDIENTE_FIRMA. La URL resultante también queda en
   * ContratoResumen.documentoUrl tras recargar el contrato.
   */
  generarDocumento(contratoId: string): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.base}/${contratoId}/documento`, {});
  }
}
