/**
 * Catálogo de ubigeo (INEI) — 25 departamentos, 196 provincias y 1892 distritos. Lo sirve `motoya-api` en
 * `GET /public/ubigeo` (DEC-029): una sola fuente de verdad para las dos apps, en lugar del listado de
 * Lima+Callao que estaba copiado en cada una.
 */
import { AbstractControl, ValidationErrors } from '@angular/forms';

export interface DistritoUbigeo {
  codigo: string;
  nombre: string;
}

export interface ProvinciaUbigeo {
  codigo: string;
  nombre: string;
  distritos: DistritoUbigeo[];
}

export interface DepartamentoUbigeo {
  codigo: string;
  nombre: string;
  provincias: ProvinciaUbigeo[];
}

export interface CatalogoUbigeo {
  departamentos: DepartamentoUbigeo[];
}

/**
 * Lo que guarda la dirección de un cliente: los tres nombres del catálogo + el código del distrito. `codigo` es
 * null cuando la ubicación es "vieja" (texto libre de antes de la cascada, o de un flujo que todavía no la usa).
 */
export interface UbicacionSeleccionada {
  ubigeoDistrito: string | null;
  departamento: string;
  provincia: string;
  distrito: string;
}

/** La misma ubicación pero con los códigos de los tres niveles — es lo que devuelve resolverla contra el catálogo. */
export interface UbicacionResuelta extends UbicacionSeleccionada {
  codigoDepartamento: string;
  codigoProvincia: string;
}

/**
 * Valor inicial del control de ubicación. Se usa un objeto vacío (y no `null`) porque los formularios del wizard
 * son `nonNullable`, y hace falta un validador propio: `Validators.required` da por bueno cualquier objeto.
 */
export const UBICACION_VACIA: UbicacionSeleccionada = {
  ubigeoDistrito: null,
  departamento: '',
  provincia: '',
  distrito: ''
};

/** La ubicación está completa cuando hay distrito del catálogo (los tres nombres vienen con él). */
export function ubicacionCompleta(ubicacion: UbicacionSeleccionada | null | undefined): boolean {
  return !!ubicacion?.ubigeoDistrito;
}

/** `Validators.required` no sirve acá: cualquier objeto — incluso vacío — cuenta como "hay valor". */
export function ubicacionRequerida(control: AbstractControl): ValidationErrors | null {
  return ubicacionCompleta(control.value as UbicacionSeleccionada) ? null : { ubicacionRequerida: true };
}
