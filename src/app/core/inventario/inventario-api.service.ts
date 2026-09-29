import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, range } from 'rxjs';
import { concatMap, reduce, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ModeloCatalogo, UnidadDisponible } from './inventario.models';

interface PaginaUnidadesVehiculares {
  contenido: UnidadDisponible[];
  total: number;
}

/**
 * Wrapper delgado sobre /api/operaciones/{modelos,unidades-vehiculares} (api-operaciones) —
 * venta interna (red-comercial-y-rentabilidad.md §10.1, DEC-060/DEC-066): el vendedor libre elige
 * la moto del catálogo/stock de Motoya, nunca de un stock propio (eso es exclusivo de aliados).
 * El gateway solo autoriza estas dos rutas puntuales para el pool `tienda` — el resto de
 * api-operaciones sigue siendo exclusivo de `admin` (ver application.yml del gateway).
 */
@Injectable({ providedIn: 'root' })
export class InventarioApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.gatewayBaseUrl}/api/operaciones`;

  listarModelos(): Observable<ModeloCatalogo[]> {
    return this.http.get<ModeloCatalogo[]>(`${this.base}/modelos`);
  }

  /**
   * Stock de un modelo para el selector (DEC-075): **todas** las páginas —el selector no puede
   * quedarse mostrando la primera y callarse— y sin filtrar por estado, porque las reservadas también
   * se muestran (con su vencimiento) aunque no se puedan elegir. Vendidas y bloqueadas se descartan
   * en la pantalla: no son parte de la decisión.
   */
  listarStock(modeloId: string | null): Observable<UnidadDisponible[]> {
    const tamano = 100;
    const pedir = (page: number) => {
      let params = new HttpParams().set('page', page).set('size', tamano);
      if (modeloId) params = params.set('modeloId', modeloId);
      return this.http.get<PaginaUnidadesVehiculares>(`${this.base}/unidades-vehiculares`, { params });
    };
    return pedir(0).pipe(
      switchMap((primera) => {
        const restantes = Math.max(0, Math.ceil(primera.total / tamano) - 1);
        if (restantes === 0) return of(primera.contenido);
        return range(1, restantes).pipe(
          concatMap((pagina) => pedir(pagina)),
          reduce((acumulado, pagina) => [...acumulado, ...pagina.contenido], primera.contenido)
        );
      })
    );
  }
}
