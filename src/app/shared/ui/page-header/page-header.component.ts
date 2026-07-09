import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'mt-page-header',
  standalone: true,
  template: `
    <h1>{{ title() }}</h1>
    <p>{{ description() }}</p>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: var(--space-6);
    }
    h1 {
      font-size: var(--text-xl);
      color: var(--color-text);
    }
    p {
      margin-top: var(--space-1);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageHeaderComponent {
  title = input.required<string>();
  description = input<string>('');
}
