import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { RippleDirective } from '../../directives/ripple.directive';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'mt-button',
  standalone: true,
  imports: [RippleDirective],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ButtonComponent {
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input(false, { transform: booleanAttribute });
  loading = input(false, { transform: booleanAttribute });
  /** true si el botón solo contiene un ícono — exige aria-label del consumidor. */
  iconOnly = input(false, { transform: booleanAttribute });
  ariaLabel = input<string>();

  protected isDisabled = computed(() => this.disabled() || this.loading());

  protected hostClasses = computed(() => [
    'mt-button',
    `mt-button--${this.variant()}`,
    `mt-button--${this.size()}`,
    this.iconOnly() ? 'mt-button--icon-only' : '',
    this.loading() ? 'mt-button--loading' : ''
  ].filter(Boolean).join(' '));
}
