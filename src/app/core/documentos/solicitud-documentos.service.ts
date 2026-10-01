import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { OriginacionApiService } from '../originacion/originacion-api.service';
import { DocumentoSolicitudResponse, RolPersonaSolicitud, TipoDocumentoSolicitud } from '../originacion/originacion.models';
import { DocumentosApiService, TipoDocumentoDm } from './documentos-api.service';

/** A qué está ligado en Document Management todo documento de una solicitud (DEC-130). */
export const ENTIDAD_SOLICITUD = 'SOLICITUD_CREDITO';

/**
 * El tipo del catálogo cerrado de Document Management de cada slot de la solicitud. El frente y el reverso del documento de identidad
 * son el mismo tipo (`DNI`, con su etiqueta); el servidor acepta también `CARNE_EXTRANJERIA` para quien lo tenga.
 */
export const TIPO_DM_DE_SOLICITUD: Record<TipoDocumentoSolicitud, TipoDocumentoDm> = {
  DNI_FRENTE: 'DNI',
  DNI_REVERSO: 'DNI',
  LICENCIA_FRENTE: 'LICENCIA_CONDUCIR',
  LICENCIA_REVERSO: 'LICENCIA_CONDUCIR',
  SELFIE: 'SELFIE',
  CERTIFICADO_LABORAL: 'CERTIFICADO_LABORAL',
  RECIBO_SERVICIO: 'RECIBO_SERVICIO',
  FACHADA: 'FACHADA_DOMICILIO',
  OTRO_1: 'OTRO_SOLICITUD',
  OTRO_2: 'OTRO_SOLICITUD'
};

/**
 * Los documentos de una solicitud de crédito (DEC-057/DEC-130): se suben por Document Management —con su dueño (el cliente: titular o aval),
 * la solicitud a la que están ligados, su hash y quién los subió— y la solicitud guarda solo su `documentoId` y la revisión. Los pasos
 * viven aquí para que ninguna pantalla los repita ni se salte alguno.
 */
@Injectable({ providedIn: 'root' })
export class SolicitudDocumentosService {
  private readonly dm = inject(DocumentosApiService);
  private readonly originacion = inject(OriginacionApiService);

  /** Sube el archivo a Document Management y lo registra en el slot de la solicitud. */
  subirYRegistrar(
    solicitudId: string,
    propietarioId: string,
    rol: RolPersonaSolicitud,
    tipo: TipoDocumentoSolicitud,
    archivo: File,
    etiqueta: string
  ): Observable<DocumentoSolicitudResponse> {
    return this.subir(solicitudId, propietarioId, tipo, archivo, etiqueta).pipe(
      switchMap(({ documentoId }) => this.originacion.registrarDocumento(solicitudId, { rol, tipo, documentoId }))
    );
  }

  /** Sustituye el archivo de un documento rechazado u observado por otro, también por Document Management. */
  subirYReemplazar(
    solicitudId: string,
    propietarioId: string,
    documento: DocumentoSolicitudResponse,
    archivo: File,
    etiqueta: string
  ): Observable<DocumentoSolicitudResponse> {
    return this.subir(solicitudId, propietarioId, documento.tipo, archivo, etiqueta).pipe(
      switchMap(({ documentoId }) => this.originacion.reemplazarDocumentoPorDm(solicitudId, documento.id, documentoId))
    );
  }

  /** La URL para ver el archivo: la de lectura temporal de Document Management, o la de siempre en un documento anterior. */
  urlDe(documento: DocumentoSolicitudResponse): Observable<string | null> {
    if (documento.documentoId) {
      return this.dm.urlLectura(documento.documentoId).pipe(map(({ url }) => url));
    }
    return of(documento.url);
  }

  private subir(solicitudId: string, propietarioId: string, tipo: TipoDocumentoSolicitud, archivo: File, etiqueta: string) {
    return this.dm.subir({
      tipo: TIPO_DM_DE_SOLICITUD[tipo],
      archivo,
      propietarioId,
      entidadRelacionadaTipo: ENTIDAD_SOLICITUD,
      entidadRelacionadaId: solicitudId,
      etiqueta: etiqueta.slice(0, 60)
    });
  }
}
