import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { CODIGO_PRODUCTO_CREDITO_DEFAULT, ProductoCreditoApiService } from '../../../../core/producto-credito/producto-credito-api.service';
import { CotizacionCreditoResponse, ProductoCreditoInfo } from '../../../../core/producto-credito/producto-credito.models';

/**
 * Rango vigente del único producto crediticio (BC-07, sembrado 2026-07-11:
 * 26-52 semanas, TEA plana 114%). Duplicado a propósito como constante de UI —
 * no hay todavía un endpoint /partner/** de solo lectura que exponga la
 * configuración vigente (solo /admin/** la expone, y ese pool no es el de este
 * app); si el rango real cambia, esta lista debe actualizarse a mano.
 */
const SEMANAS_OPTIONS: SelectOption<number>[] = Array.from({ length: 52 - 26 + 1 }, (_, i) => {
  const semanas = 26 + i;
  return { label: `${semanas} semanas`, value: semanas };
});

const SOAT_OPTIONS: SelectOption<boolean>[] = [
  { label: 'Sí, incluir SOAT (S/ 750)', value: true },
  { label: 'No, el cliente ya lo tiene', value: false }
];

/**
 * Vista comercial (2026-08-14) — a pedido del usuario: el resultado técnico de abajo (TCEA, cronograma cuota por
 * cuota) sirve al vendedor pero abruma al cliente en el primer contacto. Estos 3 plazos son solo una selección
 * representativa dentro del rango real del producto (26-52 semanas, ver `productoInfo()`) para armar una
 * comparación simple tipo "compara planes" — no son plazos fijos del producto, son los 3 que el usuario pidió
 * mostrar. Si el rango vigente cambiara y alguno quedara fuera, `cotizarPlanesComparacion` lo descarta en
 * silencio (ver `catchError`) en vez de romper toda la comparación.
 */
const SEMANAS_COMPARACION = [32, 42, 52] as const;

/**
 * Cotiza un crédito real contra BC-07 (MotorAmortizacionPort vía
 * CotizarCreditoUseCase, motoya-api) — reemplaza el stub que solo mostraba
 * "pendiente de conexión". Mismo motor que usa BC-03 al emitir el cronograma
 * real de un contrato, así que la cotización que ve aquí el ejecutivo/cliente
 * es la misma matemática que terminará en el contrato si se aprueba.
 *
 * <p>UX para el vendedor (2026-08-07): antes el vendedor solo veía el resultado
 * final sin entender de dónde salían los números — ej. una inicial "rara" que en
 * realidad es el ajuste automático porque el monto a financiar excedía el tope
 * del producto (ver {@code CotizarCreditoUseCase} en el backend). Ahora se
 * muestran las reglas del producto vigente ANTES de cotizar (inicial mínima,
 * rango financiable, precio máximo de moto) con un hint que se actualiza en vivo
 * mientras escribe el precio, y el resultado explica explícitamente cuándo y por
 * qué se ajustó la inicial — nunca un número sin contexto.
 */
