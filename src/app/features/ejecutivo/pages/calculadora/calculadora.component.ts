import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { CODIGO_PRODUCTO_CREDITO_DEFAULT, ProductoCreditoApiService } from '../../../../core/producto-credito/producto-credito-api.service';
import { CotizacionCreditoResponse } from '../../../../core/producto-credito/producto-credito.models';

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
 * Cotiza un crédito real contra BC-07 (MotorAmortizacionPort vía
 * CotizarCreditoUseCase, motoya-api) — reemplaza el stub que solo mostraba
 * "pendiente de conexión". Mismo motor que usa BC-03 al emitir el cronograma
 * real de un contrato, así que la cotización que ve aquí el ejecutivo/cliente
 * es la misma matemática que terminará en el contrato si se aprueba.
 */
@Component({
  selector: 'mt-calculadora-page',
  standalone: true,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    AlertComponent,
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

  protected readonly form = this.fb.nonNullable.group({
    precioVehiculo: [0, [Validators.required, Validators.min(1)]],
    inicialIngresada: [0],
    numeroPeriodos: [40, Validators.required],
    incluirSoat: [false, Validators.required]
  });

  cotizar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const datos = this.form.getRawValue();
    this.cotizando.set(true);
    this.error.set(null);
    this.resultado.set(null);

    this.api
      .cotizar({
        codigoProducto: CODIGO_PRODUCTO_CREDITO_DEFAULT,
        precioVehiculo: Number(datos.precioVehiculo),
        inicialIngresada: Number(datos.inicialIngresada) > 0 ? Number(datos.inicialIngresada) : null,
        numeroPeriodos: Number(datos.numeroPeriodos),
        incluirSoat: datos.incluirSoat,
        fechaDesembolso: null
      })
      .subscribe({
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
  }
}
