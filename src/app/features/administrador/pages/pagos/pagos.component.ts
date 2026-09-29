import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TesoreriaApiService } from '../../../../core/tesoreria/tesoreria-api.service';
import {
  ESTADO_FACTURA_LEGADO_LABEL,
  EstadoFacturaLegado,
  FacturaLegadoResumen
} from '../../../../core/tesoreria/tesoreria.models';
import { MtDatePipe } from '../../../../shared/pipes/mt-date.pipe';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent, BadgeVariant } from '../../../../shared/ui/badge/badge.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

const ESTADO_FACTURA_LEGADO_VARIANT: Record<EstadoFacturaLegado, BadgeVariant> = {
  PAGADA: 'success',
  PENDIENTE: 'warning',
  SIN_REGISTRO: 'neutral'
};

/**
 * Los **contratos anteriores** de la tienda y cómo van sus pagos (los migrados del sistema legacy, que no tienen
 * cronograma del motor nuevo).
 *
 * <p>Acá se veían además las órdenes de pago del circuito viejo —el <i>pass-through</i> de la cuota inicial y el
 * «desembolso» del capital—, que se retiraron con la pieza 5 de la fase D (2026-09-28): la inicial la cobra la
 * tienda directo al cliente y el saldo es una **obligación** de Contabilidad, que hoy no tiene pantalla de la
 * tienda (vive en el calendario de pagos de Finanzas). Cuando la tienda tenga que verla, esa pantalla se
 * construye contra la obligación, no contra estas órdenes.
 */
@Component({
  standalone: true,
  imports: [PageHeaderComponent, AlertComponent, CardComponent, BadgeComponent, MtDatePipe],
  templateUrl: './pagos.component.html',
  styleUrl: './pagos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PagosComponent {
  private readonly api = inject(TesoreriaApiService);

  protected readonly facturasLegado = signal<FacturaLegadoResumen[]>([]);
  protected readonly loadingLegado = signal(true);
  protected readonly errorLegado = signal<string | null>(null);

  protected readonly estadoLegadoLabel = ESTADO_FACTURA_LEGADO_LABEL;
  protected readonly estadoLegadoVariant = ESTADO_FACTURA_LEGADO_VARIANT;

  constructor() {
    this.cargarLegado();
  }

  // Contratos migrados del sistema legacy (motorCalculo=LEGACY_TASA_FIJA_MIGRADO): se consultan aparte y en vivo
  // contra Firestore.
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
