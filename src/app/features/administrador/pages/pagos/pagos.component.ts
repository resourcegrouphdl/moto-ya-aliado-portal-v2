import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

@Component({
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <mt-page-header title="Pagos" description="Cuotas iniciales y comprobantes registrados por tu tienda." />
    <mt-empty-state
      icon="payments"
      title="Sin pagos todavía"
      description="Esta sección se conectará a motoya-api (BC-05 Tesorería) cuando el endpoint esté disponible."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PagosComponent {}
