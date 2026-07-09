import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/**
 * Página de relleno para rutas del menú que todavía no tienen feature
 * implementada — evita links muertos mientras se construye módulo por módulo.
 */
@Component({
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="mt-placeholder">
      <mt-icon name="construction" [size]="40" />
      <h2>Módulo en construcción</h2>
      <p>Esta sección todavía no está implementada — vuelve pronto.</p>
    </div>
  `,
  styles: `
    .mt-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      min-height: 320px;
      color: var(--color-text-muted);
      text-align: center;
    }
    h2 {
      font-size: var(--text-lg);
      color: var(--color-text);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaceholderPageComponent {}
