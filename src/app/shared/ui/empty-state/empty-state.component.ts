import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'mt-empty-state',
  standalone: true,
  imports: [IconComponent],
  template: `
    <mt-icon [name]="icon()" [size]="36" />
    <h2>{{ title() }}</h2>
    <p>{{ description() }}</p>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      min-height: 240px;
      padding: var(--space-8);
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-lg);
      color: var(--color-text-muted);
      text-align: center;
    }
    h2 {
      font-size: var(--text-base);
      color: var(--color-text);
    }
    p {
      max-width: 320px;
      font-size: var(--text-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  icon = input<string>('inbox');
  title = input.required<string>();
  description = input<string>('');
}
