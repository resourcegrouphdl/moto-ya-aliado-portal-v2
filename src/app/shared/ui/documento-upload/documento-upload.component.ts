import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { OriginacionApiService } from '../../../core/originacion/originacion-api.service';
import {
  DocumentoSolicitudResponse,
  RolPersonaSolicitud,
  TipoDocumentoSolicitud
} from '../../../core/originacion/originacion.models';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

/**
 * Un slot de documento KYC (DNI frente, recibo de servicio, etc.) del wizard
 * de solicitud — sube directo a GCS vía signed URL (mismo patrón que los
 * documentos de contrato, BC-03) y registra el resultado. Reemplazar un
 * documento ya subido simplemente sube uno nuevo — el backend conserva el
 * historial y expone el más reciente.
 */
@Component({
  selector: 'mt-documento-upload',
  standalone: true,
  imports: [ButtonComponent, IconComponent],
  templateUrl: './documento-upload.component.html',
  styleUrl: './documento-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentoUploadComponent {
  label = input.required<string>();
  solicitudId = input.required<string>();
  rol = input.required<RolPersonaSolicitud>();
  tipo = input.required<TipoDocumentoSolicitud>();
  documento = input<DocumentoSolicitudResponse | null>(null);
  /** Texto corto bajo el label, solo cuando ya hay documento — ej. aclarar que se auto-registró desde otro paso. */
  nota = input<string>();

  documentoSubido = output<DocumentoSolicitudResponse>();

  private readonly api = inject(OriginacionApiService);

  protected readonly subiendo = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly documentoActual = signal<DocumentoSolicitudResponse | null>(null);

  constructor() {
    effect(() => this.documentoActual.set(this.documento()));
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (archivo) this.subir(archivo);
  }

  private subir(archivo: File): void {
    this.subiendo.set(true);
    this.error.set(null);

    this.api.solicitarSubidaDocumento(this.solicitudId(), archivo.name, archivo.type).subscribe({
      next: (solicitud) => {
        this.api.subirArchivoDocumento(solicitud, archivo).subscribe({
          next: () => {
            this.api.registrarDocumento(this.solicitudId(), { rol: this.rol(), tipo: this.tipo(), url: solicitud.publicUrl }).subscribe({
              next: (documento) => {
                this.documentoActual.set(documento);
                this.subiendo.set(false);
                this.documentoSubido.emit(documento);
              },
              error: () => {
                this.subiendo.set(false);
                this.error.set('Se subió el archivo pero no se pudo registrar. Intenta de nuevo.');
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
