import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SoatApiService } from '../../../../core/soat/soat-api.service';
import { ConsultaDePlaca, Modalidad, RegistrarSolicitudRequest, TipoDocumentoIdentidad } from '../../../../core/soat/soat.models';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { mensajeDeError } from './soat.util';

const PLACA = /^[A-Z0-9]{5,7}$/;
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Abrir una solicitud de SOAT: primero la placa (la consulta trae la moto y su SOAT actual para no tipearlos), después el documento y el celular del cliente
 * y la forma de pago. Nunca se pide algo que el servidor pueda traer solo: el nombre se completa con el documento y solo se pide si no aparece.
 */
@Component({
  selector: 'mt-soat-nuevo-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AlertComponent, ButtonComponent, CardComponent, InputComponent, PageHeaderComponent],
  template: `
    <mt-page-header title="Nuevo SOAT" description="Placa, documento y celular del cliente; Motoya cotiza y te avisa cuando el precio esté listo." />

    <mt-card>
      <form class="nuevo" (ngSubmit)="crear()" #formulario="ngForm" novalidate>
        <h2 class="nuevo__titulo">1 · La moto</h2>
        <mt-input label="Placa" name="placa" [ngModel]="placa()" (ngModelChange)="escribirPlaca($event)" icon="two_wheeler" autocomplete="off" [errorMessage]="placa() && !placaValida() ? 'La placa lleva de 5 a 7 letras y números, sin guiones.' : undefined" />
        <mt-button variant="secondary" [disabled]="!placaValida() || consultando()" [loading]="consultando()" (click)="consultar()">Consultar la placa</mt-button>

        @if (consulta(); as c) {
          @if (c.yaTieneSolicitudEnCurso) {
            <mt-alert variant="error">Esta moto ya tiene una solicitud de SOAT en curso: no se puede abrir otra hasta que termine.</mt-alert>
          }
          @if (c.moto.estado === 'ENCONTRADO' && c.moto.datos) {
            <p class="nuevo__dato" data-testid="moto-encontrada">{{ descripcionMoto(c) }}</p>
          } @else {
            <mt-alert variant="info">No pudimos traer los datos de la moto. Escríbelos como están en la TIVE.</mt-alert>
            <mt-input label="Marca" name="marca" [ngModel]="marca()" (ngModelChange)="marca.set($event)" />
            <mt-input label="Modelo" name="modelo" [ngModel]="modelo()" (ngModelChange)="modelo.set($event)" />
          }
          @if (c.soat.estado === 'ENCONTRADO' && c.soat.datos) {
            <p class="nuevo__nota">SOAT actual: {{ c.soat.datos.aseguradora }} · {{ c.soat.datos.estado.toLowerCase() }}{{ c.soat.datos.fechaFin ? ' · hasta ' + c.soat.datos.fechaFin : '' }}</p>
          }
        }

        <h2 class="nuevo__titulo">2 · El cliente</h2>
        <div class="nuevo__chips" role="radiogroup" aria-label="Tipo de documento">
          <button type="button" class="chip" role="radio" [attr.aria-checked]="tipoDocumento() === 'DNI'" [class.chip--activo]="tipoDocumento() === 'DNI'" (click)="elegirTipoDocumento('DNI')">DNI</button>
          <button type="button" class="chip" role="radio" [attr.aria-checked]="tipoDocumento() === 'CARNET_EXTRANJERIA'" [class.chip--activo]="tipoDocumento() === 'CARNET_EXTRANJERIA'" (click)="elegirTipoDocumento('CARNET_EXTRANJERIA')">Carné de extranjería</button>
        </div>
        <mt-input label="Número de documento" name="documento" [ngModel]="documento()" (ngModelChange)="escribirDocumento($event)" inputmode="numeric" autocomplete="off" icon="badge" [errorMessage]="documento() && !documentoValido() ? 'Revisa el número de documento.' : undefined" />
        <mt-input label="Celular{{ esCredito() ? '' : ' (opcional)' }}" name="celular" [ngModel]="celular()" (ngModelChange)="escribirCelular($event)" inputmode="tel" autocomplete="tel" icon="call" [hint]="esCredito() ? 'Para los avisos de las cuotas.' : 'Para avisarle cuando su SOAT esté listo.'" [errorMessage]="celular() && !celularValido() ? 'El celular lleva 9 dígitos y empieza con 9.' : undefined" />

        @if (esCredito()) {
          <mt-input label="Correo del cliente" name="correo" [ngModel]="correo()" (ngModelChange)="correo.set($event.trim())" inputmode="email" autocomplete="email" icon="mail" hint="Ahí le llega el contrato para firmar." [errorMessage]="correo() && !correoValido() ? 'El correo no tiene un formato válido.' : undefined" />
          <mt-input label="Domicilio del cliente" name="domicilio" [ngModel]="domicilio()" (ngModelChange)="domicilio.set($event)" icon="home_pin" hint="Calle, número y distrito: va en el contrato." [errorMessage]="domicilio() && !domicilioValido() ? 'Escribe la calle, el número y el distrito.' : undefined" />
        }

        @if (pideNombre()) {
          <mt-alert variant="info">No encontramos al cliente con ese documento: escribe su nombre tal como figura en él.</mt-alert>
          <mt-input label="Nombres" name="nombres" [ngModel]="nombres()" (ngModelChange)="nombres.set($event)" />
          <mt-input label="Apellido paterno" name="apellidoPaterno" [ngModel]="apellidoPaterno()" (ngModelChange)="apellidoPaterno.set($event)" />
          <mt-input label="Apellido materno (opcional)" name="apellidoMaterno" [ngModel]="apellidoMaterno()" (ngModelChange)="apellidoMaterno.set($event)" />
        } @else {
          <p class="nuevo__nota">El nombre se completa solo con el documento.</p>
        }

        <h2 class="nuevo__titulo">3 · Forma de pago</h2>
        <div class="nuevo__chips" role="radiogroup" aria-label="Forma de pago">
          <button type="button" class="chip" role="radio" [attr.aria-checked]="modalidad() === 'CONTADO'" [class.chip--activo]="modalidad() === 'CONTADO'" (click)="modalidad.set('CONTADO')" data-testid="modalidad-contado">Al contado</button>
          <button type="button" class="chip" role="radio" [attr.aria-checked]="modalidad() === 'CREDITO'" [class.chip--activo]="modalidad() === 'CREDITO'" (click)="modalidad.set('CREDITO')" data-testid="modalidad-credito">A crédito</button>
        </div>
        <p class="nuevo__nota">
          @if (esCredito()) {
            A crédito: el cliente paga una inicial y el resto en 8 cuotas semanales. Hacen falta su documento y la TIVE, y el crédito pasa por una evaluación.
          } @else {
            Al contado: el cliente paga el SOAT completo a la cuenta de la empresa.
          }
        </p>

        @if (error()) {
          <mt-alert variant="error">{{ error() }}</mt-alert>
        }
        @if (existenteId()) {
          <a class="nuevo__existente" [routerLink]="['/ejecutivo/soat', existenteId()]">Ver la solicitud existente</a>
        }

        <mt-button type="submit" [disabled]="!puedeCrear()" [loading]="enviando()" data-testid="crear-soat">Crear solicitud</mt-button>
      </form>
    </mt-card>
  `,
  styles: `
    :host {
      display: block;
    }
    .nuevo {
      display: grid;
      gap: var(--space-4);
      max-width: 560px;
    }
    .nuevo__titulo {
      margin: var(--space-2) 0 0;
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .nuevo__dato {
      margin: 0;
      font-weight: 600;
    }
    .nuevo__nota {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
    .nuevo__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .chip {
      min-height: 48px;
      padding: 0 var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface, #fff);
      color: var(--color-text);
      font: inherit;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    .chip:active {
      transform: scale(0.97);
    }
    .chip--activo {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      color: var(--color-primary);
      font-weight: 600;
    }
    .nuevo__existente {
      font-weight: 600;
      color: var(--color-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SoatNuevoComponent {
  private readonly api = inject(SoatApiService);
  private readonly router = inject(Router);

  protected readonly placa = signal('');
  protected readonly consultando = signal(false);
  protected readonly consulta = signal<ConsultaDePlaca | null>(null);
  protected readonly marca = signal('');
  protected readonly modelo = signal('');
  protected readonly tipoDocumento = signal<TipoDocumentoIdentidad>('DNI');
  protected readonly documento = signal('');
  protected readonly celular = signal('');
  protected readonly correo = signal('');
  protected readonly domicilio = signal('');
  protected readonly modalidad = signal<Modalidad>('CONTADO');
  protected readonly pideNombre = signal(false);
  protected readonly nombres = signal('');
  protected readonly apellidoPaterno = signal('');
  protected readonly apellidoMaterno = signal('');
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly existenteId = signal<string | null>(null);

  protected readonly esCredito = computed(() => this.modalidad() === 'CREDITO');
  protected readonly placaNormalizada = computed(() => this.placa().replace(/[^A-Za-z0-9]/g, '').toUpperCase());
  protected readonly placaValida = computed(() => PLACA.test(this.placaNormalizada()));

  constructor() {
    // «Renovar» desde la lista de renovaciones llega con la placa: se escribe y se consulta sola, así el vendedor solo confirma al cliente.
    const inicial = inject(ActivatedRoute).snapshot.queryParamMap.get('placa');
    if (inicial) {
      this.escribirPlaca(inicial);
      if (this.placaValida()) this.consultar();
    }
  }
  protected readonly pideMoto = computed(() => {
    const c = this.consulta();
    return c !== null && !(c.moto.estado === 'ENCONTRADO' && c.moto.datos);
  });
  protected readonly documentoValido = computed(() => {
    const d = this.documento();
    return this.tipoDocumento() === 'DNI' ? /^\d{8}$/.test(d) : /^[A-Za-z0-9]{6,15}$/.test(d);
  });
  protected readonly celularValido = computed(() => (this.celular() === '' && !this.esCredito()) || /^9\d{8}$/.test(this.celular()));
  protected readonly correoValido = computed(() => (this.correo() === '' && !this.esCredito()) || CORREO.test(this.correo()));
  protected readonly domicilioValido = computed(() => !this.esCredito() || this.domicilio().trim().length >= 8);
  protected readonly puedeCrear = computed(() => {
    const c = this.consulta();
    return (
      c !== null &&
      !c.yaTieneSolicitudEnCurso &&
      this.documentoValido() &&
      this.celularValido() &&
      this.correoValido() &&
      this.domicilioValido() &&
      !this.enviando() &&
      (!this.pideMoto() || (this.marca().trim() !== '' && this.modelo().trim() !== '')) &&
      (!this.pideNombre() || (this.nombres().trim() !== '' && this.apellidoPaterno().trim() !== ''))
    );
  });

  /** Cambiar la placa invalida la consulta anterior: no se envía una moto que ya no corresponde. */
  protected escribirPlaca(texto: string): void {
    this.placa.set(texto.slice(0, 8));
    this.consulta.set(null);
    this.error.set(null);
    this.existenteId.set(null);
  }

  protected elegirTipoDocumento(tipo: TipoDocumentoIdentidad): void {
    this.tipoDocumento.set(tipo);
    this.documento.set('');
  }

  protected escribirDocumento(texto: string): void {
    this.documento.set(texto.replace(/[^A-Za-z0-9]/g, '').slice(0, this.tipoDocumento() === 'DNI' ? 8 : 15));
  }

  protected escribirCelular(texto: string): void {
    this.celular.set(texto.replace(/\D/g, '').slice(0, 9));
  }

  protected descripcionMoto(c: ConsultaDePlaca): string {
    const d = c.moto.datos;
    return [d?.marca, d?.modelo, d?.color].filter(Boolean).join(' · ');
  }

  protected consultar(): void {
    if (!this.placaValida() || this.consultando()) return;
    this.consultando.set(true);
    this.error.set(null);
    this.existenteId.set(null);
    this.api.consultarPlaca(this.placaNormalizada()).subscribe({
      next: (c) => {
        this.consultando.set(false);
        this.consulta.set(c);
      },
      error: (e: unknown) => {
        this.consultando.set(false);
        this.error.set(mensajeDeError(e, 'No se pudo consultar la placa. Inténtalo de nuevo.'));
      }
    });
  }

  protected crear(): void {
    if (!this.puedeCrear()) return;
    this.enviando.set(true);
    this.error.set(null);
    this.existenteId.set(null);
    const credito = this.esCredito();
    const pedido: RegistrarSolicitudRequest = {
      modalidad: this.modalidad(),
      tipoDocumento: this.tipoDocumento(),
      numeroDocumento: this.documento(),
      placa: this.placaNormalizada(),
      celular: this.celular() || undefined,
      correo: credito ? this.correo() || undefined : undefined,
      domicilio: credito ? this.domicilio().trim() || undefined : undefined,
      // Con la moto consultada no se manda nada: el servidor usa lo que devolvió el proveedor.
      marca: this.pideMoto() ? this.marca().trim() || undefined : undefined,
      modelo: this.pideMoto() ? this.modelo().trim() || undefined : undefined,
      nombres: this.nombres().trim() || undefined,
      apellidoPaterno: this.apellidoPaterno().trim() || undefined,
      apellidoMaterno: this.apellidoMaterno().trim() || undefined
    };
    this.api.registrar(pedido).subscribe({
      next: (s) => {
        this.enviando.set(false);
        void this.router.navigate(['/ejecutivo/soat', s.id]);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        const mensaje = mensajeDeError(e, 'No se pudo crear la solicitud. Inténtalo de nuevo.');
        const faltaNombre = /nombre/i.test(mensaje);
        if (faltaNombre) this.pideNombre.set(true);
        // Si solo faltaba el nombre, el formulario ya lo pide: no se repite el error.
        this.error.set(faltaNombre ? null : mensaje);
        const existente = (e.error as { solicitudExistenteId?: string } | null)?.solicitudExistenteId;
        this.existenteId.set(existente ?? null);
      }
    });
  }
}
