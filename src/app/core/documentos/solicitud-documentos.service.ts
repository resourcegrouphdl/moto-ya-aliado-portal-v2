import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { OriginacionApiService } from '../originacion/originacion-api.service';
import { DocumentoSolicitudResponse, RolPersonaSolicitud, TipoDocumentoSolicitud } from '../originacion/originacion.models';

/**
 * Los documentos de una solicitud de crédito (DEC-057/DEC-130): se suben por Document Management —con su dueño (el cliente: titular o aval),
 * la solicitud a la que están ligados, su hash y quién los subió— y la solicitud guarda solo su `documentoId` y la revisión.
 *
 * <p>El portal del aliado **no llama a Document Management directo**: el gateway le cierra `/api/operaciones/**` (pool `tienda`) y abrirlo dejaría a
 * un usuario de tienda registrar o leer documentos ajenos. Todo pasa por `motoya-api`, que comprueba que la solicitud sea de su tienda (o creada por
 * él), resuelve el tipo y el dueño en el servidor y habla con Document Management. El binario sí sube directo al bucket con una URL firmada.
 * Los pasos viven aquí para que ninguna pantalla los repita ni se salte alguno.
 */
@Injectable({ providedIn: 'root' })
export class SolicitudDocumentosService {
  private readonly http = inject(HttpClient);
  private readonly originacion = inject(OriginacionApiService);

  /** Sube el archivo a Document Management y lo registra en el slot de la solicitud. */
  subirYRegistrar(
    solicitudId: string,
    rol: RolPersonaSolicitud,
    tipo: TipoDocumentoSolicitud,
    archivo: File,
    etiqueta: string
  ): Observable<DocumentoSolicitudResponse> {
    return this.subir(solicitudId, rol, tipo, archivo, etiqueta).pipe(
      switchMap((documentoId) => this.originacion.registrarDocumento(solicitudId, { rol, tipo, documentoId }))
    );
  }

  /** Sustituye el archivo de un documento rechazado u observado por otro, también por Document Management. */
  subirYReemplazar(
    solicitudId: string,
    documento: DocumentoSolicitudResponse,
    archivo: File,
    etiqueta: string
  ): Observable<DocumentoSolicitudResponse> {
    return this.subir(solicitudId, documento.rol, documento.tipo, archivo, etiqueta).pipe(
      switchMap((documentoId) => this.originacion.reemplazarDocumentoPorDm(solicitudId, documento.id, documentoId))
    );
  }

  /** La URL para ver el archivo: la de lectura temporal de Document Management, o la de siempre en un documento anterior. */
  urlDe(solicitudId: string, documento: DocumentoSolicitudResponse): Observable<string | null> {
    if (documento.documentoId) {
      return this.originacion.urlLecturaDocumento(solicitudId, documento.id).pipe(map(({ url }) => url));
    }
    return of(documento.url);
  }

  /** URL firmada → PUT directo al bucket → registro del archivo en Document Management; devuelve el id del Documento. */
  private subir(solicitudId: string, rol: RolPersonaSolicitud, tipo: TipoDocumentoSolicitud, archivo: File, etiqueta: string): Observable<string> {
    return this.originacion.solicitarSubidaDocumentoDm(solicitudId, tipo, archivo.name, archivo.type).pipe(
      switchMap((subida) =>
        this.http.put<void>(subida.uploadUrl, archivo, { headers: { 'Content-Type': archivo.type } }).pipe(
          switchMap(() => this.originacion.registrarSubidoDm(solicitudId, { rol, tipo, gcsUri: subida.gcsUri, etiqueta: etiqueta.slice(0, 60) })),
          map(({ documentoId }) => documentoId)
        )
      )
    );
  }
}
