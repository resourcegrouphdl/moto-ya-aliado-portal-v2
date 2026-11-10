import { Routes } from '@angular/router';
import { authGuard, publicGuard, rolGuard } from './core/auth/auth.guard';
import { ROLES_VENDEDOR } from './core/auth/rol.model';
import { ShellComponent } from './core/layout/shell/shell.component';
import { HomeRedirectComponent } from './core/layout/home-redirect/home-redirect.component';

export const routes: Routes = [
  {
    path: 'auth/login',
    canActivate: [publicGuard],
    loadComponent: () => import('./features/auth/pages/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'acceso-denegado',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/acceso-denegado/acceso-denegado.component').then((m) => m.AccesoDenegadoComponent)
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', component: HomeRedirectComponent },
      {
        path: 'administrador/clientes',
        canActivate: [rolGuard],
        data: { allowedRoles: ['ADMINISTRADOR_ALIADO'] },
        loadComponent: () =>
          import('./features/administrador/pages/clientes/clientes.component').then((m) => m.ClientesComponent)
      },
      {
        path: 'administrador/contratos',
        canActivate: [rolGuard],
        data: { allowedRoles: ['ADMINISTRADOR_ALIADO'] },
        loadComponent: () =>
          import('./features/administrador/pages/contratos/contratos.component').then((m) => m.ContratosComponent)
      },
      {
        path: 'administrador/contratos/:id',
        canActivate: [rolGuard],
        data: { allowedRoles: ['ADMINISTRADOR_ALIADO'] },
        loadComponent: () =>
          import('./features/administrador/pages/contratos/contrato-detalle.component').then((m) => m.ContratoDetalleComponent)
      },
      {
        path: 'administrador/pagos',
        canActivate: [rolGuard],
        data: { allowedRoles: ['ADMINISTRADOR_ALIADO'] },
        loadComponent: () => import('./features/administrador/pages/pagos/pagos.component').then((m) => m.PagosComponent)
      },
      {
        path: 'administrador/solicitud/:id',
        canActivate: [rolGuard],
        data: { allowedRoles: ['ADMINISTRADOR_ALIADO'] },
        loadComponent: () =>
          import('./features/ejecutivo/pages/solicitud-detail/solicitud-detail.component').then((m) => m.SolicitudDetailComponent)
      },
      {
        path: 'ejecutivo/clientes',
        canActivate: [rolGuard],
        data: { allowedRoles: ROLES_VENDEDOR },
        loadComponent: () => import('./features/ejecutivo/pages/clientes/clientes.component').then((m) => m.ClientesComponent)
      },
      {
        path: 'ejecutivo/solicitud',
        canActivate: [rolGuard],
        data: { allowedRoles: ROLES_VENDEDOR },
        loadComponent: () =>
          import('./features/ejecutivo/pages/solicitud/solicitud.component').then((m) => m.SolicitudComponent)
      },
      {
        path: 'ejecutivo/solicitud/:id/continuar',
        canActivate: [rolGuard],
        data: { allowedRoles: ROLES_VENDEDOR },
        loadComponent: () =>
          import('./features/ejecutivo/pages/solicitud/solicitud.component').then((m) => m.SolicitudComponent)
      },
      {
        path: 'ejecutivo/solicitud/:id',
        canActivate: [rolGuard],
        data: { allowedRoles: ROLES_VENDEDOR },
        loadComponent: () =>
          import('./features/ejecutivo/pages/solicitud-detail/solicitud-detail.component').then((m) => m.SolicitudDetailComponent)
      },
      {
        // SOAT al contado y a crédito (DEC-199/200): captar, seguir y cobrar. El servidor decide qué ve cada quien.
        path: 'ejecutivo/soat',
        canActivate: [rolGuard],
        data: { allowedRoles: ROLES_VENDEDOR },
        loadComponent: () => import('./features/ejecutivo/pages/soat/soat-lista.component').then((m) => m.SoatListaComponent)
      },
      {
        // Mis clientes: la cartera SOAT del vendedor y su comisión. Antes de ':id' para que 'clientes' no se lea como un id.
        path: 'ejecutivo/soat/clientes',
        canActivate: [rolGuard],
        data: { allowedRoles: ROLES_VENDEDOR },
        loadComponent: () => import('./features/ejecutivo/pages/soat/soat-clientes.component').then((m) => m.SoatClientesComponent)
      },
      {
        path: 'ejecutivo/soat/nuevo',
        canActivate: [rolGuard],
        data: { allowedRoles: ROLES_VENDEDOR },
        loadComponent: () => import('./features/ejecutivo/pages/soat/soat-nuevo.component').then((m) => m.SoatNuevoComponent)
      },
      {
        path: 'ejecutivo/soat/:id',
        canActivate: [rolGuard],
        data: { allowedRoles: ROLES_VENDEDOR },
        loadComponent: () => import('./features/ejecutivo/pages/soat/soat-detalle.component').then((m) => m.SoatDetalleComponent)
      },
      {
        path: 'ejecutivo/calculadora',
        canActivate: [rolGuard],
        data: { allowedRoles: ROLES_VENDEDOR },
        loadComponent: () =>
          import('./features/ejecutivo/pages/calculadora/calculadora.component').then((m) => m.CalculadoraComponent)
      },
      {
        path: 'ejecutivo/comisiones',
        canActivate: [rolGuard],
        data: { allowedRoles: ['EJECUTIVO_ALIADO'] },
        loadComponent: () =>
          import('./features/ejecutivo/pages/comisiones/comisiones.component').then((m) => m.ComisionesComponent)
      },
      {
        path: '**',
        loadComponent: () =>
          import('./core/layout/placeholder/placeholder-page.component').then((m) => m.PlaceholderPageComponent)
      }
    ]
  }
];
