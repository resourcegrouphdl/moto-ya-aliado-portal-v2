import { Auth, authState } from '@angular/fire/auth';
import { toObservable } from '@angular/core/rxjs-interop';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { RolAliado } from './rol.model';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    map((user) => (user ? true : router.createUrlTree(['/auth/login'])))
  );
};

/** Evita que un usuario ya logueado vuelva a ver /auth/login. */
export const publicGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    map((user) => (user ? router.createUrlTree(['/']) : true))
  );
};

/**
 * Fail-closed por diseño (ver rol.model.ts): sin claim `rol` válido o con un
 * rol que no está en `route.data.allowedRoles`, se redirige a /acceso-denegado
 * en vez de asumir una vista por defecto.
 */
export const rolGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = route.data['allowedRoles'] as RolAliado[] | undefined;

  return toObservable(authService.rol).pipe(
    filter((rol) => rol !== undefined),
    take(1),
    map((rol) => (rol && (!allowedRoles || allowedRoles.includes(rol)) ? true : router.createUrlTree(['/acceso-denegado'])))
  );
};
