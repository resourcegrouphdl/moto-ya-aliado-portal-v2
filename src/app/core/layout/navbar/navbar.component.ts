import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ETIQUETA_ROL } from '../../nav/nav-data';

@Component({
  selector: 'mt-navbar',
  standalone: true,
  imports: [],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent {
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);

  protected readonly rolLabel = computed(() => {
    const rol = this.authService.rol();
    return rol ? ETIQUETA_ROL[rol] : '';
  });

  logout(): void {
    this.authService.logout().subscribe(() => this.router.navigateByUrl('/auth/login'));
  }
}
