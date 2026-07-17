import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap, tap, throwError } from 'rxjs';

import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { Coordenadas, DireccionParseada, GpsPickerComponent } from '../../../../shared/ui/gps-picker/gps-picker.component';
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
 * Alcance deliberado de este turno: canal siempre TIENDA_ALIADA (el vendedor
 * que usa este wizard siempre opera desde una sesión de tienda; tiendaId lo
 * resuelve el backend desde la sesión, nunca este componente — ver
 * SolicitudCreditoController.crear()). Sin captura de documentos/fotos
 * (StoragePort no existe todavía en motoya-api). El paso final no dispara
 * evaluación real — BC-02 no tiene backend — solo confirma que la solicitud
 * quedó registrada.
 *
 * Aval: por regulación pasó a ser siempre obligatorio (ya no se puede omitir
 * el paso) — titular y aval capturan la misma dirección+GPS de vivienda vía
 * mt-gps-picker.
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
    GpsPickerComponent,
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
  protected readonly avalista = signal<{ cliente: ClienteResponse; relacion: string } | null>(null);
  protected readonly vehiculo = signal<VehiculoSolicitudResponse | null>(null);
  protected readonly referencias = signal<ReferenciaResponse[]>([]);

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mostrarFormReferencia = signal(true);

  // Feedback del lookup de DNI/CEE (json.pe) — antes fallaba en silencio
  // (catchError descartaba cualquier error) y no había ninguna señal de
  // carga, así que el vendedor no tenía forma de saber si estaba buscando,
  // si no encontró el documento, o si el servicio falló.
  protected readonly buscandoDniTitular = signal(false);
  protected readonly errorDniTitular = signal<string | undefined>(undefined);
  protected readonly buscandoDniAvalista = signal(false);
  protected readonly errorDniAvalista = signal<string | undefined>(undefined);

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
    direccion: [''],
    latitud: [null as number | null],
    longitud: [null as number | null]
  });

  protected readonly formAvalista = this.fb.nonNullable.group({
    tipoDocumento: ['DNI' as TipoDocumentoIdentidad, Validators.required],
    numeroDocumento: ['', Validators.required],
    nombres: ['', Validators.required],
    apellidoPaterno: ['', Validators.required],
    apellidoMaterno: ['', Validators.required],
    telefono: [''],
    departamento: [''],
    provincia: [''],
    distrito: [''],
    direccion: [''],
    latitud: [null as number | null],
    longitud: [null as number | null],
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

  constructor() {
    this.configurarLookupTitular();
    this.configurarLookupAvalista();
  }

  /**
   * Autocompleta nombres/apellidos vía json.pe (DNI o CEE, según
   * tipoDocumento) al escribir el número de documento — evita errores de
   * tipeo. Nunca bloquea: si json.pe no responde o no encuentra el
   * documento, el ejecutivo sigue pudiendo tipear todo a mano.
   */
  private configurarLookupTitular(): void {
    this.formTitular.controls.numeroDocumento.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        filter((numero) => numero.trim().length >= 8),
        tap(() => {
          this.buscandoDniTitular.set(true);
          this.errorDniTitular.set(undefined);
        }),
        switchMap((numero) => {
          const tipo = this.formTitular.controls.tipoDocumento.value;
          const lookup$ = tipo === 'DNI' ? this.api.consultarDni(numero) : this.api.consultarCee(numero);
          return lookup$.pipe(
            map((resultado) => ({ resultado, error: undefined as string | undefined })),
            catchError((err: HttpErrorResponse) => of({ resultado: null, error: this.mensajeErrorLookup(err) }))
          );
        })
      )
      .subscribe(({ resultado, error }) => {
        this.buscandoDniTitular.set(false);
        if (error) {
          this.errorDniTitular.set(error);
          return;
        }
        if (!resultado) return;
        this.formTitular.patchValue({
          nombres: resultado.nombres,
          apellidoPaterno: resultado.apellidoPaterno,
          apellidoMaterno: resultado.apellidoMaterno
        });
      });
  }

  private configurarLookupAvalista(): void {
    this.formAvalista.controls.numeroDocumento.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        filter((numero) => numero.trim().length >= 8),
        tap(() => {
          this.buscandoDniAvalista.set(true);
          this.errorDniAvalista.set(undefined);
        }),
        switchMap((numero) => {
          const tipo = this.formAvalista.controls.tipoDocumento.value;
          const lookup$ = tipo === 'DNI' ? this.api.consultarDni(numero) : this.api.consultarCee(numero);
          return lookup$.pipe(
            map((resultado) => ({ resultado, error: undefined as string | undefined })),
            catchError((err: HttpErrorResponse) => of({ resultado: null, error: this.mensajeErrorLookup(err) }))
          );
        })
      )
      .subscribe(({ resultado, error }) => {
        this.buscandoDniAvalista.set(false);
        if (error) {
          this.errorDniAvalista.set(error);
          return;
        }
        if (!resultado) return;
        this.formAvalista.patchValue({
          nombres: resultado.nombres,
          apellidoPaterno: resultado.apellidoPaterno,
          apellidoMaterno: resultado.apellidoMaterno
        });
      });
  }

  /** Nunca bloquea: el ejecutivo siempre puede tipear nombres/apellidos a mano. */
  private mensajeErrorLookup(err: HttpErrorResponse): string {
    if (err.status === 404) return 'No se encontró ese documento. Completa los datos manualmente.';
    if (err.status === 403) return 'Tu usuario no tiene permiso para consultar documentos. Completa los datos manualmente.';
    return 'No pudimos verificar el documento ahora. Completa los datos manualmente.';
  }

  protected onDireccionTitularParsed(data: DireccionParseada): void {
    this.formTitular.patchValue(data);
  }

  protected onCoordenadasTitular(coords: Coordenadas): void {
    this.formTitular.patchValue({ latitud: coords.latitud, longitud: coords.longitud });
  }

  protected onDireccionAvalistaParsed(data: DireccionParseada): void {
    this.formAvalista.patchValue(data);
  }

  protected onCoordenadasAvalista(coords: Coordenadas): void {
    this.formAvalista.patchValue({ latitud: coords.latitud, longitud: coords.longitud });
  }

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
        // Se llama siempre (cliente creado o encontrado) — crearCliente no es
        // find-or-create, así que si el documento ya existía la dirección/GPS
        // tipeada en esta corrida del wizard se perdía sin este paso.
        switchMap((cliente) =>
          this.api.actualizarDireccionCliente(cliente.id, {
            departamento: datos.departamento,
            provincia: datos.provincia,
            distrito: datos.distrito,
            direccion: datos.direccion,
            latitud: datos.latitud,
            longitud: datos.longitud
          })
        ),
        switchMap((cliente) =>
          this.api
            .crearSolicitud({ canal: 'TIENDA_ALIADA', titularId: cliente.id, documentosMinimosCompletos: true })
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
          this.api.actualizarDireccionCliente(cliente.id, {
            departamento: datos.departamento,
            provincia: datos.provincia,
            distrito: datos.distrito,
            direccion: datos.direccion,
            latitud: datos.latitud,
            longitud: datos.longitud
          })
        ),
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
    this.avalista.set(null);
    this.vehiculo.set(null);
    this.referencias.set([]);
    this.error.set(null);
    this.historialTitular.set([]);
    this.relacionCircularDetectada.set(false);
    this.errorDniTitular.set(undefined);
    this.errorDniAvalista.set(undefined);
    this.formTitular.reset({ tipoDocumento: 'DNI', latitud: null, longitud: null });
    this.formAvalista.reset({ tipoDocumento: 'DNI', relacion: 'Padre/Madre', latitud: null, longitud: null });
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
