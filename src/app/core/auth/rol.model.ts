/**
 * Las 2 vistas internas de Aliado Comercial (motoya-web-publica-spec.md §0/§7) —
 * evitar "vendedor" en cualquier copy visible, aunque internamente mapee al rol
 * VENDOR/EJECUTIVO del catálogo de 14 roles (§9.11 del doc maestro).
 *
 * Se resuelve desde el custom claim `rol` del ID token de Firebase. El
 * aprovisionamiento de ese claim (Cloud Function / BC-10 IAM) todavía no
 * existe — hasta entonces, un usuario sin claim se trata como sin acceso
 * (fail-closed), nunca con un rol por defecto asumido.
 */
export type RolAliado = 'ADMINISTRADOR_ALIADO' | 'EJECUTIVO_ALIADO' | 'VENDEDOR_LIBRE';

/**
 * Quienes usan las herramientas de vendedor (asistente de solicitud, calculadora, su cartera): el ejecutivo de una tienda aliada y el
 * vendedor libre (persona sin tienda que refiere clientes a Motoya, rebanada 1). Una sola lista, para no repetirla en cada ruta. El
 * canal, el origen y la sede de lo que registran los decide el servidor por el rol, nunca este portal.
 */
export const ROLES_VENDEDOR: readonly RolAliado[] = ['EJECUTIVO_ALIADO', 'VENDEDOR_LIBRE'];

export function esRolAliado(valor: unknown): valor is RolAliado {
  return valor === 'ADMINISTRADOR_ALIADO' || valor === 'EJECUTIVO_ALIADO' || valor === 'VENDEDOR_LIBRE';
}
