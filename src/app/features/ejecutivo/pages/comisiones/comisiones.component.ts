import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

@Component({
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <mt-page-header title="Mis comisiones" description="Comisiones generadas por contratos activados." />
    <mt-empty-state
      icon="payments"
      title="Sin comisiones todavía"
      description="Esta sección se conectará a motoya-api (BC-06 Red de Tiendas) cuando el endpoint esté disponible."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComisionesComponent {}
