import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { OriginacionApiService } from '../../../core/originacion/originacion-api.service';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

type Estado = 'inicial' | 'enviando' | 'pendiente' | 'verificando' | 'verificado';

/**
 * Verificación de correo del wizard de venta (2026-08-16) — confirma que el
 * titular realmente tiene acceso al correo tecleado, vía código de 6 dígitos
 * enviado por email (un solo uso, 15 min de vigencia — ver
 * VerificacionEmailController en motoya-api). Enforcement es solo de
 * frontend: el consumidor (solicitud.component.ts) es quien decide si
 * bloquea el avance del paso según lo que emite `verificadoChange` — este
 * componente solo administra el flujo de envío/confirmación, no conoce el
 * resto del formulario.
 *
 * <p>El estado se invalida si `email` cambia respecto al correo real al que
 * se le envió/verificó el código vigente (`emailObjetivo`, ver el `effect`
 * del constructor) — así el vendedor no puede editar el correo a mitad de
 * camino (código ya pedido pero aún sin confirmar) y terminar confirmando
 * contra un correo distinto al que en verdad recibió el código, ni seguir
 * con el check verde tras editar un correo ya verificado. `confirmarCodigo()`
 * usa siempre `emailObjetivo`, nunca relee `email()` — es la única forma de
 * garantizar que "a quién se le mandó" y "a quién se confirma" sean siempre
 * el mismo valor aunque el input del formulario haya cambiado mientras tanto.
 */
@Component({
  selector: 'mt-verificacion-email',
  standalone: true,
  imports: [ButtonComponent, IconComponent],
  templateUrl: './verificacion-email.component.html',
  styleUrl: './verificacion-email.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VerificacionEmailComponent {
  private readonly api = inject(OriginacionApiService);

  /** Correo actual del campo del formulario del consumidor. */
  email = input.required<string>();

  verificadoChange = output<boolean>();

  protected readonly estado = signal<Estado>('inicial');
  protected readonly codigo = signal('');
  protected readonly errorMensaje = signal<string | null>(null);
  protected readonly cooldown = signal(0);

  /** Correo real al que se le envió/verificó el código vigente — ver docblock de la clase. */
  private emailObjetivo: string | null = null;
  private cooldownTimer?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      const actual = this.email()?.trim();
      const estadoActual = this.estado();
      if (estadoActual === 'inicial' || estadoActual === 'enviando') return;
      if (actual !== this.emailObjetivo) {
        const eraVerificado = estadoActual === 'verificado';
        this.estado.set('inicial');
        this.emailObjetivo = null;
        this.codigo.set('');
        if (eraVerificado) this.verificadoChange.emit(false);
      }
    });
  }

  protected enviarCodigo(): void {
    const email = this.email()?.trim();
    if (!email) return;
    this.estado.set('enviando');
    this.errorMensaje.set(null);
    this.api.enviarCodigoVerificacionEmail(email).subscribe({
      next: () => {
        // Si el vendedor ya editó el correo mientras la request estaba en vuelo, descartar esta respuesta —
        // el efecto de arriba ya se encarga de volver a 'inicial' apenas email() deje de coincidir.
        if (this.email()?.trim() !== email) return;
        this.emailObjetivo = email;
        this.estado.set('pendiente');
        this.codigo.set('');
        this.iniciarCooldown();
      },
      error: (err: HttpErrorResponse) => {
        if (this.email()?.trim() !== email) return;
        this.estado.set('inicial');
        this.setErrorMensaje(err);
      }
    });
  }

  protected confirmarCodigo(): void {
    // Nunca this.email() acá — el código se confirma contra el correo al que de verdad se le envió, no contra
    // lo que haya en el input del formulario en este instante (ver docblock de la clase).
    const email = this.emailObjetivo;
    const codigo = this.codigo();
    if (!email || codigo.length !== 6) return;
    this.estado.set('verificando');
    this.errorMensaje.set(null);
    this.api.confirmarCodigoVerificacionEmail(email, codigo).subscribe({
      next: () => {
        this.estado.set('verificado');
        this.verificadoChange.emit(true);
      },
      error: (err: HttpErrorResponse) => {
        this.estado.set('pendiente');
        this.setErrorMensaje(err);
      }
    });
  }

  protected onCodigoInput(valor: string): void {
    this.codigo.set(valor.replace(/\D/g, '').slice(0, 6));
  }

  private iniciarCooldown(): void {
    this.cooldown.set(60);
    clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      this.cooldown.update((s) => Math.max(0, s - 1));
      if (this.cooldown() === 0) clearInterval(this.cooldownTimer);
    }, 1000);
  }

  private setErrorMensaje(err: HttpErrorResponse): void {
    const detalle = typeof err.error === 'object' && err.error && 'detail' in err.error ? String(err.error.detail) : null;
    this.errorMensaje.set(detalle ?? 'No se pudo procesar la solicitud. Intenta de nuevo.');
  }
}
