import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SoatApiService } from '../../../../core/soat/soat-api.service';
import { BandejaDeAvisos, ESTADO_BADGE, ESTADO_LABEL, ResumenSolicitud } from '../../../../core/soat/soat.models';
import { MtDatePipe } from '../../../../shared/pipes/mt-date.pipe';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { soles } from './soat.util';

/**
 * «Mis SOAT»: las solicitudes de SOAT que esta persona captó (el servidor decide qué puede ver). Desde aquí se abre una nueva o se sigue una en curso,
 * al contado o a crédito.
 */
@Component({
  selector: 'mt-soat-lista-page',
  standalone: true,
  imports: [RouterLink, MtDatePipe, AlertComponent, BadgeComponent, CardComponent, EmptyStateComponent, IconComponent, PageHeaderComponent],
  template: `
    <mt-page-header title="SOAT" description="Capta un SOAT al contado o a crédito y síguelo hasta que el cliente tenga su póliza." />

    <a class="soat-nuevo" routerLink="/ejecutivo/soat/nuevo" data-testid="nuevo-soat">
      <mt-icon name="add" [size]="20" />
      Nuevo SOAT
    </a>

    <a class="soat-clientes" routerLink="/ejecutivo/soat/clientes" data-testid="mis-clientes">
      <mt-icon name="account_balance_wallet" [size]="20" />
      Mis clientes y comisión
    </a>

    @if (bandeja(); as b) {
      @if (b.avisos.length > 0) {
        <mt-card [padded]="false" class="soat-novedades" data-testid="novedades">
          <div class="soat-novedades__cabecera">
            <strong>Novedades @if (b.sinLeer > 0) { <span class="soat-novedades__cuenta" data-testid="sin-leer">{{ b.sinLeer }}</span> }</strong>
            @if (b.sinLeer > 0) {
              <button type="button" class="soat-novedades__marcar" (click)="marcarVistos()">Marcar como vistas</button>
            }
          </div>
          <ul class="soat-lista">
            @for (a of b.avisos.slice(0, 5); track a.solicitudId + a.ocurridoEn) {
              <li class="soat-lista__item">
                <a class="soat-lista__enlace" [routerLink]="['/ejecutivo/soat', a.solicitudId]">
                  <div class="soat-lista__principal">
                    <strong [class.soat-novedades__nueva]="!a.leido">{{ a.titulo }}</strong>
                    <span class="soat-lista__meta">{{ a.texto }}@if (a.motivo) { · {{ a.motivo }} }</span>
                    <span class="soat-lista__meta">{{ a.cliente || a.codigo }} · {{ a.placa }}</span>
                  </div>
                  <span class="soat-lista__meta">{{ a.ocurridoEn | mtDate }}</span>
                </a>
              </li>
            }
          </ul>
        </mt-card>
      }
    }

    @if (error()) {
      <mt-alert variant="error" title="No se pudo cargar">{{ error() }}</mt-alert>
    } @else if (cargando()) {
      <p class="soat-estado">Cargando tus solicitudes…</p>
    } @else if (solicitudes().length === 0) {
      <mt-empty-state icon="verified_user" title="Todavía no captaste ningún SOAT" description="Con «Nuevo SOAT» basta la placa, el documento y el celular del cliente." />
    } @else {
      <mt-card [padded]="false">
        <ul class="soat-lista" data-testid="lista-soat">
          @for (s of solicitudes(); track s.id) {
            <li class="soat-lista__item">
              <a class="soat-lista__enlace" [routerLink]="['/ejecutivo/soat', s.id]">
                <div class="soat-lista__principal">
                  <strong>{{ s.placa }} · {{ moto(s) }}</strong>
                  <span class="soat-lista__meta">{{ s.clienteNombre || s.numeroDocumento }} · {{ s.codigo }}</span>
                </div>
                <div class="soat-lista__lado">
                  <mt-badge [variant]="badge[s.estado]">{{ etiqueta[s.estado] }}</mt-badge>
                  <span class="soat-lista__meta">{{ s.modalidad === 'CREDITO' ? 'A crédito' : 'Al contado' }}{{ s.precioSoat ? ' · ' + soles(s.precioSoat) : '' }}</span>
                  <span class="soat-lista__meta">{{ s.actualizadaEn | mtDate }}</span>
                </div>
              </a>
            </li>
          }
        </ul>
      </mt-card>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .soat-nuevo {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 48px;
      margin-bottom: var(--space-4);
      padding: 0 var(--space-5);
      border-radius: var(--radius-md);
      background: var(--color-primary);
      color: #fff;
      font-weight: 600;
      text-decoration: none;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .soat-clientes {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 48px;
      margin: 0 0 var(--space-4) var(--space-2);
      padding: 0 var(--space-4);
      color: var(--color-primary);
      font-weight: 600;
      text-decoration: none;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .soat-nuevo:active {
      transform: scale(0.97);
    }
    .soat-novedades {
      display: block;
      margin-bottom: var(--space-4);
    }
    .soat-novedades__cabecera {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--color-border);
    }
    .soat-novedades__cuenta {
      display: inline-block;
      min-width: 20px;
      padding: 0 6px;
      border-radius: 10px;
      background: var(--color-primary);
      color: #fff;
      font-size: var(--text-sm);
      text-align: center;
    }
    .soat-novedades__marcar {
      min-height: 44px;
      padding: 0 var(--space-3);
      border: 0;
      background: transparent;
      color: var(--color-primary);
      font-weight: 600;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .soat-novedades__nueva::before {
      content: '';
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: var(--space-2);
      border-radius: 50%;
      background: var(--color-primary);
    }
    .soat-estado {
      padding: var(--space-8);
      text-align: center;
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
    .soat-lista {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .soat-lista__item:not(:first-child) {
      border-top: 1px solid var(--color-border);
    }
    .soat-lista__enlace {
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
      .soat-lista__enlace:hover {
        background: var(--color-bg);
      }
    }
    .soat-lista__principal,
    .soat-lista__lado {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      min-width: 0;
    }
    .soat-lista__lado {
      align-items: flex-end;
    }
    .soat-lista__meta {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      overflow-wrap: anywhere;
    }
    @media (max-width: 540px) {
      .soat-lista__enlace {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
      }
      .soat-lista__lado {
        align-items: flex-start;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SoatListaComponent {
  private readonly api = inject(SoatApiService);

  protected readonly solicitudes = signal<ResumenSolicitud[]>([]);
  protected readonly bandeja = signal<BandejaDeAvisos | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly etiqueta = ESTADO_LABEL;
  protected readonly badge = ESTADO_BADGE;
  protected readonly soles = soles;

  constructor() {
    // Las novedades son un extra: si fallan, la lista de solicitudes igual se muestra.
    this.api.avisos().subscribe({ next: (b) => this.bandeja.set(b), error: () => this.bandeja.set(null) });
    this.api.listar().subscribe({
      next: (lista) => {
        this.solicitudes.set(lista);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudieron cargar tus solicitudes de SOAT. Inténtalo de nuevo.');
      }
    });
  }

  protected marcarVistos(): void {
    this.api.marcarAvisosVistos().subscribe({
      next: () => this.bandeja.update((b) => (b ? { sinLeer: 0, avisos: b.avisos.map((a) => ({ ...a, leido: true })) } : b))
    });
  }

  protected moto(s: ResumenSolicitud): string {
    return [s.marca, s.modelo].filter(Boolean).join(' ') || 'Sin datos de la moto';
  }
}
