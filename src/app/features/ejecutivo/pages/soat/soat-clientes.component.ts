import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SoatApiService } from '../../../../core/soat/soat-api.service';
import { MiCartera, TRAMO_LABEL } from '../../../../core/soat/soat.models';
import { MtDatePipe } from '../../../../shared/pipes/mt-date.pipe';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { soles } from './soat.util';

/**
 * «Mis clientes»: los créditos SOAT que el vendedor captó, por antigüedad de mora, para saber a quién llamar, y su comisión (lo del mes, lo acumulado, lo
 * reversado y lo que está por ganar). Solo lectura: la cobranza la hace el equipo de Motoya; aquí el vendedor ayuda a que su cliente pague.
 */
@Component({
  selector: 'mt-soat-clientes-page',
  standalone: true,
  imports: [RouterLink, MtDatePipe, AlertComponent, BadgeComponent, CardComponent, EmptyStateComponent, PageHeaderComponent],
  template: `
    <mt-page-header title="Mis clientes" description="Tus créditos SOAT: quién va al día, quién se atrasó y cuánto llevas ganado." />

    @let d = datos();
    @if (error()) {
      <mt-alert variant="error" title="No se pudo cargar">{{ error() }}</mt-alert>
    } @else if (d) {
      <section class="cl-kpis" data-testid="comision">
        <mt-card><span class="cl-k">Ganado este mes</span><strong class="cl-v">{{ soles(d.comision.delMes) }}</strong></mt-card>
        <mt-card><span class="cl-k">Ganado en total</span><strong class="cl-v">{{ soles(d.comision.total) }}</strong>@if (d.comision.reversada > 0) { <span class="cl-s">{{ soles(d.comision.reversada) }} reversado</span> }</mt-card>
        <mt-card><span class="cl-k">Por ganar</span><strong class="cl-v">{{ soles(d.comision.porGanar) }}</strong><span class="cl-s">{{ d.comision.solicitudesPorGanar }} solicitudes en curso · estimado</span></mt-card>
      </section>

      <h2 class="cl-titulo">Cartera de tus créditos</h2>
      @if (d.cartera.creditos.length === 0) {
        <mt-empty-state icon="verified_user" title="Aún no tienes créditos activos" description="Cuando un SOAT a crédito quede activo, aparecerá aquí con su estado de pago." />
      } @else {
        <p class="cl-s" data-testid="resumen">{{ d.cartera.resumen.creditosActivos }} créditos · {{ soles(d.cartera.resumen.saldoPorCobrar) }} por cobrar · {{ d.cartera.resumen.creditosEnMora }} en mora</p>
        <mt-card [padded]="false">
          <ul class="cl-lista" data-testid="clientes">
            @for (c of d.cartera.creditos; track c.solicitudId) {
              <li>
                <a class="cl-fila" [routerLink]="['/ejecutivo/soat', c.solicitudId]">
                  <div class="cl-principal">
                    <strong>{{ c.cliente || c.codigo }} · {{ c.placa }}</strong>
                    <span class="cl-s">{{ c.numeroContrato }}@if (c.proximoVencimiento) { · próxima cuota {{ c.proximoVencimiento | mtDate }} }</span>
                  </div>
                  <div class="cl-lado">
                    <mt-badge [variant]="c.diasDeMora === 0 ? 'success' : c.diasDeMora <= 30 ? 'warning' : 'error'">{{ c.diasDeMora === 0 ? 'Al día' : c.diasDeMora + ' días de atraso' }}</mt-badge>
                    <span class="cl-s">{{ tramo[c.tramo] }} · {{ soles(c.saldo) }}</span>
                  </div>
                </a>
              </li>
            }
          </ul>
        </mt-card>
      }
    } @else {
      <p class="cl-s">Cargando…</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .cl-kpis {
      display: grid;
      gap: var(--space-3);
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
    .cl-kpis mt-card {
      display: grid;
      gap: 2px;
    }
    .cl-k,
    .cl-s {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      overflow-wrap: anywhere;
    }
    .cl-v {
      font-size: var(--text-xl);
    }
    .cl-titulo {
      margin: var(--space-6) 0 var(--space-3);
    }
    .cl-lista {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .cl-lista li:not(:first-child) {
      border-top: 1px solid var(--color-border);
    }
    .cl-fila {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-5);
      color: inherit;
      text-decoration: none;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      .cl-fila:hover {
        background: var(--color-bg);
      }
    }
    .cl-principal,
    .cl-lado {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      min-width: 0;
    }
    .cl-lado {
      align-items: flex-end;
    }
    @media (max-width: 540px) {
      .cl-fila {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
      }
      .cl-lado {
        align-items: flex-start;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SoatClientesComponent {
  private readonly api = inject(SoatApiService);

  protected readonly datos = signal<MiCartera | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly tramo = TRAMO_LABEL;
  protected readonly soles = soles;

  constructor() {
    this.api.miCartera().subscribe({
      next: (d) => this.datos.set(d),
      error: () => this.error.set('No se pudo cargar tu cartera de SOAT. Inténtalo de nuevo.')
    });
  }
}
