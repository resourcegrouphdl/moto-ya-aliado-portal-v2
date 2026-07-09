import { toSignal } from '@angular/core/rxjs-interop';
import {
  Auth,
  User,
  authState,
  idToken,
  signInWithEmailAndPassword,
  signOut
} from '@angular/fire/auth';
import { Injectable, computed, inject } from '@angular/core';
import { Observable, from, of, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { RolAliado, esRolAliado } from './rol.model';

/**
 * Envuelve Firebase Auth (ADR-005: sigue siendo el IdP) — el gateway nuevo
 * valida el mismo ID token, esto solo maneja la sesión del lado del cliente.
 * Mismo patrón que admin-v2/core/auth/auth.service.ts, con un signal extra
 * (`rol`) para resolver la vista Administrador/Ejecutivo Aliado.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);

  /** undefined = todavía no se resolvió el estado persistido; null = sin sesión. */
  readonly user = toSignal(authState(this.auth), { initialValue: undefined });
  readonly isAuthenticated = computed(() => !!this.user());
  readonly isResolving = computed(() => this.user() === undefined);

  private readonly tokenResult = toSignal(
    idToken(this.auth).pipe(
      switchMap((token) => (token ? from(this.auth.currentUser!.getIdTokenResult()) : of(null)))
    ),
    { initialValue: undefined }
  );

  /** null = sesión resuelta pero sin claim `rol` válido (fail-closed, ver rol.model.ts). */
  readonly rol = computed<RolAliado | null | undefined>(() => {
    const result = this.tokenResult();
    if (result === undefined) return undefined;
    const claim = result?.claims?.['rol'];
    return esRolAliado(claim) ? claim : null;
  });

  readonly displayName = computed(() => {
    const u = this.user();
    return u?.displayName || u?.email?.split('@')[0] || '';
  });

  readonly initials = computed(() => {
    const name = this.displayName();
    if (!name) return '?';
    const parts = name.replace(/[._-]/g, ' ').trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('');
  });

  login(email: string, password: string): Observable<User> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(map((cred) => cred.user));
  }

  logout(): Observable<void> {
    return from(signOut(this.auth));
  }

  /** Token para el header Authorization: Bearer — usado por el interceptor HTTP. */
  getIdToken(forceRefresh = false): Observable<string | null> {
    const current = this.auth.currentUser;
    if (!current) return of(null);
    return from(current.getIdToken(forceRefresh));
  }
}
