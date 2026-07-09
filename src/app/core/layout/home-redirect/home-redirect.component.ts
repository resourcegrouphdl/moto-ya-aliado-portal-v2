import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { RUTA_INICIAL_POR_ROL } from '../../nav/nav-data';

/**
 * Path raíz (`/`) dentro del shell: no hay una sola "home" — cada rol
 * aterriza en su primera pantalla. Sin componente propio no se puede resolver
 * esto con un simple `redirectTo` estático (el rol se resuelve async).
 */
@Component({
  selector: 'mt-home-redirect',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeRedirectComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      const rol = this.authService.rol();
      if (rol === undefined) return;
      this.router.navigateByUrl(rol ? RUTA_INICIAL_POR_ROL[rol] : '/acceso-denegado');
    });
  }
}
