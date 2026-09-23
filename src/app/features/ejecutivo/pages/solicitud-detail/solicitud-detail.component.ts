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
  ESTADO_VERIFICACION_DOMICILIO_BADGE_VARIANT,
  ESTADO_VERIFICACION_DOMICILIO_LABEL,
  EstadoSolicitud,
  ExpedienteSolicitudResponse,
  TIPO_FOTO_VERIFICACION_DOMICILIO_LABEL,
  TipoDocumentoIdentidad,
  VerificacionDomicilioResponse
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

  // ── Verificación de domicilio (etapa 5 de originación, DEC-030) ──────────
  // El link que le llega al titular por WhatsApp para subir la fachada y su selfie en la puerta. Dura 48 h, se manda
  // una sola vez de forma automática y el reenvío es solo a pedido expreso del titular —por eso se confirma antes—.
  // La alerta de distancia es informativa: nunca frena la solicitud.
  protected readonly verificacionDomicilio = signal<VerificacionDomicilioResponse | null>(null);
  protected readonly cargandoVerificacionDomicilio = signal(true);
  /** Error de carga del bloque (red/servidor). El 404 no cae acá: es "sin verificación", ver `sinVerificacionDomicilio`. */
  protected readonly errorVerificacionDomicilio = signal<string | null>(null);
  /** 404: a esta solicitud todavía no se le pidió el link. El botón de reenviar se muestra igual — ese POST crea la primera. */
  protected readonly sinVerificacionDomicilio = signal(false);
  protected readonly reenviandoVerificacionDomicilio = signal(false);
  /** Fallo del reenvío, aparte del de carga: se muestra sin borrar lo que ya había en pantalla. */
  protected readonly errorReenvioVerificacionDomicilio = signal<string | null>(null);
  protected readonly avisoVerificacionDomicilio = signal<string | null>(null);

  protected readonly estadoVerificacionDomicilioLabel = ESTADO_VERIFICACION_DOMICILIO_LABEL;
  protected readonly estadoVerificacionDomicilioBadgeVariant = ESTADO_VERIFICACION_DOMICILIO_BADGE_VARIANT;
  protected readonly tipoFotoVerificacionDomicilioLabel = TIPO_FOTO_VERIFICACION_DOMICILIO_LABEL;

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
        this.cargarVerificacionDomicilio();
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

  /**
   * Bloque de verificación de domicilio. `silencioso` es para el refetch después de un reenvío: la pantalla ya tiene
   * contenido y no corresponde taparlo con el estado de carga.
   */
  private cargarVerificacionDomicilio(silencioso = false): void {
    if (!silencioso) this.cargandoVerificacionDomicilio.set(true);
    this.errorVerificacionDomicilio.set(null);

    this.api.obtenerVerificacionDomicilio(this.solicitudId).subscribe({
      next: (verificacion) => {
        this.verificacionDomicilio.set(verificacion);
        this.sinVerificacionDomicilio.set(false);
        this.cargandoVerificacionDomicilio.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoVerificacionDomicilio.set(false);
        // 404 = a esta solicitud todavía no se le pidió el link. No es un error que mostrar: el botón del bloque es
        // justamente el que la crea.
        if (err.status === 404) {
          this.verificacionDomicilio.set(null);
          this.sinVerificacionDomicilio.set(true);
          return;
        }
        // Un refetch silencioso (el que sigue a un reenvío) no puede tapar con un error lo que ya está en pantalla.
        if (silencioso) return;
        this.errorVerificacionDomicilio.set(this.mensajeError(err, 'No se pudo cargar la verificación de domicilio.'));
      }
    });
  }

  protected reintentarVerificacionDomicilio(): void {
    this.cargarVerificacionDomicilio();
  }

  /**
   * Reenvío del link de verificación de domicilio. Antes de disparar nada se pide confirmación explícita: por regla
   * (DEC-030) el enlace se manda una sola vez de forma automática y reenviarlo es solo a pedido expreso del titular
   * —el enlace anterior deja de funcionar—. Este archivo no tiene un diálogo de confirmación propio, así que se usa
   * el `confirm()` del navegador.
   */
  protected reenviarVerificacionDomicilio(): void {
    const confirmado = window.confirm(
      'Este enlace se le manda al titular una sola vez, automáticamente. Reenviarlo es solo a pedido expreso del titular: el enlace que ya tenía deja de funcionar en cuanto salga el nuevo. ¿El titular te lo pidió?'
    );
    if (!confirmado) return;

    this.reenviandoVerificacionDomicilio.set(true);
    this.errorReenvioVerificacionDomicilio.set(null);
    this.avisoVerificacionDomicilio.set(null);

    // Con una verificación ya emitida se reenvía a esa misma persona (su `clienteId`); sin verificación todavía (404)
    // no se manda clienteId y el backend se lo manda al titular de la solicitud.
    const clienteId = this.verificacionDomicilio()?.clienteId;

    this.api.reenviarVerificacionDomicilio(this.solicitudId, clienteId).subscribe({
      next: () => {
        this.reenviandoVerificacionDomicilio.set(false);
        this.avisoVerificacionDomicilio.set('Se le envió un enlace nuevo al titular; el anterior dejó de funcionar.');
        this.cargarVerificacionDomicilio(true);
      },
      error: (err: HttpErrorResponse) => {
        this.reenviandoVerificacionDomicilio.set(false);
        this.errorReenvioVerificacionDomicilio.set(this.mensajeError(err, 'No se pudo reenviar el enlace de verificación.'));
      }
    });
  }

  /** Mensaje del backend si lo trae (ProblemDetail), si no el fallback — mismo criterio que el resto del archivo. */
  private mensajeError(err: HttpErrorResponse, fallback: string): string {
    const detalle = typeof err.error === 'object' && err.error && 'detail' in err.error ? String(err.error.detail) : null;
    return detalle ?? fallback;
  }

  /**
   * Fechas del bloque de verificación de domicilio, siempre en hora de Lima y formato es-PE: el navegador de la tienda
   * puede estar en cualquier zona, y estas fechas se leen contra una regla de negocio (las 48 h del link), igual que el
   * "hoy" del backend nunca usa la hora del servidor a secas. Null si el campo viene vacío o ilegible.
   */
  private readonly formatoFechaHoraLima = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });

  protected fechaHoraLima(iso: string | null): string | null {
    if (!iso) return null;
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? null : this.formatoFechaHoraLima.format(fecha);
  }

  /** Distancia al metro: "a 145 m del domicilio declarado" es lo que se lee, no "144.63". */
  protected metrosRedondeados(metros: number): number {
    return Math.round(metros);
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
