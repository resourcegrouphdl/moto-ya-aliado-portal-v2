import { MtDatePipe } from '../../../../shared/pipes/mt-date.pipe';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { DocumentosApiService } from '../../../../core/documentos/documentos-api.service';
import { SoatApiService } from '../../../../core/soat/soat-api.service';
import {
  comisionEstimada,
  DetalleDelPago,
  DocumentoDelCliente,
  ESTADO_BADGE,
  PolizaDelSoat,
  ESTADO_LABEL,
  ESTADO_VOUCHER_BADGE,
  ESTADO_VOUCHER_LABEL,
  ESTADOS_ABIERTOS_PARA_DOCUMENTOS,
  ESTADOS_QUE_ADMITEN_DESISTIR,
  ESTADOS_TERMINALES_MALOS,
  EventoSolicitud,
  Formalizacion,
  HITO_LABEL,
  InstruccionDePago,
  lineaDeTiempoDelCredito,
  Seguimiento,
  Simulacion,
  TIPO_DM_DEL_DOCUMENTO,
  TipoDeCobro,
  TipoHito
} from '../../../../core/soat/soat.models';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { hoyLima, mensajeDeError, soles } from './soat.util';

const DOCUMENTOS: { hito: DocumentoDelCliente; etiqueta: string; ayuda: string }[] = [
  { hito: 'DOCUMENTO_IDENTIDAD', etiqueta: 'Documento de identidad', ayuda: 'Foto del DNI o carné de extranjería, de frente.' },
  { hito: 'TIVE', etiqueta: 'TIVE de la moto', ayuda: 'Foto de la tarjeta de identificación vehicular.' }
];

const ESTADOS_CON_COBRO_DEL_CREDITO = ['FORMALIZANDO', 'ESPERANDO_PRENDA', 'ENVIADA_AL_BROKER', 'ACTIVADA', 'CERRADA'];

/**
 * Una solicitud de SOAT de punta a punta para quien la captó: en qué punto va el crédito, qué le toca hacer ahora y qué decirle al cliente. Cada acción
 * pasa por el servidor, que es quien decide; esta pantalla solo muestra lo que el servidor dice. Nunca muestra brokers ni ofertas.
 */
