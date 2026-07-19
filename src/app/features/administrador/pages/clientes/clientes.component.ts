import { MtDatePipe } from '../../../../shared/pipes/mt-date.pipe';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { OriginacionApiService } from '../../../../core/originacion/originacion-api.service';
import { EstadoSolicitud, SolicitudResumen } from '../../../../core/originacion/originacion.models';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent, BadgeVariant } from '../../../../shared/ui/badge/badge.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

const ESTADO_LABEL: Record<EstadoSolicitud, string> = {
  BORRADOR: 'Borrador',
  INCOMPLETA: 'Incompleta',
  COMPLETA: 'Completa',
  EN_EVALUACION: 'En evaluación',
  CERRADA: 'Cerrada',
  DESISTIDA: 'Desistida',
  VENCIDA: 'Vencida'
};

const ESTADO_VARIANT: Record<EstadoSolicitud, BadgeVariant> = {
  BORRADOR: 'neutral',
  INCOMPLETA: 'warning',
  COMPLETA: 'info',
  EN_EVALUACION: 'warning',
  CERRADA: 'success',
  DESISTIDA: 'error',
  VENCIDA: 'error'
};

/**
 * "Clientes de la tienda" — control administrativo del administrador de
 * aliado sobre lo que registraron TODOS los vendedores de su tienda (BC-01,
 * GET /partner/originacion/solicitudes/clientes-tienda, filtrado server-side
 * por sesion.tiendaId()). Mismo alcance deliberado que la vista del
 * ejecutivo (features/ejecutivo/pages/clientes): solo lectura, sin
 * búsqueda/filtro/paginación todavía.
 */
@Component({
  selector: 'mt-clientes-tienda-page',
  standalone: true,
  imports: [MtDatePipe, AlertComponent, BadgeComponent, CardComponent, EmptyStateComponent, PageHeaderComponent],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientesComponent {
  private readonly api = inject(OriginacionApiService);

  protected readonly clientes = signal<SolicitudResumen[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly estadoLabel = ESTADO_LABEL;
  protected readonly estadoVariant = ESTADO_VARIANT;

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listarClientesTienda().subscribe({
      next: (clientes) => {
        this.clientes.set(clientes);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo cargar la lista de clientes de la tienda.');
      }
    });
  }
}
