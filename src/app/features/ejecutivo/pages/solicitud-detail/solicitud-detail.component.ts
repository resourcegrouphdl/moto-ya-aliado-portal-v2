import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, of, switchMap, throwError } from 'rxjs';

import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent, BadgeVariant } from '../../../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { OriginacionApiService } from '../../../../core/originacion/originacion-api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  DOCUMENTOS_AVALISTA,
  DOCUMENTOS_TITULAR,
  DocumentoSolicitudResponse,
  ESTADO_DOCUMENTO_SOLICITUD_BADGE_VARIANT,
  ESTADO_DOCUMENTO_SOLICITUD_LABEL,
  EstadoSolicitud,
  ExpedienteSolicitudResponse,
  TipoDocumentoIdentidad
} from '../../../../core/originacion/originacion.models';

const ESTADO_LABEL: Record<EstadoSolicitud, string> = {
  BORRADOR: 'Borrador',
  INCOMPLETA: 'Incompleta',
  COMPLETA: 'Completa',
  EN_EVALUACION: 'En evaluación',
  CERRADA: 'Cerrada',
  DESISTIDA: 'Desistida',
  VENCIDA: 'Vencida'
};

const ESTADO_VARIANT: Record<EstadoSolicitud, BadgeVariant> = {
  BORRADOR: 'neutral',
  INCOMPLETA: 'warning',
  COMPLETA: 'info',
  EN_EVALUACION: 'warning',
  CERRADA: 'success',
  DESISTIDA: 'error',
  VENCIDA: 'error'
};

const TIPOS_DOCUMENTO: SelectOption<TipoDocumentoIdentidad>[] = [
  { label: 'DNI', value: 'DNI' },
  { label: 'Carné de extranjería', value: 'CARNET_EXTRANJERIA' }
];

const RELACIONES: SelectOption<string>[] = [
  { label: 'Padre / Madre', value: 'Padre/Madre' },
  { label: 'Cónyuge', value: 'Cónyuge' },
  { label: 'Hermano(a)', value: 'Hermano(a)' },
  { label: 'Hijo(a)', value: 'Hijo(a)' },
  { label: 'Amigo(a)', value: 'Amigo(a)' },
  { label: 'Compañero(a) de trabajo', value: 'Compañero(a) de trabajo' },
  { label: 'Vecino(a)', value: 'Vecino(a)' },
  { label: 'Otro', value: 'Otro' }
];

/**
 * "Mi solicitud" — pantalla que hasta ahora no existía: el wizard
 * (SolicitudComponent) era estrictamente crear-y-listo, sin ninguna forma de
 * volver a ver una solicitud ya enviada (fase 3, ver memoria del proyecto,
 * turno "reemplazo de aval/documento"). Compartida por los dos roles de
 * tienda: se llega acá tanto desde `ejecutivo/clientes` (EJECUTIVO_ALIADO,
 * ve solo lo suyo) como desde `administrador/clientes` (ADMINISTRADOR_ALIADO,
 * ve toda la tienda) — mismo componente, dos rutas (`ejecutivo/solicitud/:id`
 * / `administrador/solicitud/:id`) para que el guard de rol y el "volver"
 * queden correctos en ambos casos. El vendedor/administrador ve el estado,
 * puede reemplazar documentos RECHAZADO/OBSERVADO y cambiar el aval si hace
 * falta, sin depender de que alguien de riesgo lo edite por él.
 */
