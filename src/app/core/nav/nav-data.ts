import { RolAliado } from '../auth/rol.model';
import { NavSection } from './nav-item.model';

/**
 * Un solo proyecto, 2 vistas por rol (motoya-web-publica-spec.md §0/§7) —
 * evitar "vendedor" en cualquier copy visible. Cada usuario solo ve el menú
 * de su propio rol, nunca ambos.
 */
export const NAV_SECTIONS_POR_ROL: Record<RolAliado, NavSection[]> = {
  ADMINISTRADOR_ALIADO: [
    {
      title: 'Aliado Comercial',
      items: [
        { label: 'Clientes', icon: 'group', route: '/administrador/clientes' },
        { label: 'Contratos', icon: 'description', route: '/administrador/contratos' },
        { label: 'Pagos', icon: 'payments', route: '/administrador/pagos' }
      ]
    }
  ],
  // El vendedor libre usa las mismas herramientas que el ejecutivo (sin «Mis comisiones» hasta que exista su liquidación).
  VENDEDOR_LIBRE: [
    {
      title: 'Vendedor libre',
      items: [
        { label: 'Clientes', icon: 'group', route: '/ejecutivo/clientes' },
        { label: 'Nueva solicitud', icon: 'assignment_add', route: '/ejecutivo/solicitud' },
        { label: 'Calculadora', icon: 'calculate', route: '/ejecutivo/calculadora' }
      ]
    }
  ],
  EJECUTIVO_ALIADO: [
    {
      title: 'Aliado Comercial',
      items: [
        { label: 'Clientes', icon: 'group', route: '/ejecutivo/clientes' },
        { label: 'Nueva solicitud', icon: 'assignment_add', route: '/ejecutivo/solicitud' },
        { label: 'Calculadora', icon: 'calculate', route: '/ejecutivo/calculadora' },
        { label: 'Mis comisiones', icon: 'payments', route: '/ejecutivo/comisiones' }
      ]
    }
  ]
};

export const RUTA_INICIAL_POR_ROL: Record<RolAliado, string> = {
  ADMINISTRADOR_ALIADO: '/administrador/contratos',
  EJECUTIVO_ALIADO: '/ejecutivo/clientes',
  VENDEDOR_LIBRE: '/ejecutivo/clientes'
};

export const ETIQUETA_ROL: Record<RolAliado, string> = {
  ADMINISTRADOR_ALIADO: 'Administrador de Aliado',
  EJECUTIVO_ALIADO: 'Ejecutivo Aliado',
  VENDEDOR_LIBRE: 'Vendedor libre'
};
