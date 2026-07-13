import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, of, switchMap, throwError } from 'rxjs';

import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { OriginacionApiService } from '../../../../core/originacion/originacion-api.service';
import {
  ClienteResponse,
  HistorialSolicitudCliente,
  ReferenciaResponse,
  SolicitudCreditoResponse,
  TipoDocumentoIdentidad,
  VehiculoSolicitudResponse
} from '../../../../core/originacion/originacion.models';

type Paso = 'titular' | 'avalista' | 'vehiculo' | 'referencias' | 'revision' | 'completado';

const PASOS: { id: Paso; etiqueta: string; icono: string }[] = [
  { id: 'titular', etiqueta: 'Titular', icono: 'person' },
  { id: 'avalista', etiqueta: 'Aval', icono: 'shield_person' },
  { id: 'vehiculo', etiqueta: 'Moto', icono: 'two_wheeler' },
  { id: 'referencias', etiqueta: 'Referencias', icono: 'contacts' },
  { id: 'revision', etiqueta: 'Revisión', icono: 'fact_check' }
];

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
 * Wizard de originación (BC-01). Progresivo, no un formulario gigante que se
 * envía al final: cada paso llama al backend real apenas se completa (mismo
 * criterio que el propio modelo de datos — avalista/vehículo/referencias son
 * sub-recursos de una Solicitud que ya existe, no campos sueltos que se
 * junten recién al final).
 *
 * Alcance deliberado de este turno: canal siempre VENTA_DIRECTA (TIENDA_ALIADA
 * exige tiendaId, que hoy no se resuelve del lado del cliente — pendiente
 * cuando el claim de tienda esté disponible en el token). Sin captura de
 * documentos/fotos (StoragePort no existe todavía en motoya-api). El paso
 * final no dispara evaluación real — BC-02 no tiene backend — solo confirma
 * que la solicitud quedó registrada.
 *
 * Antifraude/continuidad: al resolver el titular se consulta su historial
 * (incluye solicitudes migradas de Firestore); al agregar el aval se
 * consulta si hay relación circular titular↔aval (A tuvo a B de aval, B
 * ahora pide crédito con A de aval). Ambas consultas son informativas — se
 * muestran como aviso, nunca bloquean el wizard, la decisión es del
 * ejecutivo.
 */
