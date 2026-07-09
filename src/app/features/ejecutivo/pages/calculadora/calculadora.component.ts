import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

@Component({
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <mt-page-header title="Calculadora" description="Cotiza el cronograma de cuotas de un cliente." />
    <mt-empty-state
      icon="calculate"
      title="Simulador pendiente de conexión"
      description="El motor de amortización francesa ya existe en motoya-api (BC-07 Producto Crediticio); falta el endpoint público que este simulador va a consumir."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalculadoraComponent {}
