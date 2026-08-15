import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ResultadoPreCalificacion, RolPersonaPreCalificacion } from './precalificacion.models';

/**
 * Wrapper delgado sobre /partner/riesgo/pre-calificacion (BC-02, motoya-api) — deliberadamente un servicio propio,
 * no un método más de OriginacionApiService: el pre-check pertenece al dominio de riesgo, no al de originación,
 * aunque se dispare desde el wizard de solicitud (ver solicitud.component.ts).
 */
@Injectable({ providedIn: 'root' })
export class PreCalificacionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.gatewayBaseUrl}/partner/riesgo/pre-calificacion`;

  /** Se dispara al obtener el DNI (titular o aval), junto con el lookup de json.pe — antes de que exista la solicitud. */
  evaluar(tipoDocumento: string, numeroDocumento: string, rol: RolPersonaPreCalificacion): Observable<ResultadoPreCalificacion> {
    return this.http.post<ResultadoPreCalificacion>(this.base, { tipoDocumento, numeroDocumento, rol });
  }

  /** Se llama tras crear la Solicitud, para completar el vínculo (ver PreCalificacion.solicitudId en el backend). */
  vincularSolicitud(preCalificacionId: string, solicitudId: string): Observable<ResultadoPreCalificacion> {
    return this.http.put<ResultadoPreCalificacion>(`${this.base}/${preCalificacionId}/vincular-solicitud/${solicitudId}`, {});
  }

  /** Solo aplica a zona AMARILLO — el vendedor eligió "Continuar bajo riesgo" en el modal. */
  continuarBajoRiesgo(preCalificacionId: string): Observable<ResultadoPreCalificacion> {
    return this.http.put<ResultadoPreCalificacion>(`${this.base}/${preCalificacionId}/continuar-bajo-riesgo`, {});
  }
}
