import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { SolicitudDocumentosService } from '../../../core/documentos/solicitud-documentos.service';
import {
  DocumentoSolicitudResponse,
  RolPersonaSolicitud,
  TipoDocumentoSolicitud
} from '../../../core/originacion/originacion.models';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

/**
 * Un slot de documento KYC (DNI frente, recibo de servicio, etc.) del wizard
 * de solicitud — sube por Document Management (DEC-130: con su dueño, la
 * solicitud a la que está ligado y su hash) y registra el resultado.
 * Reemplazar un documento ya subido simplemente sube uno nuevo — el backend
 * conserva el historial y expone el más reciente.
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
  /** A quién pertenece el documento en Document Management: el cliente (titular o aval) de la solicitud. */
  rol = input.required<RolPersonaSolicitud>();
  tipo = input.required<TipoDocumentoSolicitud>();
  documento = input<DocumentoSolicitudResponse | null>(null);
  /** Texto corto bajo el label, solo cuando ya hay documento — ej. aclarar que se auto-registró desde otro paso. */
  nota = input<string>();

  documentoSubido = output<DocumentoSolicitudResponse>();

  private readonly documentosSolicitud = inject(SolicitudDocumentosService);

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

    this.documentosSolicitud.subirYRegistrar(this.solicitudId(), this.rol(), this.tipo(), archivo, this.label()).subscribe({
      next: (documento) => {
        this.documentoActual.set(documento);
        this.subiendo.set(false);
        this.documentoSubido.emit(documento);
      },
      error: () => {
        this.subiendo.set(false);
        this.error.set('No se pudo subir el archivo. Vuelve a tocar el botón para intentarlo de nuevo.');
      }
    });
  }

  /** «Ver»: la URL de lectura de Document Management se pide al abrirlo (vence). */
  protected ver(): void {
    const documento = this.documentoActual();
    if (!documento) return;
    this.documentosSolicitud.urlDe(this.solicitudId(), documento).subscribe({
      next: (url) => (url ? window.open(url, '_blank', 'noopener') : this.error.set('Este documento no tiene archivo disponible.')),
      error: () => this.error.set('No se pudo abrir el archivo.')
    });
  }
}