@Component({
  selector: 'mt-soat-detalle-page',
  standalone: true,
  imports: [DatePipe, MtDatePipe, FormsModule, RouterLink, AlertComponent, BadgeComponent, ButtonComponent, CardComponent, IconComponent, InputComponent],
  templateUrl: './soat-detalle.component.html',
  styleUrl: './soat-detalle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SoatDetalleComponent {
  private readonly api = inject(SoatApiService);
  private readonly documentos = inject(DocumentosApiService);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly seguimiento = signal<Seguimiento | null>(null);
  protected readonly eventos = signal<EventoSolicitud[]>([]);
  protected readonly formalizacion = signal<Formalizacion | null>(null);
  protected readonly simulacion = signal<Simulacion | null>(null);
  protected readonly instruccion = signal<InstruccionDePago | null>(null);
  protected readonly cobro = signal<DetalleDelPago | null>(null);
  protected readonly cargando = signal(true);
  protected readonly ocupado = signal<string | null>(null);
  protected readonly poliza = signal<PolizaDelSoat | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly declarando = signal(false);
  protected readonly declaracion = signal('');
  protected readonly desistiendo = signal(false);
  protected readonly motivo = signal('');

  // El voucher en curso: el archivo ya subido a Document Management y lo que la lectura propuso, para que la persona lo confirme.
  protected readonly voucherDocumentoId = signal<string | null>(null);
  protected readonly voucherMonto = signal('');
  protected readonly voucherFecha = signal(hoyLima());
  protected readonly voucherEntidad = signal('');
  protected readonly voucherOperacion = signal('');

  protected readonly etiquetaEstado = ESTADO_LABEL;
  protected readonly badgeEstado = ESTADO_BADGE;
  protected readonly etiquetaVoucher = ESTADO_VOUCHER_LABEL;
  protected readonly badgeVoucher = ESTADO_VOUCHER_BADGE;
  protected readonly documentosDelCliente = DOCUMENTOS;
  protected readonly soles = soles;

  protected readonly cumplidos = computed(() => new Set<TipoHito>(this.seguimiento()?.hitosCumplidos ?? []));
  protected readonly esCredito = computed(() => this.seguimiento()?.modalidad === 'CREDITO');
  protected readonly abierta = computed(() => {
    const e = this.seguimiento()?.estado;
    return e !== undefined && !ESTADOS_TERMINALES_MALOS.includes(e);
  });
  protected readonly pasos = computed(() => {
    const s = this.seguimiento();
    return s ? lineaDeTiempoDelCredito(s) : [];
  });
  protected readonly comision = computed(() => {
    const s = this.seguimiento();
    return s ? comisionEstimada(s.precioSoat, s.origen) : null;
  });
  protected readonly tipoDeCobro = computed<TipoDeCobro>(() => (this.esCredito() ? 'inicial' : 'pago'));
  protected readonly puedeDeclarar = computed(() => ['REGISTRADA', 'EN_COTIZACION', 'COTIZADA'].includes(this.seguimiento()?.estado ?? '') && !this.cumplidos().has('CONSENTIMIENTO'));
  protected readonly puedePedirPrecio = computed(() => this.seguimiento()?.estado === 'REGISTRADA' && this.cumplidos().has('CONSENTIMIENTO'));
  protected readonly puedeAceptarPrecio = computed(() => this.seguimiento()?.estado === 'COTIZADA' && !this.cumplidos().has('PRECIO_ACEPTADO'));
  protected readonly puedeCobrarContado = computed(() => this.seguimiento()?.estado === 'COTIZADA' && !this.esCredito());
  protected readonly puedeEvaluar = computed(() => this.seguimiento()?.estado === 'COTIZADA' && this.esCredito() && this.cumplidos().has('PRECIO_ACEPTADO'));
  protected readonly muestraCuotas = computed(() => this.esCredito() && ['REGISTRADA', 'EN_COTIZACION', 'COTIZADA', 'APROBADA'].includes(this.seguimiento()?.estado ?? ''));
  protected readonly muestraDocumentos = computed(() => this.esCredito() && ESTADOS_ABIERTOS_PARA_DOCUMENTOS.includes(this.seguimiento()?.estado ?? 'REGISTRADA'));
  protected readonly faltanDocumentos = computed(() => DOCUMENTOS.filter((d) => !this.cumplidos().has(d.hito)));
  protected readonly puedeFormalizar = computed(() => this.esCredito() && this.seguimiento()?.estado === 'APROBADA');
  protected readonly firmado = computed(() => this.cumplidos().has('CONTRATO_FIRMADO'));
  protected readonly muestraContrato = computed(() => this.esCredito() && this.formalizacion() !== null && ESTADOS_CON_COBRO_DEL_CREDITO.includes(this.seguimiento()?.estado ?? ''));
  protected readonly esperaPago = computed(() => {
    const s = this.seguimiento();
    if (!s) return false;
    return this.esCredito() ? s.estado === 'FORMALIZANDO' && !this.cumplidos().has('INICIAL_CONFIRMADA') : s.estado === 'ESPERANDO_PAGO';
  });
  protected readonly puedeDesistir = computed(() => ESTADOS_QUE_ADMITEN_DESISTIR.includes(this.seguimiento()?.estado ?? 'ANULADA') && !this.cumplidos().has('PRENDA_INSCRITA'));

  constructor() {
    this.recargar();
  }

  protected recargar(): void {
    this.api.seguimiento(this.id).subscribe({
      next: (s) => {
        this.seguimiento.set(s);
        this.cargando.set(false);
        if (s.modalidad === 'CREDITO' && ESTADOS_CON_COBRO_DEL_CREDITO.includes(s.estado)) {
          this.api.formalizacion(this.id).subscribe({ next: (f) => this.formalizacion.set(f), error: () => undefined });
          this.recargarCobro();
        }
        if (s.modalidad === 'CONTADO' && ['ESPERANDO_PAGO', 'PAGO_VALIDADO', 'ENVIADA_AL_BROKER', 'ACTIVADA', 'CERRADA'].includes(s.estado)) {
          this.recargarCobro();
        }
      },
      error: (e: unknown) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(e, 'No se pudo cargar la solicitud.'));
      }
    });
    this.api.historial(this.id).subscribe({ next: (h) => this.eventos.set(h), error: () => undefined });
  }

  private recargarCobro(): void {
    this.api.cobro(this.id, this.tipoDeCobro()).subscribe({ next: (c) => this.cobro.set(c), error: () => undefined });
    if (this.esperaPago()) {
      // Idempotente: repetirlo devuelve las mismas instrucciones de depósito.
      this.api.iniciarCobro(this.id, this.tipoDeCobro()).subscribe({ next: (i) => this.instruccion.set(i), error: () => undefined });
    }
  }

  /** Corre una acción del servidor mostrando que está ocupado y deja el error a la vista si falla. */
  private ejecutar<T>(que: string, accion: Observable<T>, alTerminar: (r: T) => void): void {
    this.ocupado.set(que);
    this.error.set(null);
    this.aviso.set(null);
    accion.subscribe({
      next: (r) => {
        this.ocupado.set(null);
        alTerminar(r);
      },
      error: (e: unknown) => {
        this.ocupado.set(null);
        this.error.set(mensajeDeError(e, 'No se pudo completar la acción.'));
      }
    });
  }

  private aplicar(s: Seguimiento): void {
    this.seguimiento.set(s);
    this.recargar();
  }

  protected declarar(): void {
    const texto = this.declaracion().trim();
    if (texto === '') return;
    this.ejecutar('consentimiento', this.api.cumplirHito(this.id, 'CONSENTIMIENTO', null, texto), (s) => {
      this.declarando.set(false);
      this.declaracion.set('');
      this.aplicar(s);
    });
  }

  protected pedirPrecio(): void {
    this.ejecutar('precio', this.api.pedirCotizacion(this.id), () => {
      this.aviso.set('Pedimos el precio. Motoya te avisa cuando esté listo.');
      this.recargar();
    });
  }

  protected aceptarPrecio(): void {
    this.ejecutar('aceptar', this.api.aceptarPrecio(this.id), (s) => this.aplicar(s));
  }

  protected verCuotas(): void {
    this.ejecutar('cuotas', this.api.simular(this.id), (s) => this.simulacion.set(s));
  }

  protected evaluar(): void {
    this.ejecutar('evaluar', this.api.evaluar(this.id), (s) => this.aplicar(s));
  }

  protected formalizar(): void {
    this.ejecutar('formalizar', this.api.iniciarFormalizacion(this.id), (f) => {
      this.formalizacion.set(f);
      this.aplicar(f.seguimiento);
      if (!f.credito.contratoGenerado) {
        this.error.set('El crédito quedó formalizado, pero el documento del contrato todavía no se pudo armar: usa «Reintentar armar el contrato».');
      }
    });
  }

  protected generarContrato(): void {
    this.ejecutar('contrato', this.api.generarContrato(this.id), (f) => {
      this.formalizacion.set(f);
      this.aviso.set(f.credito.contratoGenerado ? 'Contrato generado.' : 'Todavía no se pudo armar el contrato.');
    });
  }

  /** Pide la póliza al servidor (la URL es temporal) y la abre; deja a la vista el número y la vigencia. */
  protected abrirPoliza(): void {
    this.ejecutar('poliza', this.api.poliza(this.id), (p) => {
      this.poliza.set(p);
      window.open(p.url, '_blank', 'noopener');
    });
  }

  protected verContrato(): void {
    this.ejecutar('ver-contrato', this.api.urlDelContrato(this.id), (r) => window.open(r.url, '_blank', 'noopener'));
  }

  /** Si el contrato ya se firmó pero el aviso no llegó, esto lo cumple: mira el estado real del contrato. */
  protected verificarFirma(): void {
    this.ejecutar('firma', this.api.sincronizarFirma(this.id), (f) => {
      this.formalizacion.set(f);
      this.aviso.set(f.seguimiento.hitosCumplidos.includes('CONTRATO_FIRMADO') ? 'El contrato está firmado.' : 'Todavía no figura firmado.');
      this.aplicar(f.seguimiento);
    });
  }

  protected cobrarContado(): void {
    this.ejecutar('cobrar', this.api.iniciarCobro(this.id, 'pago'), (i) => {
      this.instruccion.set(i);
      this.recargar();
    });
  }

  /** Abre el cobro de la inicial (repetirlo devuelve lo mismo) y muestra adónde depositar. */
  protected cobrarInicial(): void {
    this.ejecutar('cobrar-inicial', this.api.iniciarCobro(this.id, 'inicial'), (i) => {
      this.instruccion.set(i);
      this.recargarCobro();
    });
  }

  protected subirDocumento(hito: DocumentoDelCliente, event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    input.value = '';
    const s = this.seguimiento();
    if (!archivo || !s) return;
    this.ocupado.set(hito);
    this.error.set(null);
    this.documentos
      .subir({ tipo: TIPO_DM_DEL_DOCUMENTO[hito], archivo, propietarioId: this.id, entidadRelacionadaTipo: 'SOLICITUD_SOAT', entidadRelacionadaId: this.id, etiqueta: s.codigo })
      .subscribe({
        next: ({ documentoId }) => {
          this.ocupado.set(null);
          this.ejecutar(hito, this.api.cumplirHito(this.id, hito, documentoId, null), (n) => this.aplicar(n));
        },
        error: () => {
          this.ocupado.set(null);
          this.error.set('No se pudo subir el archivo. Inténtalo de nuevo.');
        }
      });
  }

  /** La foto del voucher: se sube a Document Management, se pide la lectura y se deja la confirmación a la persona (la lectura solo propone). */
  protected elegirVoucher(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    input.value = '';
    const s = this.seguimiento();
    if (!archivo || !s) return;
    this.ocupado.set('voucher');
    this.error.set(null);
    this.documentos
      .subir({ tipo: 'VOUCHER', archivo, propietarioId: this.id, entidadRelacionadaTipo: 'SOLICITUD_SOAT', entidadRelacionadaId: this.id, etiqueta: s.codigo })
      .subscribe({
        next: ({ documentoId }) => {
          this.voucherDocumentoId.set(documentoId);
          this.voucherMonto.set(String(this.instruccion()?.monto ?? this.cobro()?.montoEsperado ?? ''));
          this.api.leerVoucher(this.id, documentoId, this.tipoDeCobro()).subscribe({
            next: (l) => {
              this.ocupado.set(null);
              if (l.monto !== null) this.voucherMonto.set(String(l.monto));
              if (l.fechaOperacion) this.voucherFecha.set(l.fechaOperacion);
              this.voucherEntidad.set(l.entidad ?? '');
              this.voucherOperacion.set(l.numeroOperacion ?? '');
            },
            error: () => this.ocupado.set(null)
          });
        },
        error: () => {
          this.ocupado.set(null);
          this.error.set('No se pudo subir el voucher. Inténtalo de nuevo.');
        }
      });
  }

  protected readonly voucherListo = computed(
    () => this.voucherDocumentoId() !== null && Number(this.voucherMonto()) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(this.voucherFecha()) && this.voucherEntidad().trim() !== '' && this.voucherOperacion().trim() !== ''
  );

  protected enviarVoucher(): void {
    const documentoId = this.voucherDocumentoId();
    if (!documentoId || !this.voucherListo()) return;
    this.ejecutar(
      'enviar-voucher',
      this.api.registrarVoucher(
        this.id,
        { documentoId, monto: Number(this.voucherMonto()), fechaOperacion: this.voucherFecha(), entidad: this.voucherEntidad().trim(), numeroOperacion: this.voucherOperacion().trim() },
        this.tipoDeCobro()
      ),
      (c) => {
        this.cobro.set(c);
        this.voucherDocumentoId.set(null);
        this.aviso.set('Voucher enviado: Tesorería lo valida contra el banco.');
      }
    );
  }

  protected descartarVoucher(): void {
    this.voucherDocumentoId.set(null);
  }

  protected desistir(): void {
    const motivo = this.motivo().trim();
    if (motivo === '') return;
    this.ejecutar('desistir', this.api.desistir(this.id, motivo), (s) => {
      this.desistiendo.set(false);
      this.aplicar(s);
    });
  }

  protected textoDelEvento(e: EventoSolicitud): string {
    switch (e.tipo) {
      case 'SOLICITUD_REGISTRADA':
        return 'Solicitud registrada';
      case 'FASE_CAMBIADA':
        return e.faseNueva ? ESTADO_LABEL[e.faseNueva] : 'Cambio de etapa';
      case 'HITO_CUMPLIDO':
        return e.hito ? HITO_LABEL[e.hito] : 'Requisito cumplido';
      case 'HITO_REVOCADO':
        return e.hito ? `${HITO_LABEL[e.hito]} (anulado)` : 'Requisito anulado';
    }
  }

  protected motoDe(s: Seguimiento): string {
    return [s.marca, s.modelo].filter(Boolean).join(' ') || 'Sin datos de la moto';
  }
}
