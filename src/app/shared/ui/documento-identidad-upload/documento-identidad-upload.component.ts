import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { OriginacionApiService } from '../../../core/originacion/originacion-api.service';
import { DatosDocumentoIdentidadExtraidos, TipoDocumentoIdentidad } from '../../../core/originacion/originacion.models';
import { AlertComponent } from '../alert/alert.component';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

export interface DocumentoIdentidadExtraido {
  datos: DatosDocumentoIdentidadExtraidos;
  publicUrl: string;
}

/**
 * Sube la foto del DNI/carné de extranjería ANTES de que exista cliente o
 * solicitud (staging en GCS, sin solicitudId — ver
 * GcsDocumentoIdentidadStorageAdapter en motoya-api) y dispara OCR (Document
 * AI) para prellenar el resto del formulario, en vez de tipear todo a mano.
 *
 * Best-effort siempre: no existe en Document AI un extractor de campos de
 * identidad genérico (comprobado en vivo contra el proyecto real) — se arma
 * con OCR_PROCESSOR (texto plano + regex ajustado al layout peruano) e
 * ID_PROOFING_PROCESSOR (señales de fraude/calidad) en paralelo. Si la foto
 * sale borrosa o el OCR no reconoce algún campo, motoya-api simplemente
 * devuelve ese campo en null — nunca un error — y el formulario queda
 * disponible para completar a mano, igual que siempre.
 *
 * La misma foto ya subida se reutiliza después como documento DNI_FRENTE
 * (ver onFotoIdentidad* en SolicitudComponent) — el vendedor nunca la sube
 * dos veces.
 */
@Component({
  selector: 'mt-documento-identidad-upload',
  standalone: true,
  imports: [AlertComponent, ButtonComponent, IconComponent],
  templateUrl: './documento-identidad-upload.component.html',
  styleUrl: './documento-identidad-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentoIdentidadUploadComponent {
  label = input.required<string>();
  tipoDocumento = input.required<TipoDocumentoIdentidad>();

  extraido = output<DocumentoIdentidadExtraido>();

  private readonly api = inject(OriginacionApiService);

  protected readonly subiendo = signal(false);
  protected readonly extrayendo = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly avisoCalidad = signal<string | null>(null);
  /** true solo cuando avisoCalidad es una señal de fraude real — cambia la variante de la alerta de warning a error. */
  protected readonly avisoEsFraude = signal(false);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly listo = signal(false);

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (archivo) this.procesar(archivo);
  }

  private procesar(archivo: File): void {
    this.subiendo.set(true);
    this.error.set(null);
    this.avisoCalidad.set(null);
    this.avisoEsFraude.set(false);

    this.api.solicitarSubidaDocumentoIdentidad(archivo.name, archivo.type).subscribe({
      next: (solicitud) => {
        this.api.subirArchivoDocumentoIdentidad(solicitud, archivo).subscribe({
          next: () => {
            this.subiendo.set(false);
            this.previewUrl.set(solicitud.publicUrl);
            this.listo.set(true);
            this.extrayendo.set(true);
            this.api.extraerDatosDocumentoIdentidad(solicitud.gcsPath, archivo.type, this.tipoDocumento()).subscribe({
              next: (datos) => {
                this.extrayendo.set(false);
                if (datos.posibleProblemaCalidad) {
                  this.avisoEsFraude.set(datos.posibleFraude);
                  this.avisoCalidad.set(
                    datos.detalleProblemaCalidad ?? 'La verificación automática detectó una posible falla de calidad — revisa los datos.'
                  );
                }
                this.extraido.emit({ datos, publicUrl: solicitud.publicUrl });
              },
              error: () => {
                this.extrayendo.set(false);
                this.avisoCalidad.set('No se pudo leer el documento automáticamente. Completa los datos manualmente.');
              }
            });
          },
          error: () => {
            this.subiendo.set(false);
            this.error.set('No se pudo subir el archivo. Vuelve a tocar el botón para intentarlo de nuevo.');
          }
        });
      },
      error: () => {
        this.subiendo.set(false);
        this.error.set('No se pudo iniciar la subida. Vuelve a tocar el botón para intentarlo de nuevo.');
      }
    });
  }
}
