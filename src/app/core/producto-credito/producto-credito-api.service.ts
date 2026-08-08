import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CotizacionCreditoResponse, DatosCotizacionRequest, ProductoCreditoInfo } from './producto-credito.models';

/**
 * Único producto crediticio activo hoy (BC-07) — se manda explícito en vez de
 * confiar en el fallback "sin código, usa el único vigente" de motoya-api: ese
 * fallback es ambiguo en bases con más de un producto vigente (ej. datos de
 * prueba de otras sesiones), mandar el código siempre es determinista.
 */
export const CODIGO_PRODUCTO_CREDITO_DEFAULT = 'CREDITO-MOTO-2026';

/** Wrapper delgado sobre /partner/producto/cotizacion (BC-07, motoya-api). */
@Injectable({ providedIn: 'root' })
export class ProductoCreditoApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.gatewayBaseUrl}/partner/producto/cotizacion`;
  private readonly baseInfo = `${environment.gatewayBaseUrl}/partner/producto/vigente`;

  cotizar(datos: DatosCotizacionRequest): Observable<CotizacionCreditoResponse> {
    return this.http.post<CotizacionCreditoResponse>(this.base, datos);
  }

  /** Solo lectura — límites del producto vigente, para mostrarlos como guía antes de cotizar. */
  obtenerVigente(codigo: string): Observable<ProductoCreditoInfo> {
    return this.http.get<ProductoCreditoInfo>(this.baseInfo, { params: new HttpParams().set('codigo', codigo) });
  }
}
