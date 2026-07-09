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
export type RolAliado = 'ADMINISTRADOR_ALIADO' | 'EJECUTIVO_ALIADO';

export function esRolAliado(valor: unknown): valor is RolAliado {
  return valor === 'ADMINISTRADOR_ALIADO' || valor === 'EJECUTIVO_ALIADO';
}
