import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ETIQUETA_ROL } from '../../nav/nav-data';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { MobileNavService } from '../mobile-nav.service';

@Component({
  selector: 'mt-navbar',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent {
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);
  protected readonly mobileNav = inject(MobileNavService);

  protected readonly rolLabel = computed(() => {
    const rol = this.authService.rol();
    return rol ? ETIQUETA_ROL[rol] : '';
  });

  logout(): void {
    this.authService.logout().subscribe(() => this.router.navigateByUrl('/auth/login'));
  }
}
