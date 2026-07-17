import { Routes } from '@angular/router';
import { authGuard, publicGuard, rolGuard } from './core/auth/auth.guard';
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
        path: 'ejecutivo/clientes',
        canActivate: [rolGuard],
        data: { allowedRoles: ['EJECUTIVO_ALIADO'] },
        loadComponent: () => import('./features/ejecutivo/pages/clientes/clientes.component').then((m) => m.ClientesComponent)
      },
      {
        path: 'ejecutivo/solicitud',
        canActivate: [rolGuard],
        data: { allowedRoles: ['EJECUTIVO_ALIADO'] },
        loadComponent: () =>
          import('./features/ejecutivo/pages/solicitud/solicitud.component').then((m) => m.SolicitudComponent)
      },
      {
        path: 'ejecutivo/calculadora',
        canActivate: [rolGuard],
        data: { allowedRoles: ['EJECUTIVO_ALIADO'] },
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
