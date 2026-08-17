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
 * <p>El estado se invalida solo si `email` cambia respecto al valor que
 * quedó verificado (ver el `effect` del constructor) — así el vendedor no
 * puede editar el correo después de verificarlo y seguir con el check verde
 * de un correo distinto.
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

  private emailVerificado: string | null = null;
  private cooldownTimer?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      const actual = this.email();
      if (this.estado() === 'verificado' && actual !== this.emailVerificado) {
        this.estado.set('inicial');
        this.emailVerificado = null;
        this.codigo.set('');
        this.verificadoChange.emit(false);
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
        this.estado.set('pendiente');
        this.codigo.set('');
        this.iniciarCooldown();
      },
      error: (err: HttpErrorResponse) => {
        this.estado.set('inicial');
        this.setErrorMensaje(err);
      }
    });
  }

  protected confirmarCodigo(): void {
    const email = this.email()?.trim();
    const codigo = this.codigo();
    if (!email || codigo.length !== 6) return;
    this.estado.set('verificando');
    this.errorMensaje.set(null);
    this.api.confirmarCodigoVerificacionEmail(email, codigo).subscribe({
      next: () => {
        this.estado.set('verificado');
        this.emailVerificado = email;
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