@Component({
  selector: 'mt-solicitud-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    IconComponent,
    InputComponent,
    SelectComponent
  ],
  templateUrl: './solicitud.component.html',
  styleUrl: './solicitud.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SolicitudComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(OriginacionApiService);

  protected readonly pasos = PASOS;
  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly relaciones = RELACIONES;

  protected readonly paso = signal<Paso>('titular');
  protected readonly pasoIndex = computed(() => this.pasos.findIndex((p) => p.id === this.paso()));

  protected readonly titular = signal<ClienteResponse | null>(null);
  protected readonly solicitud = signal<SolicitudCreditoResponse | null>(null);
  protected readonly quiereAvalista = signal(true);
  protected readonly avalista = signal<{ cliente: ClienteResponse; relacion: string } | null>(null);
  protected readonly vehiculo = signal<VehiculoSolicitudResponse | null>(null);
  protected readonly referencias = signal<ReferenciaResponse[]>([]);

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mostrarFormReferencia = signal(true);

  // Antifraude/continuidad (BC-01) — solo informativo, nunca bloquean el
  // wizard: decide el ejecutivo. historialTitular se consulta al avanzar de
  // 'titular' (con el documento ya resuelto); relacionCircularDetectada al
  // avanzar de 'avalista' (con ambos clientes ya resueltos).
  protected readonly historialTitular = signal<HistorialSolicitudCliente[]>([]);
  protected readonly relacionCircularDetectada = signal(false);

  protected readonly formTitular = this.fb.nonNullable.group({
    tipoDocumento: ['DNI' as TipoDocumentoIdentidad, Validators.required],
    numeroDocumento: ['', Validators.required],
    nombres: ['', Validators.required],
    apellidoPaterno: ['', Validators.required],
    apellidoMaterno: ['', Validators.required],
    telefono: [''],
    email: ['', Validators.email],
    departamento: [''],
    provincia: [''],
    distrito: [''],
    direccion: ['']
  });

  protected readonly formAvalista = this.fb.nonNullable.group({
    tipoDocumento: ['DNI' as TipoDocumentoIdentidad, Validators.required],
    numeroDocumento: ['', Validators.required],
    nombres: ['', Validators.required],
    apellidoPaterno: ['', Validators.required],
    apellidoMaterno: ['', Validators.required],
    telefono: [''],
    relacion: ['Padre/Madre', Validators.required]
  });

  protected readonly formVehiculo = this.fb.nonNullable.group({
    marca: ['', Validators.required],
    modelo: ['', Validators.required],
    anio: [new Date().getFullYear(), [Validators.required, Validators.min(1990)]],
    color: [''],
    placa: [''],
    precioVehiculo: [0, [Validators.required, Validators.min(1)]]
  });

  protected readonly formReferencia = this.fb.nonNullable.group({
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    telefono: ['', Validators.required],
    relacion: ['Amigo(a)', Validators.required]
  });

  protected readonly puedeAgregarReferencia = computed(() => this.referencias().length < 3);
  protected readonly puedeContinuarReferencias = computed(() => this.referencias().length >= 1);

  continuarTitular(): void {
    if (this.formTitular.invalid) {
      this.formTitular.markAllAsTouched();
      return;
    }
    const datos = this.formTitular.getRawValue();
    this.guardando.set(true);
    this.error.set(null);

    this.api
      .buscarClientePorDocumento(datos.tipoDocumento, datos.numeroDocumento)
      .pipe(
        catchError((err: HttpErrorResponse) =>
          err.status === 404 ? this.api.crearCliente(datos) : throwError(() => err)
        ),
        switchMap((cliente) =>
          this.api
            .crearSolicitud({ canal: 'VENTA_DIRECTA', titularId: cliente.id, documentosMinimosCompletos: true })
            .pipe(switchMap((solicitud) => of({ cliente, solicitud })))
        )
      )
      .subscribe({
        next: ({ cliente, solicitud }) => {
          this.titular.set(cliente);
          this.solicitud.set(solicitud);
          this.guardando.set(false);
          this.paso.set('avalista');
          this.cargarHistorialTitular(cliente.tipoDocumento, cliente.numeroDocumento);
        },
        error: (err: HttpErrorResponse) => this.manejarError(err)
      });
  }

  /** No bloquea el avance del wizard — si la consulta falla, simplemente no se muestra el aviso. */
  private cargarHistorialTitular(tipoDocumento: TipoDocumentoIdentidad, numeroDocumento: string): void {
    this.api.verificarHistorial(tipoDocumento, numeroDocumento).subscribe({
      next: (historial) => this.historialTitular.set(historial),
      error: () => this.historialTitular.set([])
    });
  }

  omitirAvalista(): void {
    this.quiereAvalista.set(false);
    this.paso.set('vehiculo');
  }

  activarAvalista(): void {
    this.quiereAvalista.set(true);
  }

  continuarAvalista(): void {
    if (this.formAvalista.invalid) {
      this.formAvalista.markAllAsTouched();
      return;
    }
    const solicitud = this.solicitud();
    if (!solicitud) return;

    const datos = this.formAvalista.getRawValue();
    this.guardando.set(true);
    this.error.set(null);

    this.api
      .buscarClientePorDocumento(datos.tipoDocumento, datos.numeroDocumento)
      .pipe(catchError((err: HttpErrorResponse) => (err.status === 404 ? this.api.crearCliente(datos) : throwError(() => err))))
      .pipe(
        switchMap((cliente) =>
          this.api
            .agregarAvalista(solicitud.id, { clienteId: cliente.id, relacion: datos.relacion })
            .pipe(switchMap(() => of(cliente)))
        )
      )
      .subscribe({
        next: (cliente) => {
          this.avalista.set({ cliente, relacion: datos.relacion });
          this.guardando.set(false);
          this.paso.set('vehiculo');
          this.verificarRelacionCircularAvalista(cliente.id);
        },
        error: (err: HttpErrorResponse) => this.manejarError(err)
      });
  }

  /** No bloquea el avance del wizard — si la consulta falla, simplemente no se muestra el aviso. */
  private verificarRelacionCircularAvalista(clienteAvalistaId: string): void {
    const titular = this.titular();
    if (!titular) return;
    this.api.verificarRelacionCircular(titular.id, clienteAvalistaId).subscribe({
      next: (existe) => this.relacionCircularDetectada.set(existe),
      error: () => this.relacionCircularDetectada.set(false)
    });
  }

  continuarVehiculo(): void {
    if (this.formVehiculo.invalid) {
      this.formVehiculo.markAllAsTouched();
      return;
    }
    const solicitud = this.solicitud();
    if (!solicitud) return;

    this.guardando.set(true);
    this.error.set(null);

    this.api.agregarVehiculo(solicitud.id, this.formVehiculo.getRawValue()).subscribe({
      next: (vehiculo) => {
        this.vehiculo.set(vehiculo);
        this.guardando.set(false);
        this.paso.set('referencias');
      },
      error: (err: HttpErrorResponse) => this.manejarError(err)
    });
  }

  agregarReferencia(): void {
    if (this.formReferencia.invalid) {
      this.formReferencia.markAllAsTouched();
      return;
    }
    const solicitud = this.solicitud();
    if (!solicitud) return;

    const numero = this.referencias().length + 1;
    const datos = { ...this.formReferencia.getRawValue(), numero };
    this.guardando.set(true);
    this.error.set(null);

    this.api.agregarReferencia(solicitud.id, datos).subscribe({
      next: (referencia) => {
        this.referencias.update((lista) => [...lista, referencia]);
        this.formReferencia.reset({ nombres: '', apellidos: '', telefono: '', relacion: 'Amigo(a)' });
        this.guardando.set(false);
        this.mostrarFormReferencia.set(this.referencias().length < 3);
      },
      error: (err: HttpErrorResponse) => this.manejarError(err)
    });
  }

  continuarReferencias(): void {
    if (!this.puedeContinuarReferencias()) return;
    this.paso.set('revision');
  }

  finalizar(): void {
    this.paso.set('completado');
  }

  nuevaSolicitud(): void {
    this.titular.set(null);
    this.solicitud.set(null);
    this.quiereAvalista.set(true);
    this.avalista.set(null);
    this.vehiculo.set(null);
    this.referencias.set([]);
    this.error.set(null);
    this.historialTitular.set([]);
    this.relacionCircularDetectada.set(false);
    this.formTitular.reset({ tipoDocumento: 'DNI' });
    this.formAvalista.reset({ tipoDocumento: 'DNI', relacion: 'Padre/Madre' });
    this.formVehiculo.reset({ anio: new Date().getFullYear() });
    this.formReferencia.reset({ relacion: 'Amigo(a)' });
    this.mostrarFormReferencia.set(true);
    this.paso.set('titular');
  }

  irAPaso(destino: Paso): void {
    const destinoIndex = this.pasos.findIndex((p) => p.id === destino);
    if (destinoIndex >= 0 && destinoIndex < this.pasoIndex()) {
      this.paso.set(destino);
    }
  }

  private manejarError(err: HttpErrorResponse): void {
    this.guardando.set(false);
    const detalle = typeof err.error === 'object' && err.error && 'detail' in err.error ? String(err.error.detail) : null;
    this.error.set(detalle ?? 'No se pudo guardar. Verifica los datos e intenta nuevamente.');
  }
}
