import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { VARIANT_ICON, Variant } from '../variant';

export type AlertVariant = Variant;

@Component({
  selector: 'mt-alert',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    '[class]': 'hostClass()'
  }
})
export class AlertComponent {
  variant = input<AlertVariant>('info');
  title = input<string>();
  dismissible = input(false, { transform: booleanAttribute });

  dismissed = output<void>();

  protected icon = computed(() => VARIANT_ICON[this.variant()]);
  protected hostClass = computed(() => `mt-alert mt-alert--${this.variant()}`);
}