@Component({
  selector: 'mt-solicitud-detail-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    IconComponent,
    InputComponent,
    PageHeaderComponent,
    SelectComponent
  ],
  templateUrl: './solicitud-detail.component.html',
  styleUrl: './solicitud-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SolicitudDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OriginacionApiService);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  private readonly solicitudId = this.route.snapshot.paramMap.get('id')!;

  /** El mismo componente se sirve en 2 rutas (ejecutivo/administrador) — "volver" tiene que ir a la lista del rol correcto, no siempre la del vendedor. */
  protected readonly volverLink = computed(() =>
    this.authService.rol() === 'ADMINISTRADOR_ALIADO' ? '/administrador/clientes' : '/ejecutivo/clientes'
  );
  protected readonly volverLabel = computed(() =>
    this.authService.rol() === 'ADMINISTRADOR_ALIADO' ? 'Volver a clientes de la tienda' : 'Volver a mis clientes'
  );

  protected readonly estadoLabel = ESTADO_LABEL;
  protected readonly estadoVariant = ESTADO_VARIANT;
  protected readonly estadoDocumentoLabel = ESTADO_DOCUMENTO_SOLICITUD_LABEL;
  protected readonly estadoDocumentoBadgeVariant = ESTADO_DOCUMENTO_SOLICITUD_BADGE_VARIANT;
  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly relaciones = RELACIONES;
  protected readonly documentosTitularCatalogo = DOCUMENTOS_TITULAR;
  protected readonly documentosAvalCatalogo = DOCUMENTOS_AVALISTA;

  protected readonly expediente = signal<ExpedienteSolicitudResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly documentos = signal<DocumentoSolicitudResponse[]>([]);
  protected readonly loadingDocumentos = signal(true);
  protected readonly reemplazandoDocumentoId = signal<string | null>(null);

  protected readonly cambiandoAval = signal(false);
  protected readonly guardandoAval = signal(false);
  protected readonly errorAval = signal<string | null>(null);

  protected readonly formAval = this.fb.nonNullable.group({
    tipoDocumento: ['DNI' as TipoDocumentoIdentidad, Validators.required],
    numeroDocumento: ['', Validators.required],
    nombres: ['', Validators.required],
    apellidoPaterno: ['', Validators.required],
    apellidoMaterno: ['', Validators.required],
    relacion: ['Padre/Madre', Validators.required]
  });

  constructor() {
    this.cargar();
  }

  protected get documentosTitular(): DocumentoSolicitudResponse[] {
    return this.documentos().filter((d) => d.rol === 'TITULAR');
  }

  protected get documentosAvalista(): DocumentoSolicitudResponse[] {
    return this.documentos().filter((d) => d.rol === 'AVALISTA');
  }

  protected labelDocumento(rol: 'TITULAR' | 'AVALISTA', tipo: string): string {
    const catalogo = rol === 'TITULAR' ? this.documentosTitularCatalogo : this.documentosAvalCatalogo;
    return catalogo.find((d) => d.tipo === tipo)?.label ?? tipo;
  }

  private cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.obtenerExpediente(this.solicitudId).subscribe({
      next: (expediente) => {
        this.expediente.set(expediente);
        this.loading.set(false);
        this.cargarDocumentos();
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo cargar la solicitud.');
      }
    });
  }

  private cargarDocumentos(): void {
    this.loadingDocumentos.set(true);
    this.api.listarDocumentos(this.solicitudId).subscribe({
      next: (documentos) => {
        this.documentos.set(documentos);
        this.loadingDocumentos.set(false);
      },
      error: () => this.loadingDocumentos.set(false)
    });
  }

  protected toggleCambiarAval(): void {
    this.errorAval.set(null);
    this.cambiandoAval.update((v) => !v);
  }

  protected confirmarCambioAval(): void {
    if (this.formAval.invalid) {
      this.formAval.markAllAsTouched();
      return;
    }
    const datos = this.formAval.getRawValue();
    this.guardandoAval.set(true);
    this.errorAval.set(null);

    this.api
      .buscarClientePorDocumento(datos.tipoDocumento, datos.numeroDocumento)
      .pipe(
        catchError((err: HttpErrorResponse) =>
          err.status === 404
            ? this.api.crearCliente({
                tipoDocumento: datos.tipoDocumento,
                numeroDocumento: datos.numeroDocumento,
                nombres: datos.nombres,
                apellidoPaterno: datos.apellidoPaterno,
                apellidoMaterno: datos.apellidoMaterno
              })
            : throwError(() => err)
        ),
        switchMap((cliente) =>
          this.api.reemplazarAvalista(this.solicitudId, { clienteId: cliente.id, relacion: datos.relacion }).pipe(switchMap(() => of(cliente)))
        )
      )
      .subscribe({
        next: () => {
          this.guardandoAval.set(false);
          this.cambiandoAval.set(false);
          this.formAval.reset({ tipoDocumento: 'DNI', relacion: 'Padre/Madre' });
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoAval.set(false);
          const detalle = typeof err.error === 'object' && err.error && 'detail' in err.error ? String(err.error.detail) : null;
          this.errorAval.set(detalle ?? 'No se pudo cambiar el aval. Verifica los datos e intenta nuevamente.');
        }
      });
  }

  /** Solo para documentos RECHAZADO/OBSERVADO (mismo gate que el backend) — sube el archivo nuevo y confirma sobre el mismo registro. */
  protected triggerReemplazoInput(documentoId: string): void {
    document.getElementById('reemplazo-' + documentoId)?.click();
  }

  protected onArchivoReemplazo(documento: DocumentoSolicitudResponse, event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;

    this.reemplazandoDocumentoId.set(documento.id);
    this.api.solicitarSubidaDocumento(this.solicitudId, archivo.name, archivo.type).subscribe({
      next: (solicitudSubida) => {
        this.api.subirArchivoDocumento(solicitudSubida, archivo).subscribe({
          next: () => {
            this.api.reemplazarDocumento(this.solicitudId, documento.id, solicitudSubida.publicUrl).subscribe({
              next: (actualizado) => {
                this.documentos.update((lista) => lista.map((d) => (d.id === actualizado.id ? actualizado : d)));
                this.reemplazandoDocumentoId.set(null);
              },
              error: () => this.reemplazandoDocumentoId.set(null)
            });
          },
          error: () => this.reemplazandoDocumentoId.set(null)
        });
      },
      error: () => this.reemplazandoDocumentoId.set(null)
    });
  }
}
