import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { NAV_SECTIONS_POR_ROL } from '../../nav/nav-data';
import { NavSection } from '../../nav/nav-item.model';

@Component({
  selector: 'mt-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);

  protected readonly sections = computed<NavSection[]>(() => {
    const rol = this.authService.rol();
    return rol ? NAV_SECTIONS_POR_ROL[rol] : [];
  });
}
