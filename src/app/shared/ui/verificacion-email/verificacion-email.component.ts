import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
import { OriginacionApiService } from '../../../core/originacion/originacion-api.service';
import { EstadoVerificacionEmail } from '../../../core/originacion/originacion.models';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

type Estado = 'consultando' | 'inicial' | 'enviando' | 'pendiente' | 'verificando' | 'verificado';

/** Mismo formato que valida el backend — se usa solo para no consultar el estado con un correo a medio tipear. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Vigencia del código, en segundos — espeja `VerificacionEmail.VIGENCIA` de motoya-api (15 min). */
const VIGENCIA_SEGUNDOS = 15 * 60;

/** Cooldown del reenvío, en segundos — espeja `VerificacionEmail.COOLDOWN_REENVIO` de motoya-api (60 s). */
const COOLDOWN_REENVIO_SEGUNDOS = 60;

/**
 * Verificación de correo del wizard de venta (2026-08-16; reconstruible desde el servidor, 2026-09-23) — confirma
 * que el titular realmente tiene acceso al correo tecleado, vía código de 6 dígitos enviado por email (un solo uso,
 * 15 min de vigencia). Enforcement es solo de frontend: el consumidor decide si bloquea el avance según lo que
 * emite `verificadoChange` / `pendienteChange`.
 *
 * <p><b>Qué cambió (etapa 2 del plan de originación, 2026-09-23)</b>: antes el estado vivía solo en memoria del
 * componente. Como el componente se destruye al cambiar de paso, el vendedor que perdía el foco o volvía atrás
 * encontraba el bloque en blanco y tenía que pedir un código NUEVO aunque el anterior siguiera vigente — gastando
 * la cuota de 5 por hora y molestando al cliente. Ahora, al crearse el componente se consulta
 * `GET /originacion/verificacion-email/estado` para ese correo y el bloque se reconstruye: si hay un código vigente
 * lo muestra con su cuenta regresiva y **no reenvía nada**.
 *
 * <p>El estado se invalida si `email` cambia respecto al correo real al que se le envió/verificó el código vigente
 * (`emailObjetivo`) — el vendedor no puede editar el correo a mitad de camino y terminar confirmando contra un
 * correo distinto al que recibió el código. `confirmarCodigo()` usa siempre `emailObjetivo`, nunca relee `email()`.
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
  /** `true` mientras haya un código pedido y sin confirmar — el wizard lo usa para marcar el correo como pendiente. */
  pendienteChange = output<boolean>();

  protected readonly estado = signal<Estado>('consultando');
  protected readonly codigo = signal('');
  protected readonly errorMensaje = signal<string | null>(null);
  protected readonly cooldown = signal(0);
  protected readonly segundosRestantes = signal(0);
  protected readonly limitePorHora = signal(false);

  /** "12:34" para el aviso de vencimiento del código. */
  protected readonly vencimientoTexto = computed(() => {
    const total = this.segundosRestantes();
    const minutos = Math.floor(total / 60);
    const segundos = total % 60;
    return `${minutos}:${segundos.toString().padStart(2, '0')}`;
  });

  /** Correo real al que se le envió/verificó el código vigente — ver docblock de la clase. */
  private emailObjetivo: string | null = null;
  private ticker?: ReturnType<typeof setInterval>;

  constructor() {
    // El estado real vive en el servidor: al entrar a este paso (o al volver) se consulta el código vigente de ese
    // correo. Con debounce porque `email` cambia en cada tecla de mt-input.
    toObservable(this.email)
      .pipe(
        debounceTime(500),
        map((valor) => (valor ?? '').trim()),
        distinctUntilChanged(),
        filter((email) => EMAIL_PATTERN.test(email)),
        switchMap((email) =>
          this.api.estadoVerificacionEmail(email).pipe(
            map((respuesta) => ({ email, respuesta })),
            // Si el estado no se puede leer, el bloque queda como está: nunca bloquea al vendedor por esto.
            catchError(() => of(null))
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((resultado) => {
        if (resultado) {
          this.aplicarEstadoDelServidor(resultado.email, resultado.respuesta);
        }
      });

    // Editar el correo a mitad de camino invalida lo que había (ver docblock de la clase).
    effect(() => {
      const actual = (this.email() ?? '').trim();
      if (this.emailObjetivo && actual !== this.emailObjetivo) {
        const eraVerificado = this.estado() === 'verificado';
        this.reiniciar();
        if (eraVerificado) {
          this.verificadoChange.emit(false);
        }
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
        // Si el vendedor ya editó el correo mientras la request estaba en vuelo, descartar esta respuesta.
        if (this.email()?.trim() !== email) return;
        this.emailObjetivo = email;
        this.estado.set('pendiente');
        this.codigo.set('');
        this.segundosRestantes.set(VIGENCIA_SEGUNDOS);
        // Bug real encontrado en la verificación en navegador (2026-09-23): faltaba arrancar el cooldown del
        // reenvío acá, así que el botón "Reenviar código" quedaba habilitado al instante.
        this.cooldown.set(COOLDOWN_REENVIO_SEGUNDOS);
        this.iniciarTicker();
        this.pendienteChange.emit(true);
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
        this.segundosRestantes.set(0);
        this.detenerTicker();
        this.verificadoChange.emit(true);
        this.pendienteChange.emit(false);
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

  /** Aplica lo que dice el servidor: código vigente, ya verificado, o nada pendiente. */
  private aplicarEstadoDelServidor(email: string, respuesta: EstadoVerificacionEmail): void {
    this.limitePorHora.set(respuesta.limitePorHoraAlcanzado);
    this.cooldown.set(respuesta.segundosParaReenviar);

    if (respuesta.verificado) {
      const eraVerificado = this.estado() === 'verificado';
      this.emailObjetivo = email;
      this.estado.set('verificado');
      this.segundosRestantes.set(0);
      this.detenerTicker();
      if (!eraVerificado) this.verificadoChange.emit(true);
      return;
    }

    const eraVerificado = this.estado() === 'verificado';
    if (eraVerificado) this.verificadoChange.emit(false);

    if (respuesta.vigente) {
      this.emailObjetivo = email;
      this.estado.set('pendiente');
      this.codigo.set('');
      this.segundosRestantes.set(respuesta.segundosRestantes);
      this.iniciarTicker();
      this.pendienteChange.emit(true);
      return;
    }

    this.emailObjetivo = null;
    this.estado.set('inicial');
    this.codigo.set('');
    this.segundosRestantes.set(0);
    this.detenerTicker();
    this.pendienteChange.emit(false);
  }

  private reiniciar(): void {
    this.emailObjetivo = null;
    this.estado.set('inicial');
    this.codigo.set('');
    this.errorMensaje.set(null);
    this.segundosRestantes.set(0);
    this.detenerTicker();
    this.pendienteChange.emit(false);
  }

  /** Un solo ticker para las dos cuentas regresivas: el cooldown del reenvío y el vencimiento del código. */
  private iniciarTicker(): void {
    clearInterval(this.ticker);
    this.ticker = setInterval(() => {
      this.cooldown.update((s) => Math.max(0, s - 1));
      this.segundosRestantes.update((s) => Math.max(0, s - 1));

      // El código venció mientras el vendedor lo esperaba: se vuelve al estado inicial, sin reenviar solo.
      if (this.segundosRestantes() === 0 && this.estado() === 'pendiente') {
        this.estado.set('inicial');
        this.emailObjetivo = null;
        this.pendienteChange.emit(false);
        this.errorMensaje.set('El código venció. Pedí uno nuevo para continuar.');
        this.detenerTicker();
        return;
      }
      if (this.cooldown() === 0 && this.segundosRestantes() === 0) this.detenerTicker();
    }, 1000);
  }

  private detenerTicker(): void {
    clearInterval(this.ticker);
  }

  private setErrorMensaje(err: HttpErrorResponse): void {
    const detalle = typeof err.error === 'object' && err.error && 'detail' in err.error ? String(err.error.detail) : null;
    this.errorMensaje.set(detalle ?? 'No se pudo procesar la solicitud. Intenta de nuevo.');
  }
}
