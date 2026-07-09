import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

@Component({
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <mt-page-header title="Nueva solicitud" description="Registra una nueva solicitud de crédito para un cliente." />
    <mt-empty-state
      icon="assignment_add"
      title="Formulario pendiente"
      description="El wizard de solicitud (datos, documentos, referencias) se construye una vez definido el contrato con BC-01 Originación."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SolicitudComponent {}
