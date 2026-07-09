import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

@Component({
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <mt-page-header title="Clientes" description="Leads y solicitudes de crédito que has registrado." />
    <mt-empty-state
      icon="group"
      title="Sin clientes todavía"
      description="Esta sección se conectará a motoya-api (BC-01 Originación) cuando el endpoint esté disponible."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientesComponent {}
