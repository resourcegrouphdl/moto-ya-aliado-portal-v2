import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TesoreriaApiService } from '../../../../core/tesoreria/tesoreria-api.service';
import {
  ComisionLegadoResumen,
  ComisionResumen,
  ESTADO_COMISION_LABEL,
  ESTADO_COMISION_LEGADO_LABEL,
  EstadoComision,
  EstadoComisionLegado
} from '../../../../core/tesoreria/tesoreria.models';
import { MtDatePipe } from '../../../../shared/pipes/mt-date.pipe';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent, BadgeVariant } from '../../../../shared/ui/badge/badge.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

const ESTADO_VARIANT: Record<EstadoComision, BadgeVariant> = {
  PENDIENTE: 'warning',
  PAGADA: 'success'
};

const ESTADO_LEGADO_VARIANT: Record<EstadoComisionLegado, BadgeVariant> = {
  PENDIENTE: 'warning',
  EN_PROCESO: 'warning',
  PAGADO: 'success'
};

/**
 * Comisión propia por cada contrato TIENDA_ALIADA que este vendedor originó
 * y que llegó a activarse (BC-06, §9.7 — "comisión solo al activarse el
 * contrato"). Scoped a sesion.usuarioId(), solo lectura — marcar como pagada
 * es backoffice de Finanzas.
 */
@Component({
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent, AlertComponent, CardComponent, BadgeComponent, MtDatePipe],
  templateUrl: './comisiones.component.html',
  styleUrl: './comisiones.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComisionesComponent {
  private readonly api = inject(TesoreriaApiService);

  protected readonly comisiones = signal<ComisionResumen[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly comisionesLegado = signal<ComisionLegadoResumen[]>([]);
  protected readonly loadingLegado = signal(true);
  protected readonly errorLegado = signal<string | null>(null);

  protected readonly estadoLabel = ESTADO_COMISION_LABEL;
  protected readonly estadoVariant = ESTADO_VARIANT;

  protected readonly estadoLegadoLabel = ESTADO_COMISION_LEGADO_LABEL;
  protected readonly estadoLegadoVariant = ESTADO_LEGADO_VARIANT;

  constructor() {
    this.cargar();
    this.cargarLegado();
  }

  private cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.misComisiones().subscribe({
      next: (comisiones) => {
        this.comisiones.set(comisiones);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo cargar tus comisiones.');
      }
    });
  }

  // Contratos migrados del sistema legacy (motorCalculo=LEGACY_TASA_FIJA_MIGRADO):
  // la comisión vive en Firestore (finanzas_comisiones), se consulta aparte.
  private cargarLegado(): void {
    this.loadingLegado.set(true);
    this.errorLegado.set(null);
    this.api.misComisionesLegado().subscribe({
      next: (comisiones) => {
        this.comisionesLegado.set(comisiones);
        this.loadingLegado.set(false);
      },
      error: () => {
        this.loadingLegado.set(false);
        this.errorLegado.set('No se pudo cargar tus comisiones de contratos anteriores.');
      }
    });
  }
}
