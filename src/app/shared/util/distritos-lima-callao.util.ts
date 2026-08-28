import { SelectOption } from '../ui/select/select.component';

/**
 * Catálogo cerrado de los distritos de Lima Metropolitana + Callao (2026-08-28) — hoy es donde opera el
 * negocio (todos los casos reales vistos hasta ahora son de acá). Existe para dos cosas:
 *
 * 1. Validar lo que sugiere Google Geocoding antes de autocompletar el campo "Distrito" — bug real: Google
 *    a veces devuelve el nombre de un asentamiento humano/urbanización (`sublocality_level_1`, ej. "A.H.
 *    Manzanilla Etapa 2") en vez del distrito real (ej. "Cercado de Lima"). Si el valor sugerido no está acá,
 *    NO se autocompleta — se deja que el vendedor lo elija de la lista, en vez de confiar en texto libre
 *    que nadie revisa después.
 * 2. Reemplazar el `<mt-input>` de texto libre por un `<mt-select>` — mismo criterio que ya usa el resto
 *    del sistema para catálogos cerrados (tipo de documento, relación con el titular, etc.).
 *
 * No es el catálogo completo de los ~1874 distritos del Perú (INEI) -- si el negocio expande fuera de
 * Lima/Callao, este archivo es el punto a extender (o reemplazar por un dataset real de ubigeo).
 */
const DISTRITOS_LIMA = [
  'Ancón', 'Ate', 'Barranco', 'Breña', 'Carabayllo', 'Chaclacayo', 'Chorrillos', 'Cieneguilla', 'Comas',
  'El Agustino', 'Independencia', 'Jesús María', 'La Molina', 'La Victoria', 'Cercado de Lima', 'Lince',
  'Los Olivos', 'Lurigancho (Chosica)', 'Lurín', 'Magdalena del Mar', 'Miraflores', 'Pachacámac', 'Pucusana',
  'Pueblo Libre', 'Puente Piedra', 'Punta Hermosa', 'Punta Negra', 'Rímac', 'San Bartolo', 'San Borja',
  'San Isidro', 'San Juan de Lurigancho', 'San Juan de Miraflores', 'San Luis', 'San Martín de Porres',
  'San Miguel', 'Santa Anita', 'Santa María del Mar', 'Santa Rosa', 'Santiago de Surco', 'Surquillo',
  'Villa El Salvador', 'Villa María del Triunfo'
];

const DISTRITOS_CALLAO = [
  'Callao', 'Bellavista', 'Carmen de la Legua Reynoso', 'La Perla', 'La Punta', 'Mi Perú', 'Ventanilla'
];

export const DISTRITOS_LIMA_CALLAO: readonly string[] = Object.freeze([...DISTRITOS_LIMA, ...DISTRITOS_CALLAO].sort());

/** Comparación insensible a mayúsculas/tildes -- Google a veces manda variantes de capitalización distintas a las de esta lista. */
export function distritoEnCatalogo(nombre: string | null | undefined): boolean {
  if (!nombre) return false;
  const normalizado = normalizarNombre(nombre);
  return DISTRITOS_LIMA_CALLAO.some((d) => normalizarNombre(d) === normalizado);
}

/** Nombre tal cual está en el catálogo (capitalización/tildes correctas) si matchea, o null si no está. */
export function distritoCatalogadoDesde(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  const normalizado = normalizarNombre(nombre);
  return DISTRITOS_LIMA_CALLAO.find((d) => normalizarNombre(d) === normalizado) ?? null;
}

function normalizarNombre(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, ''); // quita tildes (propiedad Unicode "Diacritic", evita depender de un rango de caracteres tipeado a mano) para comparar
}

export const DISTRITO_LIMA_CALLAO_OPTIONS: SelectOption<string>[] = DISTRITOS_LIMA_CALLAO.map((d) => ({ label: d, value: d }));
