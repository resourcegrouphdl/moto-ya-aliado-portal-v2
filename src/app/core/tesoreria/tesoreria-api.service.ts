import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ComisionResumen, FacturaLegadoResumen, OrdenPagoResumen } from './tesoreria.models';

/**
 * Wrapper sobre /partner/tesoreria (BC-05/BC-06, motoya-api) — órdenes de
 * pago scoped a la tienda de la sesión, comisiones scoped al vendedor de la
 * sesión. El backend nunca recibe un tiendaId/vendedorId explícito.
 */
@Injectable({ providedIn: 'root' })
export class TesoreriaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.gatewayBaseUrl}/partner/tesoreria`;

  ordenesDeMiTienda(): Observable<OrdenPagoResumen[]> {
    return this.http.get<OrdenPagoResumen[]>(`${this.base}/ordenes-pago`);
  }

  misComisiones(): Observable<ComisionResumen[]> {
    return this.http.get<ComisionResumen[]>(`${this.base}/mis-comisiones`);
  }

  facturasLegadoDeMiTienda(): Observable<FacturaLegadoResumen[]> {
    return this.http.get<FacturaLegadoResumen[]>(`${this.base}/facturas-legado`);
  }
}