@Component({
  selector: 'mt-calculadora-page',
  standalone: true,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    InputComponent,
    PageHeaderComponent,
    SelectComponent
  ],
  templateUrl: './calculadora.component.html',
  styleUrl: './calculadora.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalculadoraComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ProductoCreditoApiService);

  protected readonly semanasOptions = SEMANAS_OPTIONS;
  protected readonly soatOptions = SOAT_OPTIONS;

  protected readonly cotizando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly resultado = signal<CotizacionCreditoResponse | null>(null);

  // Reglas del producto vigente — se cargan una vez al entrar, de solo lectura, para poder mostrar hints en vivo
  // sin esperar a que el vendedor termine de llenar el formulario y le dé clic a "Cotizar".
  protected readonly productoInfo = signal<ProductoCreditoInfo | null>(null);
  protected readonly cargandoProductoInfo = signal(true);

  protected readonly form = this.fb.nonNullable.group({
    modeloMoto: [''],
    precioVehiculo: [0, [Validators.required, Validators.min(1)]],
    inicialIngresada: [0],
    numeroPeriodos: [40, Validators.required],
    incluirSoat: [false, Validators.required]
  });

  // Vista comercial — cards de "compara planes" + tarjeta para el cliente (ver SEMANAS_COMPARACION arriba).
  protected readonly cargandoPlanes = signal(false);
  protected readonly planesComparacion = signal<{ semanas: number; cuotaSemanal: number }[]>([]);

  private readonly precioVehiculo = toSignal(this.form.controls.precioVehiculo.valueChanges, { initialValue: 0 });
  private readonly inicialIngresada = toSignal(this.form.controls.inicialIngresada.valueChanges, { initialValue: 0 });

  /** Inicial mínima estimada para el precio que el vendedor ya escribió — puramente informativo, el backend recalcula el valor real al cotizar. */
  protected readonly inicialMinimaEstimada = computed(() => {
    const info = this.productoInfo();
    const precio = Number(this.precioVehiculo());
    return info && precio > 0 ? precio * info.porcentajeInicialMinima : null;
  });

  protected readonly hintPrecio = computed(() => {
    const info = this.productoInfo();
    if (!info) return undefined;
    const min = this.inicialMinimaEstimada();
    return min != null
      ? `Inicial mínima para esta moto: S/ ${min.toFixed(2)} (${(info.porcentajeInicialMinima * 100).toFixed(0)}%)`
      : undefined;
  });

  /** Aviso temprano (antes de cotizar) si el precio ya excede el tope financiable del producto — el backend igual lo rechazaría. */
  protected readonly precioExcedeMaximo = computed(() => {
    const info = this.productoInfo();
    const precio = Number(this.precioVehiculo());
    return !!info?.precioMaxVehiculo && precio > info.precioMaxVehiculo;
  });

  /** Si la inicial que el vendedor ya escribió es menor a la mínima, el backend la sube solo — se lo anticipamos acá. */
  protected readonly inicialMenorALaMinima = computed(() => {
    const min = this.inicialMinimaEstimada();
    const ingresada = Number(this.inicialIngresada());
    return min != null && ingresada > 0 && ingresada < min;
  });

  constructor() {
    this.api.obtenerVigente(CODIGO_PRODUCTO_CREDITO_DEFAULT).subscribe({
      next: (info) => {
        this.productoInfo.set(info);
        this.cargandoProductoInfo.set(false);
      },
      error: () => {
        // Nunca bloquea el formulario — sin esta info solo se pierden los hints en vivo, el backend sigue validando todo al cotizar.
        this.cargandoProductoInfo.set(false);
      }
    });
  }

  cotizar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const datos = this.form.getRawValue();
    this.cotizando.set(true);
    this.error.set(null);
    this.resultado.set(null);
    this.planesComparacion.set([]);

    const base = {
      codigoProducto: CODIGO_PRODUCTO_CREDITO_DEFAULT,
      precioVehiculo: Number(datos.precioVehiculo),
      inicialIngresada: Number(datos.inicialIngresada) > 0 ? Number(datos.inicialIngresada) : null,
      incluirSoat: datos.incluirSoat,
      fechaDesembolso: null
    };

    this.api.cotizar({ ...base, numeroPeriodos: Number(datos.numeroPeriodos) }).subscribe({
      next: (cotizacion) => {
        this.resultado.set(cotizacion);
        this.cotizando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cotizando.set(false);
        const detalle = typeof err.error === 'object' && err.error && 'detail' in err.error ? String(err.error.detail) : null;
        this.error.set(detalle ?? 'No se pudo cotizar. Verifica los datos e intenta nuevamente.');
      }
    });

    this.cargandoPlanes.set(true);
    forkJoin(
      SEMANAS_COMPARACION.map((semanas) =>
        this.api.cotizar({ ...base, numeroPeriodos: semanas }).pipe(
          // Un plazo puntual fuera de rango para este precio no debe tumbar toda la comparación — se omite en silencio.
          catchError(() => of(null))
        )
      )
    ).subscribe((resultados) => {
      this.cargandoPlanes.set(false);
      this.planesComparacion.set(
        resultados
          .map((r, i) => (r ? { semanas: SEMANAS_COMPARACION[i] as number, cuotaSemanal: r.cuotaBase } : null))
          .filter((p): p is { semanas: number; cuotaSemanal: number } => p !== null)
      );
    });
  }

  /** El plan con menor cuota semanal (naturalmente, el de mayor plazo) es el que se destaca — igual criterio que la referencia comercial. */
  protected readonly planDestacadoSemanas = computed(() => {
    const planes = this.planesComparacion();
    if (planes.length === 0) return null;
    return planes.reduce((mejor, p) => (p.cuotaSemanal < mejor.cuotaSemanal ? p : mejor)).semanas;
  });

  /**
   * Link directo a `wa.me` (sin número fijo — la cuenta de WhatsApp Business del vendedor/tienda ya es quien envía)
   * con el resumen comercial prellenado. Se usa como `[href]` de un `<a target="_blank">` en vez de
   * `window.open()` en un handler de click a propósito: un `<a>` con click real de usuario nunca lo bloquea el
   * navegador, mientras que `window.open()` programático sí puede ser bloqueado como popup en algunos navegadores
   * (confirmado en QA). Nunca se envía solo — siempre requiere que el vendedor elija el chat y confirme el envío
   * dentro de WhatsApp.
   */
  protected readonly whatsappHref = computed(() => {
    const r = this.resultado();
    if (!r) return null;
    const modelo = this.form.controls.modeloMoto.value.trim() || 'tu moto';
    const semanas = this.form.controls.numeroPeriodos.value;
    const lineas = [
      `🏍️ *Moto Ya* — cotización para ${modelo}`,
      '',
      `💰 Precio: S/ ${r.precioVehiculo.toFixed(2)}`,
      `📝 Inicial: S/ ${r.inicialAplicada.toFixed(2)}`,
      `📅 Plazo: ${semanas} semanas`,
      `✅ Cuota semanal: S/ ${r.cuotaBase.toFixed(2)}`,
      '',
      `TCEA referencial ${(r.tcea * 100).toFixed(2)}%. Cotización sujeta a evaluación crediticia.`
    ];
    const texto = encodeURIComponent(lineas.join('\n'));
    return `https://wa.me/?text=${texto}`;
  });
}
