import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TesoreriaApiService } from '../../../../core/tesoreria/tesoreria-api.service';
import {
  ESTADO_FACTURA_LEGADO_LABEL,
  ESTADO_ORDEN_PAGO_LABEL,
  EstadoFacturaLegado,
  EstadoOrdenPago,
  FacturaLegadoResumen,
  OrdenPagoResumen,
  TIPO_ORDEN_PAGO_LABEL
} from '../../../../core/tesoreria/tesoreria.models';
import { MtDatePipe } from '../../../../shared/pipes/mt-date.pipe';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent, BadgeVariant } from '../../../../shared/ui/badge/badge.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

const ESTADO_VARIANT: Record<EstadoOrdenPago, BadgeVariant> = {
  PENDIENTE: 'neutral',
  APROBADA_1: 'warning',
  APROBADA_2: 'warning',
  AUTORIZADA: 'warning',
  EN_PROCESAMIENTO: 'warning',
  PROCESADA: 'warning',
  CONCILIADA: 'success',
  RECHAZADA: 'error',
  ANULADA: 'error'
};

const ESTADO_FACTURA_LEGADO_VARIANT: Record<EstadoFacturaLegado, BadgeVariant> = {
  PAGADA: 'success',
  PENDIENTE: 'warning',
  SIN_REGISTRO: 'neutral'
};

/**
 * Pagos que Motoya le debe a la tienda por cada contrato TIENDA_ALIADA
 * (BC-05 Tesorería): pass-through de la cuota inicial + desembolso del
 * capital financiado. Solo lectura — aprobar/conciliar es backoffice de
 * Finanzas (admin-v2), no una acción de la tienda.
 */
@Component({
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent, AlertComponent, CardComponent, BadgeComponent, MtDatePipe],
  templateUrl: './pagos.component.html',
  styleUrl: './pagos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PagosComponent {
  private readonly api = inject(TesoreriaApiService);

  protected readonly ordenes = signal<OrdenPagoResumen[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly facturasLegado = signal<FacturaLegadoResumen[]>([]);
  protected readonly loadingLegado = signal(true);
  protected readonly errorLegado = signal<string | null>(null);

  protected readonly tipoLabel = TIPO_ORDEN_PAGO_LABEL;
  protected readonly estadoLabel = ESTADO_ORDEN_PAGO_LABEL;
  protected readonly estadoVariant = ESTADO_VARIANT;

  protected readonly estadoLegadoLabel = ESTADO_FACTURA_LEGADO_LABEL;
  protected readonly estadoLegadoVariant = ESTADO_FACTURA_LEGADO_VARIANT;

  constructor() {
    this.cargar();
    this.cargarLegado();
  }

  private cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.ordenesDeMiTienda().subscribe({
      next: (ordenes) => {
        this.ordenes.set(ordenes);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo cargar los pagos de la tienda.');
      }
    });
  }

  // Contratos migrados del sistema legacy (motorCalculo=LEGACY_TASA_FIJA_MIGRADO):
  // no generan OrdenPago, se consultan aparte y en vivo contra Firestore.
  private cargarLegado(): void {
    this.loadingLegado.set(true);
    this.errorLegado.set(null);
    this.api.facturasLegadoDeMiTienda().subscribe({
      next: (facturas) => {
        this.facturasLegado.set(facturas);
        this.loadingLegado.set(false);
      },
      error: () => {
        this.loadingLegado.set(false);
        this.errorLegado.set('No se pudo cargar las facturas de contratos anteriores.');
      }
    });
  }
}
