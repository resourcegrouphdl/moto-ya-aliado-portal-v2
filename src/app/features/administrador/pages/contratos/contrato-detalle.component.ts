import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ContratoApiService } from '../../../../core/contrato/contrato-api.service';
import {
  ContratoResumen,
  CronogramaVersion,
  DocumentoContrato,
  ESTADO_DOCUMENTO_LABEL,
  ESTADO_FORMALIZACION_LABEL,
  EstadoFormalizacion,
  TIPO_DOCUMENTO_LABEL,
  TipoDocumentoContrato
} from '../../../../core/contrato/contrato.models';
import { MtDatePipe } from '../../../../shared/pipes/mt-date.pipe';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent, BadgeVariant } from '../../../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';

const ESTADO_BADGE_VARIANT: Record<string, BadgeVariant> = {
  GENERADO: 'neutral',
  PENDIENTE_DOCUMENTOS: 'warning',
  PENDIENTE_FIRMA: 'warning',
  FIRMADO: 'success',
  CANCELADO: 'error'
};

const ESTADO_DOCUMENTO_BADGE_VARIANT: Record<string, BadgeVariant> = {
  PENDIENTE: 'neutral',
  VALIDADO: 'success',
  RECHAZADO: 'error'
};

/**
 * Los 3 pasos reales del recorrido de formalización — GENERADO queda fuera a
 * propósito: `Contrato.generar()` (backend) crea el contrato directo en
 * PENDIENTE_DOCUMENTOS, así que ningún contrato real pasa por GENERADO.
 * CANCELADO es una rama aparte (solo alcanzable desde PENDIENTE_FIRMA), no un
 * cuarto paso de la línea principal — se muestra como un estado propio.
 */
const PASOS_FORMALIZACION: { estado: EstadoFormalizacion; label: string; icon: string }[] = [
  { estado: 'PENDIENTE_DOCUMENTOS', label: 'Documentos', icon: 'description' },
  { estado: 'PENDIENTE_FIRMA', label: 'Firma', icon: 'draw' },
  { estado: 'FIRMADO', label: 'Firmado', icon: 'task_alt' }
];

const TIPO_DOCUMENTO_OPTIONS: SelectOption<TipoDocumentoContrato>[] = [
  { label: 'Factura de la moto', value: 'FACTURA' },
  { label: 'Boucher de pago inicial', value: 'BOUCHER' },
  { label: 'Evidencia de firma', value: 'EVIDENCIA_FIRMA' },
  { label: 'TIVE', value: 'TIVE' },
  { label: 'SOAT', value: 'SOAT' },
  { label: 'Placa de rodaje', value: 'PLACA' },
  { label: 'Acta de entrega', value: 'ACTA_ENTREGA' }
];

/**
 * Reemplaza el flujo del sistema legado (subir factura/boucher sin monto,
 * aprobado a ciegas): aquí el monto es obligatorio para FACTURA/BOUCHER y el
 * backend (ValidarDocumentoUseCase) lo compara contra el precio de la moto /
 * la inicial esperada antes de aprobar.
 */
