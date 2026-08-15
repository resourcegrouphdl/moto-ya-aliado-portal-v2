import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { NAV_SECTIONS_POR_ROL } from '../../nav/nav-data';
import { NavSection } from '../../nav/nav-item.model';
import { MobileNavService } from '../mobile-nav.service';

@Component({
  selector: 'mt-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Solo tiene efecto visual bajo 767px (ver sidebar.component.scss) —
    // en desktop el sidebar ya está siempre visible.
    '[class.mt-sidebar--open]': 'mobileNav.open()'
  }
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  protected readonly mobileNav = inject(MobileNavService);

  protected readonly sections = computed<NavSection[]>(() => {
    const rol = this.authService.rol();
    return rol ? NAV_SECTIONS_POR_ROL[rol] : [];
  });
}
