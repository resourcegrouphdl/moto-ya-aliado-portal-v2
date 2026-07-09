import { Auth } from '@angular/fire/auth';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Adjunta el ID token de Firebase como Authorization: Bearer en cada request
 * hacia el gateway — es lo único que FirebaseTokenVerificationWebFilter valida
 * del lado del servidor (Zero Trust, §4/§14 del doc maestro). Idéntico al de
 * admin-v2/core/auth/auth.interceptor.ts.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.gatewayBaseUrl)) {
    return next(req);
  }

  const auth = inject(Auth);
  const current = auth.currentUser;
  if (!current) {
    return next(req);
  }

  return from(current.getIdToken()).pipe(
    switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })))
  );
};