@Component({
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CardComponent,
    BadgeComponent,
    ButtonComponent,
    IconComponent,
    AlertComponent,
    InputComponent,
    SelectComponent,
    MtDatePipe,
    DecimalPipe
  ],
  templateUrl: './contrato-detalle.component.html',
  styleUrl: './contrato-detalle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContratoDetalleComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ContratoApiService);
  private readonly fb = inject(FormBuilder);

  private readonly contratoId = this.route.snapshot.paramMap.get('id')!;

  protected readonly estadoLabel = ESTADO_FORMALIZACION_LABEL;
  protected readonly estadoBadgeVariant = ESTADO_BADGE_VARIANT;
  protected readonly estadoDocumentoLabel = ESTADO_DOCUMENTO_LABEL;
  protected readonly estadoDocumentoBadgeVariant = ESTADO_DOCUMENTO_BADGE_VARIANT;
  protected readonly tipoDocumentoLabel = TIPO_DOCUMENTO_LABEL;
  protected readonly tipoDocumentoOptions = TIPO_DOCUMENTO_OPTIONS;

  protected readonly contrato = signal<ContratoResumen | null>(null);
  protected readonly documentos = signal<DocumentoContrato[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly subiendo = signal(false);
  protected readonly archivoSeleccionado = signal<File | null>(null);
  protected readonly cronograma = signal<CronogramaVersion | null>(null);
  protected readonly loadingCronograma = signal(true);

  protected readonly form = this.fb.nonNullable.group({
    tipoDocumento: this.fb.nonNullable.control<TipoDocumentoContrato>('BOUCHER', Validators.required),
    monto: this.fb.control<number | null>(null),
    numeroChasis: [''],
    color: [''],
    marca: [''],
    modelo: [''],
    anio: this.fb.control<number | null>(null)
  });

  // toSignal(valueChanges), no computed() leyendo form.controls.X.value directo:
  // un computed() sin ninguna lectura de signal real no vuelve a recalcular
  // nunca (queda "congelado" en su primer valor) — mismo criterio que
  // direccionTitularTexto/fechaNacimientoTitularTexto en solicitud.component.ts.
  private readonly tipoDocumentoSeleccionado = toSignal(this.form.controls.tipoDocumento.valueChanges, {
    initialValue: this.form.controls.tipoDocumento.value
  });

  protected readonly requiereMonto = computed(() => {
    const tipo = this.tipoDocumentoSeleccionado();
    return tipo === 'FACTURA' || tipo === 'BOUCHER';
  });

  /** La factura, a diferencia del resto de documentos, también registra la identidad del vehículo — ver DatosDocumentoContrato (backend). */
  protected readonly esFactura = computed(() => this.tipoDocumentoSeleccionado() === 'FACTURA');

  protected readonly pasos = PASOS_FORMALIZACION;

  protected readonly pasoActualIndex = computed(() => {
    const estado = this.contrato()?.estadoFormalizacion;
    const idx = PASOS_FORMALIZACION.findIndex((p) => p.estado === estado);
    return idx === -1 ? 0 : idx;
  });

  protected readonly generando = signal(false);
  protected readonly errorGenerar = signal<string | null>(null);

  constructor() {
    this.cargar();
    this.cargarCronograma();
  }

  private cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.obtener(this.contratoId).subscribe({
      next: (contrato) => {
        this.contrato.set(contrato);
        this.api.listarDocumentos(this.contratoId).subscribe({
          next: (docs) => {
            this.documentos.set(docs);
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo cargar el contrato.');
      }
    });
  }

  /** Cronograma aparte (independiente de `cargar()`): 404 antes de emitirse no debe bloquear el resto de la pantalla. */
  private cargarCronograma(): void {
    this.loadingCronograma.set(true);
    this.api.obtenerCronograma(this.contratoId).subscribe({
      next: (version) => {
        this.cronograma.set(version);
        this.loadingCronograma.set(false);
      },
      error: () => {
        this.cronograma.set(null);
        this.loadingCronograma.set(false);
      }
    });
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.archivoSeleccionado.set(input.files?.[0] ?? null);
  }

  subirDocumento(): void {
    const archivo = this.archivoSeleccionado();
    if (!archivo) return;
    if (this.requiereMonto() && !this.form.controls.monto.value) {
      this.error.set('Ingresa el monto antes de subir el documento.');
      return;
    }
    const { tipoDocumento, monto, numeroChasis, color, marca, modelo, anio } = this.form.getRawValue();
    if (tipoDocumento === 'FACTURA' && (!numeroChasis || !color || !marca || !modelo || !anio)) {
      this.error.set('Completa chasis, color, marca, modelo y año antes de subir la factura.');
      return;
    }

    this.subiendo.set(true);
    this.error.set(null);

    this.api.solicitarSubida(this.contratoId, archivo.name, archivo.type).subscribe({
      next: (solicitud) => {
        this.api.subirArchivo(solicitud, archivo).subscribe({
          next: () => {
            const datos =
              tipoDocumento === 'FACTURA'
                ? { tipoDocumento, url: solicitud.publicUrl, monto, numeroChasis, color, marca, modelo, anio }
                : { tipoDocumento, url: solicitud.publicUrl, monto };
            this.api.registrarDocumento(this.contratoId, datos).subscribe({
              next: (documento) => {
                this.documentos.update((lista) => [...lista, documento]);
                this.subiendo.set(false);
                this.archivoSeleccionado.set(null);
                this.form.reset({ tipoDocumento: 'BOUCHER', monto: null, numeroChasis: '', color: '', marca: '', modelo: '', anio: null });
              },
              error: () => {
                this.subiendo.set(false);
                this.error.set('El archivo se subió pero no se pudo registrar. Intenta de nuevo.');
              }
            });
          },
          error: () => {
            this.subiendo.set(false);
            this.error.set('No se pudo subir el archivo.');
          }
        });
      },
      error: () => {
        this.subiendo.set(false);
        this.error.set('No se pudo iniciar la subida.');
      }
    });
  }

  generarDocumento(): void {
    this.generando.set(true);
    this.errorGenerar.set(null);

    this.api.generarDocumento(this.contratoId).subscribe({
      next: () => {
        this.generando.set(false);
        // La URL queda persistida en el contrato — recargamos para mostrar el link de descarga.
        this.cargar();
      },
      error: (err) => {
        this.generando.set(false);
        const code = (err as { error?: { error?: string } })?.error?.error;
        this.errorGenerar.set(
          code === 'TRANSICION_INVALIDA'
            ? 'El contrato no está en un estado válido para generar el documento.'
            : 'No se pudo generar el documento. Intenta nuevamente.'
        );
      }
    });
  }

  volver(): void {
    this.router.navigate(['/administrador/contratos']);
  }
}
