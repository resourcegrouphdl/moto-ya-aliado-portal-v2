import { DecimalPipe } from '@angular/common';
import { MtDatePipe } from '../../../../shared/pipes/mt-date.pipe';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ContratoApiService } from '../../../../core/contrato/contrato-api.service';
import { BadgeComponent, BadgeVariant } from '../../../../shared/ui/badge/badge.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { ContratoResumen, ESTADO_FORMALIZACION_LABEL } from '../../../../core/contrato/contrato.models';

const ESTADO_BADGE_VARIANT: Record<string, BadgeVariant> = {
  GENERADO: 'neutral',
  PENDIENTE_DOCUMENTOS: 'warning',
  PENDIENTE_FIRMA: 'warning',
  FIRMADO: 'success',
  CANCELADO: 'error'
};

/** administrador/contratos — ya conectado a /partner/contrato/contratos (BC-03), reemplaza el placeholder anterior. */
@Component({
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent, CardComponent, BadgeComponent, IconComponent, MtDatePipe, DecimalPipe],
  templateUrl: './contratos.component.html',
  styleUrl: './contratos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContratosComponent {
  private readonly api = inject(ContratoApiService);
  private readonly router = inject(Router);

  protected readonly estadoLabel = ESTADO_FORMALIZACION_LABEL;
  protected readonly estadoBadgeVariant = ESTADO_BADGE_VARIANT;

  protected readonly contratos = signal<ContratoResumen[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.api.listarDeMiTienda().subscribe({
      next: (lista) => {
        this.contratos.set(lista);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudieron cargar los contratos.');
      }
    });
  }

  verDetalle(contrato: ContratoResumen): void {
    this.router.navigate(['/administrador/contratos', contrato.id]);
  }
}
