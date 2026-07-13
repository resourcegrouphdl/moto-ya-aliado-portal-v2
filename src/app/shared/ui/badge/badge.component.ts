import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'info';

@Component({
  selector: 'mt-badge',
  standalone: true,
  template: `
    <span [class]="classes()">
      <span class="mt-badge__dot" aria-hidden="true"></span>
      <ng-content />
    </span>
  `,
  styleUrl: './badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BadgeComponent {
  variant = input<BadgeVariant>('neutral');

  protected classes = computed(() => `mt-badge mt-badge--${this.variant()}`);
}
