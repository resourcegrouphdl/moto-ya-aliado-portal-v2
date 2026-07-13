import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';

@Component({
  selector: 'mt-card',
  standalone: true,
  template: `
    <ng-content select="[card-header]" />
    <div class="mt-card__body"><ng-content /></div>
    <ng-content select="[card-footer]" />
  `,
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()'
  }
})
export class CardComponent {
  /** Ligera elevación al hover — usar solo si la card entera es clicable. */
  hoverable = input(false, { transform: booleanAttribute });
  padded = input(true, { transform: booleanAttribute });

  protected hostClasses = computed(() =>
    [
      'mt-card',
      this.hoverable() ? 'mt-card--hoverable' : '',
      this.padded() ? 'mt-card--padded' : ''
    ]
      .filter(Boolean)
      .join(' ')
  );
}
