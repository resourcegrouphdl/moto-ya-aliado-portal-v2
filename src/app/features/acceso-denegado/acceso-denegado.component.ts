import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Se llega aquí con sesión de Firebase válida pero sin claim `rol` (o un rol
 * no reconocido) — el aprovisionamiento del claim (BC-10 IAM) todavía no
 * existe, así que hoy cualquier cuenta nueva cae aquí hasta que se le asigne
 * rol manualmente (fail-closed, ver core/auth/rol.model.ts).
 */
@Component({
  standalone: true,
  template: `
    <div class="mt-denied">
      <h1>Sin acceso configurado</h1>
      <p>Tu cuenta no tiene un rol de Aliado Comercial asignado todavía. Contacta a tu administrador.</p>
      <button type="button" (click)="logout()">Cerrar sesión</button>
    </div>
  `,
  styles: `
    .mt-denied {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      min-height: 100dvh;
      padding: var(--space-6);
      text-align: center;
      color: var(--color-text);
    }
    p {
      max-width: 360px;
      color: var(--color-text-muted);
    }
    button {
      margin-top: var(--space-2);
      padding: var(--space-3) var(--space-5);
      border: none;
      border-radius: var(--radius-md);
      background: var(--color-primary);
      color: #fff;
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccesoDenegadoComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.authService.logout().subscribe(() => this.router.navigateByUrl('/auth/login'));
  }
}
