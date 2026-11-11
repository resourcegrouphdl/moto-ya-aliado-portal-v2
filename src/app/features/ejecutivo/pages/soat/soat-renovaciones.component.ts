import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SoatApiService } from '../../../../core/soat/soat-api.service';
import { RenovacionPorHacer, UrgenciaDeRenovacion } from '../../../../core/soat/soat.models';
import { MtDatePipe } from '../../../../shared/pipes/mt-date.pipe';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent, BadgeVariant } from '../../../../shared/ui/badge/badge.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

const URGENCIA: Record<UrgenciaDeRenovacion, { texto: string; variante: BadgeVariant }> = {
  VENCIDA: { texto: 'Vencida', variante: 'error' },
  ESTA_SEMANA: { texto: 'Vence esta semana', variante: 'warning' },
  PROXIMA: { texto: 'Vence en 2 semanas', variante: 'warning' },
  DEL_MES: { texto: 'Vence este mes', variante: 'success' }
};

/**
 * Renovaciones: los clientes cuyo SOAT vence en los próximos 30 días o venció hace menos de 30 y nadie renovó. Es la venta más fácil porque el cliente y la
 * moto ya están registrados: «Renovar» abre un SOAT nuevo con la placa puesta, y el celular permite llamarlo o escribirle.
 */
@Component({
  selector: 'mt-soat-renovaciones-page',
  standalone: true,
  imports: [RouterLink, MtDatePipe, AlertComponent, BadgeComponent, CardComponent, EmptyStateComponent, PageHeaderComponent],
  template: `
    <mt-page-header title="Renovaciones" description="SOAT de tus clientes que vencen pronto. Ofrécele la renovación antes de que su moto circule sin seguro." />

    @let lista = renovaciones();
    @if (error()) {
      <mt-alert variant="error" title="No se pudo cargar">{{ error() }}</mt-alert>
    } @else if (lista) {
      @if (lista.length === 0) {
        <mt-empty-state icon="autorenew" title="No hay renovaciones por hacer" description="Cuando el SOAT de un cliente tuyo esté por vencer, aparecerá aquí." />
      } @else {
        <mt-card [padded]="false">
          <ul class="rn-lista" data-testid="lista-renovaciones">
            @for (r of lista; track r.solicitudId) {
              <li class="rn-item">
                <div class="rn-principal">
                  <strong>{{ r.cliente || r.codigo }} · {{ r.placa }}</strong>
                  <span class="rn-meta">{{ r.moto }} · {{ r.aseguradora }}</span>
                  <span class="rn-meta">Vence {{ r.venceEl | mtDate }}@if (r.diasParaVencer >= 0) { · en {{ r.diasParaVencer }} días } @else { · hace {{ -r.diasParaVencer }} días }</span>
                </div>
                <div class="rn-lado">
                  <mt-badge [variant]="urgencia[r.urgencia].variante">{{ urgencia[r.urgencia].texto }}</mt-badge>
                  <span class="rn-acciones">
                    @if (r.celular) { <a class="rn-enlace" [href]="'tel:' + r.celular">Llamar</a> }
                    <a class="rn-enlace rn-enlace--fuerte" routerLink="/ejecutivo/soat/nuevo" [queryParams]="{ placa: r.placa }" data-testid="renovar">Renovar</a>
                  </span>
                </div>
              </li>
            }
          </ul>
        </mt-card>
      }
    } @else {
      <p class="rn-meta">Cargando…</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .rn-lista {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .rn-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-5);
    }
    .rn-item:not(:first-child) {
      border-top: 1px solid var(--color-border);
    }
    .rn-principal,
    .rn-lado {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      min-width: 0;
    }
    .rn-lado {
      align-items: flex-end;
    }
    .rn-meta {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      overflow-wrap: anywhere;
    }
    .rn-acciones {
      display: inline-flex;
      gap: var(--space-3);
    }
    .rn-enlace {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0 var(--space-2);
      color: var(--color-primary);
      font-weight: 600;
      text-decoration: none;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .rn-enlace--fuerte {
      padding: 0 var(--space-4);
      border-radius: var(--radius-md);
      background: var(--color-primary);
      color: #fff;
    }
    @media (max-width: 540px) {
      .rn-item {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
      }
      .rn-lado {
        align-items: flex-start;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SoatRenovacionesComponent {
  private readonly api = inject(SoatApiService);

  protected readonly renovaciones = signal<RenovacionPorHacer[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly urgencia = URGENCIA;

  constructor() {
    this.api.renovaciones().subscribe({
      next: (r) => this.renovaciones.set(r),
      error: () => this.error.set('No se pudieron cargar las renovaciones. Inténtalo de nuevo.')
    });
  }
}
