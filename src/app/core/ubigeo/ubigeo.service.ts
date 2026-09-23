import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SelectOption } from '../../shared/ui/select/select.component';
import {
  CatalogoUbigeo,
  DepartamentoUbigeo,
  ProvinciaUbigeo,
  UbicacionResuelta,
  UbicacionSeleccionada
} from './ubigeo.models';

/**
 * Catálogo de ubigeo del backend, pedido una sola vez por sesión y compartido por toda la app (los ~67 KB se
 * cachean en memoria; el backend además los sirve con `Cache-Control` de un día, ver `UbigeoController`).
 *
 * Los helpers de búsqueda son funciones puras sobre el catálogo ya cargado: la cascada
 * departamento → provincia → distrito y el filtrado del selector no vuelven a pedir nada al servidor.
 */
@Injectable({ providedIn: 'root' })
export class UbigeoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.gatewayBaseUrl}/public/ubigeo`;

  private catalogo$?: Observable<CatalogoUbigeo>;

  /** Si la primera carga falla, no deja el error cacheado: la próxima pantalla vuelve a intentar. */
  catalogo(): Observable<CatalogoUbigeo> {
    if (!this.catalogo$) {
      this.catalogo$ = this.http.get<CatalogoUbigeo>(this.base).pipe(
        shareReplay(1),
        catchError((error: unknown) => {
          this.catalogo$ = undefined;
          return throwError(() => error);
        })
      );
    }
    return this.catalogo$;
  }
}

/** Opciones de departamento (todas, sin filtrar). */
export function opcionesDepartamento(catalogo: CatalogoUbigeo | null): SelectOption<string>[] {
  return (catalogo?.departamentos ?? []).map((d) => ({ label: d.nombre, value: d.codigo }));
}

/** Provincias del departamento elegido — vacío mientras no haya ninguno. */
export function opcionesProvincia(catalogo: CatalogoUbigeo | null, codigoDepartamento: string | null): SelectOption<string>[] {
  const departamento = buscarDepartamento(catalogo, codigoDepartamento);
  return (departamento?.provincias ?? []).map((p) => ({ label: p.nombre, value: p.codigo }));
}

/** Distritos de la provincia elegida — vacío mientras no haya ninguna. */
export function opcionesDistrito(catalogo: CatalogoUbigeo | null, codigoProvincia: string | null): SelectOption<string>[] {
  const provincia = buscarProvincia(catalogo, codigoProvincia);
  return (provincia?.distritos ?? []).map((d) => ({ label: d.nombre, value: d.codigo }));
}

export function buscarDepartamento(catalogo: CatalogoUbigeo | null, codigo: string | null): DepartamentoUbigeo | null {
  if (!catalogo || !codigo) return null;
  return catalogo.departamentos.find((d) => d.codigo === codigo) ?? null;
}

export function buscarProvincia(catalogo: CatalogoUbigeo | null, codigo: string | null): ProvinciaUbigeo | null {
  if (!catalogo || !codigo) return null;
  for (const departamento of catalogo.departamentos) {
    const provincia = departamento.provincias.find((p) => p.codigo === codigo);
    if (provincia) return provincia;
  }
  return null;
}

/** Ubicación completa a partir del código de 6 dígitos del distrito (lo que devuelve el backend en el cliente). */
export function ubicacionPorCodigoDistrito(
  catalogo: CatalogoUbigeo | null,
  codigoDistrito: string | null
): UbicacionResuelta | null {
  if (!catalogo || !codigoDistrito) return null;
  for (const departamento of catalogo.departamentos) {
    for (const provincia of departamento.provincias) {
      const distrito = provincia.distritos.find((d) => d.codigo === codigoDistrito);
      if (distrito) {
        return {
          ubigeoDistrito: distrito.codigo,
          codigoDepartamento: departamento.codigo,
          codigoProvincia: provincia.codigo,
          departamento: departamento.nombre,
          provincia: provincia.nombre,
          distrito: distrito.nombre
        };
      }
    }
  }
  return null;
}

/**
 * Ubicación a partir de los NOMBRES guardados — es el camino de las direcciones viejas (capturadas antes de la
 * cascada, con los nombres que devolvía Google o escritos a mano). Se compara ignorando mayúsculas y tildes, y
 * con un mapa chico de alias para los pocos nombres que Google usa distinto que el INEI (`Cercado de Lima` →
 * `LIMA`, `Lurigancho (Chosica)` → `LURIGANCHO`).
 *
 * Devuelve null cuando no se puede resolver (p. ej. `A.H. Manzanilla Etapa 2`, el caso real del bug de 2026-08-28):
 * ahí el nombre que hay guardado no es un distrito del catálogo, así que la ubicación se muestra como "de antes"
 * y se elige de nuevo.
 */
export function ubicacionPorNombres(
  catalogo: CatalogoUbigeo | null,
  departamento: string | null,
  provincia: string | null,
  distrito: string | null
): UbicacionResuelta | null {
  if (!catalogo || !distrito?.trim()) return null;

  const nombreDistrito = normalizarNombre(distrito);
  const nombreProvincia = normalizarNombre(provincia ?? '');
  const nombreDepartamento = normalizarNombre(departamento ?? '');

  const codigoAlias = ALIAS_DISTRITO_A_UBIGEO[nombreDistrito];
  if (codigoAlias) {
    return ubicacionPorCodigoDistrito(catalogo, codigoAlias);
  }

  // Camino principal: los tres nombres coinciden (ignorando tildes/mayúsculas).
  for (const dep of catalogo.departamentos) {
    if (nombreDepartamento && normalizarNombre(dep.nombre) !== nombreDepartamento) continue;
    for (const prov of dep.provincias) {
      if (nombreProvincia && normalizarNombre(prov.nombre) !== nombreProvincia) continue;
      const dist = prov.distritos.find((d) => normalizarNombre(d.nombre) === nombreDistrito);
      if (dist) {
        return {
          ubigeoDistrito: dist.codigo,
          codigoDepartamento: dep.codigo,
          codigoProvincia: prov.codigo,
          departamento: dep.nombre,
          provincia: prov.nombre,
          distrito: dist.nombre
        };
      }
    }
  }

  // Camino de respaldo: el departamento no vino (o vino distinto), pero provincia + distrito son únicos.
  if (nombreProvincia) {
    for (const dep of catalogo.departamentos) {
      for (const prov of dep.provincias) {
        if (normalizarNombre(prov.nombre) !== nombreProvincia) continue;
        const dist = prov.distritos.find((d) => normalizarNombre(d.nombre) === nombreDistrito);
        if (dist) {
          return {
            ubigeoDistrito: dist.codigo,
            codigoDepartamento: dep.codigo,
            codigoProvincia: prov.codigo,
            departamento: dep.nombre,
            provincia: prov.nombre,
            distrito: dist.nombre
          };
        }
      }
    }
  }
  return null;
}

/** Código del departamento por nombre (tolerante a tildes, mayúsculas y espacios). */
export function codigoDepartamentoPorNombre(catalogo: CatalogoUbigeo | null, nombre: string | null): string | null {
  if (!catalogo || !nombre?.trim()) return null;
  const buscado = normalizarNombre(nombre);
  return catalogo.departamentos.find((d) => normalizarNombre(d.nombre) === buscado)?.codigo ?? null;
}

/** Código de la provincia por nombre, dentro de un departamento. */
export function codigoProvinciaPorNombre(
  catalogo: CatalogoUbigeo | null,
  codigoDepartamento: string | null,
  nombre: string | null
): string | null {
  const departamento = buscarDepartamento(catalogo, codigoDepartamento);
  if (!departamento || !nombre?.trim()) return null;
  const buscado = normalizarNombre(nombre);
  return departamento.provincias.find((p) => normalizarNombre(p.nombre) === buscado)?.codigo ?? null;
}

/** `Jesús María` y `JESUS MARIA` son el mismo distrito: se compara sin tildes, sin mayúsculas y sin espacios de más. */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Nombres que NO son del catálogo pero aparecen en direcciones ya guardadas (los devuelve Google): Google llama
 * `Cercado de Lima` al distrito `LIMA` y `Lurigancho (Chosica)` al `LURIGANCHO`. Sin este mapa, esas direcciones
 * se verían como "no está en el catálogo" y habría que volver a elegirlas a mano.
 */
const ALIAS_DISTRITO_A_UBIGEO: Record<string, string> = {
  'CERCADO DE LIMA': '150101',
  'LURIGANCHO (CHOSICA)': '150118',
  'LURIGANCHO CHOSICA': '150118',
  'LURIGANCHO-CHOSICA': '150118'
};
