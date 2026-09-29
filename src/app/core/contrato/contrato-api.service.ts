import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ContratoResumen,
  CronogramaVersion,
  DatosFacturaVehiculoExtraidos,
  DocumentoContrato
} from './contrato.models';

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

  registrarDocumento(
    contratoId: string,
    datos: {
      tipoDocumento: string;
      /** El Documento de Document Management (DEC-057) — el único camino: todo el expediente entra por ahí. */
      documentoId: string;
      monto: number | null;
      numeroChasis?: string | null;
      color?: string | null;
      marca?: string | null;
      modelo?: string | null;
      anio?: number | null;
      numeroMotor?: string | null;
    }
  ): Observable<DocumentoContrato> {
    return this.http.post<DocumentoContrato>(`${this.base}/${contratoId}/documentos`, datos);
  }

  /**
   * Las correcciones sobre el prellenado del OCR — **el aprendizaje del lector** (fase D): el backend
   * compara contra lo que se había leído y aprende la etiqueta de esa tienda donde haya diferencia.
   * Best-effort: si falla, el documento ya quedó registrado igual.
   */
  corregirFactura(contratoId: string, documentoId: string, campos: Record<string, string>): Observable<{ reglasAprendidas: number }> {
    return this.http.post<{ reglasAprendidas: number }>(
      `${this.base}/${contratoId}/documentos/${documentoId}/correcciones`,
      { campos }
    );
  }

  /**
   * OCR best-effort de la factura ya registrada en **Document Management** (fase D): motoya-api la lee de
   * DM y le manda el archivo en línea a Document AI — mismo criterio que el flujo de identidad.
   */
  extraerFactura(contratoId: string, documentoId: string, contentType: string): Observable<DatosFacturaVehiculoExtraidos> {
    return this.http.post<DatosFacturaVehiculoExtraidos>(`${this.base}/${contratoId}/documentos/extraer-factura`, {
      documentoId,
      contentType
    });
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
