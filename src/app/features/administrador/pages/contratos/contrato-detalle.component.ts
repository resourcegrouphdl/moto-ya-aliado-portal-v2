import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ContratoApiService } from '../../../../core/contrato/contrato-api.service';
import {
  ContratoResumen,
  DocumentoContrato,
  ESTADO_DOCUMENTO_LABEL,
  ESTADO_FORMALIZACION_LABEL,
  TIPO_DOCUMENTO_LABEL,
  TipoDocumentoContrato
} from '../../../../core/contrato/contrato.models';
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
    DatePipe,
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

  protected readonly form = this.fb.nonNullable.group({
    tipoDocumento: this.fb.nonNullable.control<TipoDocumentoContrato>('BOUCHER', Validators.required),
    monto: this.fb.control<number | null>(null)
  });

  protected readonly requiereMonto = computed(() => {
    const tipo = this.form.controls.tipoDocumento.value;
    return tipo === 'FACTURA' || tipo === 'BOUCHER';
  });

  constructor() {
    this.cargar();
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

    this.subiendo.set(true);
    this.error.set(null);
    const { tipoDocumento, monto } = this.form.getRawValue();

    this.api.solicitarSubida(this.contratoId, archivo.name, archivo.type).subscribe({
      next: (solicitud) => {
        this.api.subirArchivo(solicitud, archivo).subscribe({
          next: () => {
            this.api.registrarDocumento(this.contratoId, { tipoDocumento, url: solicitud.publicUrl, monto }).subscribe({
              next: (documento) => {
                this.documentos.update((lista) => [...lista, documento]);
                this.subiendo.set(false);
                this.archivoSeleccionado.set(null);
                this.form.reset({ tipoDocumento: 'BOUCHER', monto: null });
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

  volver(): void {
    this.router.navigate(['/administrador/contratos']);
  }
}
