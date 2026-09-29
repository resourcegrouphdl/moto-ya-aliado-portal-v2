import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { sha256Hex } from '../util/hash-archivo';

/** Tipos del catálogo cerrado de Document Management que ya sube este portal; se amplía al sumar cada uso (DEC-057). */
export type TipoDocumentoDm =
  | 'FACTURA'
  | 'VOUCHER'
  // Fecha de corte 2026-09-28: el expediente del contrato completo entra por DM.
  | 'EVIDENCIA_FIRMA'
  | 'PLACA'
  | 'ACTA_ENTREGA'
  | 'SOAT'
  | 'TIVE';

export interface SubirDocumentoRequest {
  tipo: TipoDocumentoDm;
  archivo: File;
  /** A quién pertenece el documento (el expediente del contrato: el cliente no siempre tiene persona registrada). */
  propietarioId: string;
  /** A qué operación o entidad está ligado y su id (p. ej. `CONTRATO`). */
  entidadRelacionadaTipo: string;
  entidadRelacionadaId: string;
  etiqueta?: string;
}

/**
 * Único camino para subir un archivo al sistema (DEC-057): todo documento queda registrado en Document Management
 * (`api-operaciones`) con su tipo, su dueño y a qué está ligado, para tener trazabilidad. Los pasos —URL firmada con la
 * carpeta del tipo, subida directa, hash de integridad y registro del Documento— viven aquí para que ninguna pantalla los
 * repita ni se salte alguno. Quién lo subió lo resuelve el servidor desde la sesión, no este cliente.
 *
 * <p>En este portal lo usan la **factura de la moto** (la que la tienda emite al cliente) y su **voucher de pago**: son
 * documentos del cliente y del expediente de la moto, no cuentas por pagar de Motoya — por eso no pasan por Tesorería.
 */
@Injectable({ providedIn: 'root' })
export class DocumentosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.gatewayBaseUrl}/api/operaciones/documentos`;

  /** Sube el archivo y lo registra como Documento; devuelve el id del Documento (lo que otros módulos guardan). */
  subir(datos: SubirDocumentoRequest): Observable<{ documentoId: string; gcsUri: string }> {
    const { archivo } = datos;
    return this.http
      .post<{ uploadUrl: string; gcsUri: string; contentType: string }>(`${this.base}/solicitar-subida`, {
        tipo: datos.tipo,
        nombreArchivo: archivo.name,
        contentType: archivo.type
      })
      .pipe(
        switchMap((subida) =>
          this.http.put<void>(subida.uploadUrl, archivo, { headers: { 'Content-Type': archivo.type } }).pipe(
            switchMap(() => from(sha256Hex(archivo))),
            switchMap((hashIntegridad) =>
              this.http.post<{ id: string }>(this.base, {
                tipo: datos.tipo,
                propietarioId: datos.propietarioId,
                entidadRelacionadaTipo: datos.entidadRelacionadaTipo,
                entidadRelacionadaId: datos.entidadRelacionadaId,
                refArchivoFisico: subida.gcsUri,
                hashIntegridad,
                etiqueta: datos.etiqueta,
                // El servidor toma el usuario real de la sesión (X-Motoya-Usuario-Id) y ignora este valor.
                creadoPor: crypto.randomUUID()
              })
            ),
            switchMap((documento) => [{ documentoId: documento.id, gcsUri: subida.gcsUri }])
          )
        )
      );
  }

  /** URL de lectura temporal de un documento registrado (para el visor). */
  urlLectura(documentoId: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.base}/${documentoId}/url`);
  }
}
