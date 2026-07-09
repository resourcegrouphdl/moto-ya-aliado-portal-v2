import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

@Component({
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <mt-page-header
      title="Contratos"
      description="Contratos generados por tu tienda: estado de formalización y firma."
    />
    <mt-empty-state
      icon="description"
      title="Sin contratos todavía"
      description="Esta sección se conectará a motoya-api (BC-03 Contratos) cuando el endpoint esté disponible."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContratosComponent {}
