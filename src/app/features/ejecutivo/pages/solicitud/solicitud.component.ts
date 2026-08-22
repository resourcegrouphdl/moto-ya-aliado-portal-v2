import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, filter, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';

import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { Coordenadas, DireccionParseada, GpsPickerComponent } from '../../../../shared/ui/gps-picker/gps-picker.component';
import {
  DocumentoIdentidadExtraido,
  DocumentoIdentidadUploadComponent
} from '../../../../shared/ui/documento-identidad-upload/documento-identidad-upload.component';
import { DocumentoUploadComponent } from '../../../../shared/ui/documento-upload/documento-upload.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { DateInputComponent } from '../../../../shared/ui/date-input/date-input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { VerificacionEmailComponent } from '../../../../shared/ui/verificacion-email/verificacion-email.component';
import { ModalService } from '../../../../shared/ui/modal/modal.service';
import { PreCalificacionAlertDialogComponent } from '../../../../shared/ui/modal/pre-calificacion-alert-dialog.component';
import { OriginacionApiService } from '../../../../core/originacion/originacion-api.service';
import { PreCalificacionApiService } from '../../../../core/riesgo/precalificacion-api.service';
import { ResultadoPreCalificacion } from '../../../../core/riesgo/precalificacion.models';
import {
  ClienteResponse,
  DOCUMENTOS_AVALISTA,
  DOCUMENTOS_TITULAR,
  DocumentoSolicitudResponse,
  ESTADO_CIVIL_LABEL,
  EstadoCivil,
  ExpedienteSolicitudResponse,
  HistorialSolicitudCliente,
  NACIONALIDAD_LABEL,
  Nacionalidad,
  ReferenciaResponse,
  SolicitudCreditoResponse,
  TipoDocumentoIdentidad,
  TipoDocumentoSolicitud,
  VehiculoSolicitudResponse
} from '../../../../core/originacion/originacion.models';

type Paso =
  | 'titular'
  | 'documentos-titular'
  | 'avalista'
  | 'documentos-avalista'
  | 'vehiculo'
  | 'referencias'
  | 'revision'
  | 'completado';

const PASOS: { id: Paso; etiqueta: string; icono: string }[] = [
  { id: 'titular', etiqueta: 'Titular', icono: 'person' },
  { id: 'documentos-titular', etiqueta: 'Docs. titular', icono: 'upload_file' },
  { id: 'avalista', etiqueta: 'Aval', icono: 'shield_person' },
  { id: 'documentos-avalista', etiqueta: 'Docs. aval', icono: 'upload_file' },
  { id: 'vehiculo', etiqueta: 'Moto', icono: 'two_wheeler' },
  { id: 'referencias', etiqueta: 'Referencias', icono: 'contacts' },
  { id: 'revision', etiqueta: 'Revisión', icono: 'fact_check' }
];

const TIPOS_DOCUMENTO: SelectOption<TipoDocumentoIdentidad>[] = [
  { label: 'DNI', value: 'DNI' },
  { label: 'Carné de extranjería', value: 'CARNET_EXTRANJERIA' }
];

/** Mismas opciones/monto que la calculadora (`calculadora.component.ts`) — mismo criterio de duplicado a propósito, sin endpoint de solo lectura para /partner que exponga el monto real. */
const SOAT_OPTIONS: SelectOption<boolean>[] = [
  { label: 'Sí, incluir SOAT (S/ 750)', value: true },
  { label: 'No, el cliente ya lo tiene', value: false }
];

const NACIONALIDAD_OPTIONS: SelectOption<Nacionalidad>[] = Object.entries(NACIONALIDAD_LABEL).map(([value, label]) => ({
  value: value as Nacionalidad,
  label
}));

const ESTADO_CIVIL_OPTIONS: SelectOption<EstadoCivil>[] = Object.entries(ESTADO_CIVIL_LABEL).map(([value, label]) => ({
  value: value as EstadoCivil,
  label
}));

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
 * SolicitudCreditoController.crear()). El paso final no dispara evaluación
 * real — BC-02 no tiene backend — solo confirma que la solicitud quedó
 * registrada.
 *
 * Fecha de nacimiento / nacionalidad (2026-07-20): json.pe (DNI/CEE) no las
 * provee, se capturan a mano. La edad se muestra en vivo en cuanto se elige
 * la fecha (edadDe(...)) para que el vendedor nunca tenga que restar años.
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
 *
 * Documentos KYC (2026-07-20): paso dedicado tras titular y tras aval —
 * portado del formulario legacy (DNI frente/reverso, licencia, selfie,
 * certificado laboral, recibo de servicio, fachada, 2 slots "otros"; SELFIE
 * no aplica al aval). Subida directa a GCS vía signed URL, mismo patrón que
 * los documentos de contrato (BC-03). Opcional, no bloquea el avance del
 * wizard — el vendedor puede completarlos después si no los tiene a mano.
 *
 * OCR de identidad (2026-07-20): al tope de los pasos 'titular'/'avalista'
 * hay un widget que sube la foto del DNI/carné ANTES de crear el cliente
 * (staging, sin solicitudId) y la manda a Document AI para prellenar
 * numeroDocumento/fechaNacimiento/nacionalidad — el patch de numeroDocumento
 * dispara solo el lookup de json.pe ya existente (mismo valueChanges de
 * siempre). Es puro best-effort: campos no reconocidos quedan en null, el
 * formulario sigue 100% editable. La foto ya subida se registra sola como
 * DNI_FRENTE en cuanto se crea la solicitud (ver registrarFotoIdentidad*Titular/
 * Avalista), así el vendedor no la vuelve a subir en el paso de documentos.
 *
 * Modo "continuar" (2026-08-04): si la ruta trae un :id (ver
 * ejecutivo/solicitud/:id/continuar), este mismo wizard precarga el
 * expediente existente en vez de arrancar en 'titular' — antes la única
 * pantalla para retomar una solicitud INCOMPLETA era SolicitudDetailComponent,
 * que no tiene formularios para agregar lo que falta (vehículo/referencias/
 * documentos si el vendedor abandonó antes de llegar ahí), dejando la
 * solicitud sin forma real de completarse. cargarExpediente() reutiliza la
 * misma rama "ya existe, actualizar en vez de crear" que cada continuar*()
 * ya tenía para cuando el vendedor retrocedía un paso dentro de la misma
 * corrida — no fue necesario tocar esos métodos.
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
    DocumentoIdentidadUploadComponent,
    DocumentoUploadComponent,
    IconComponent,
    InputComponent,
    DateInputComponent,
    SelectComponent,
    VerificacionEmailComponent
  ],
  templateUrl: './solicitud.component.html',
  styleUrl: './solicitud.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SolicitudComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(OriginacionApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly preCalificacionApi = inject(PreCalificacionApiService);
  private readonly modalService = inject(ModalService);

  protected readonly pasos = PASOS;
  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly relaciones = RELACIONES;
  protected readonly nacionalidades = NACIONALIDAD_OPTIONS;
  protected readonly estadosCiviles = ESTADO_CIVIL_OPTIONS;
  protected readonly soatOptions = SOAT_OPTIONS;
  protected readonly slotsDocumentosTitular = DOCUMENTOS_TITULAR;
  protected readonly slotsDocumentosAvalista = DOCUMENTOS_AVALISTA;

  protected readonly paso = signal<Paso>('titular');
  protected readonly pasoIndex = computed(() => this.pasos.findIndex((p) => p.id === this.paso()));

  protected readonly titular = signal<ClienteResponse | null>(null);
  protected readonly solicitud = signal<SolicitudCreditoResponse | null>(null);
  protected readonly avalista = signal<{ cliente: ClienteResponse; relacion: string } | null>(null);
  protected readonly vehiculo = signal<VehiculoSolicitudResponse | null>(null);
  protected readonly referencias = signal<ReferenciaResponse[]>([]);
  protected readonly documentosTitular = signal<DocumentoSolicitudResponse[]>([]);
  protected readonly documentosAvalista = signal<DocumentoSolicitudResponse[]>([]);

  // Foto del DNI/carné subida a staging por mt-documento-identidad-upload
  // ANTES de crear el cliente — se guarda acá para registrarla como
  // DNI_FRENTE en cuanto exista la solicitud (ver continuarTitular/Avalista).
  protected readonly fotoIdentidadTitularUrl = signal<string | null>(null);
  protected readonly fotoIdentidadAvalistaUrl = signal<string | null>(null);

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mostrarFormReferencia = signal(true);

  // Modo "continuar" (retomar una solicitud INCOMPLETA existente) — ver
  // docblock de la clase. cargandoExpediente cubre solo la precarga inicial,
  // nunca el guardando normal de cada paso.
  protected readonly modoContinuar = signal(false);
  protected readonly cargandoExpediente = signal(false);

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

  // Pre-calificación temprana (2026-08-14) — a diferencia del historial/relación circular de arriba, ESTA sí
  // puede bloquear el avance (zona ROJO, ver zonaBloqueaAvance()): es "nuestro primer filtro" según el negocio,
  // no un simple aviso informativo. Se resetea cada vez que el titular cambia el número de documento, para nunca
  // quedar bloqueado por el resultado de un documento distinto al que está tipeado ahora.
  protected readonly preCalificacionTitular = signal<ResultadoPreCalificacion | null>(null);
  protected readonly evaluandoPreCalificacionTitular = signal(false);
  protected readonly zonaBloqueaAvanceTitular = computed(() => this.preCalificacionTitular()?.zona === 'ROJO');

  // Mismo patrón para el aval (2026-08-14) — misma zona ROJO bloquea, pero la salida es distinta: acá el vendedor
  // puede cambiar el número de documento del aval e intentar con otro, sin tocar nada del titular.
  protected readonly preCalificacionAvalista = signal<ResultadoPreCalificacion | null>(null);
  protected readonly evaluandoPreCalificacionAvalista = signal(false);
  protected readonly zonaBloqueaAvanceAvalista = computed(() => this.preCalificacionAvalista()?.zona === 'ROJO');

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
    direccionSugerida: [''],
    latitud: [null as number | null],
    longitud: [null as number | null],
    fechaNacimiento: [''],
    nacionalidad: ['PERU' as Nacionalidad],
    estadoCivil: [null as EstadoCivil | null]
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
    direccionSugerida: [''],
    latitud: [null as number | null],
    longitud: [null as number | null],
    fechaNacimiento: [''],
    nacionalidad: ['PERU' as Nacionalidad],
    estadoCivil: [null as EstadoCivil | null],
    relacion: ['Padre/Madre', Validators.required]
  });

  // Puentea el FormControl reactivo a una signal — bajo OnPush, leer
  // formTitular.value.direccion directamente en el template no se refresca
  // en cada tecla porque el evento nace dentro de mt-input, no en esta vista.
  protected readonly direccionTitularTexto = toSignal(this.formTitular.controls.direccion.valueChanges, { initialValue: '' });
  protected readonly direccionAvalistaTexto = toSignal(this.formAvalista.controls.direccion.valueChanges, { initialValue: '' });

  // Verificación de correo (2026-08-16, solo titular — ver docblock de la clase). Enforcement de frontend: si el
  // vendedor tecleó un correo, correoVerificado debe quedar true antes de poder continuar (ver continuarTitular()).
  protected readonly emailTitularTexto = toSignal(this.formTitular.controls.email.valueChanges, { initialValue: '' });
  protected readonly correoVerificado = signal(false);
  protected readonly correoTitularPendienteDeVerificar = computed(
    () => !!this.emailTitularTexto()?.trim() && !this.correoVerificado()
  );

  // Edad en vivo: se recalcula apenas el vendedor elige la fecha, sin esperar
  // el round-trip al backend (que también la calcula, para cuando se recarga
  // el expediente después).
  protected readonly fechaNacimientoTitularTexto = toSignal(this.formTitular.controls.fechaNacimiento.valueChanges, {
    initialValue: ''
  });
  protected readonly fechaNacimientoAvalistaTexto = toSignal(this.formAvalista.controls.fechaNacimiento.valueChanges, {
    initialValue: ''
  });
  protected readonly edadTitular = computed(() => this.edadDe(this.fechaNacimientoTitularTexto()));
  protected readonly edadAvalista = computed(() => this.edadDe(this.fechaNacimientoAvalistaTexto()));

  protected nacionalidadLabel(nacionalidad: Nacionalidad | null | undefined): string {
    return nacionalidad ? NACIONALIDAD_LABEL[nacionalidad] : '—';
  }

  protected estadoCivilLabel(estadoCivil: EstadoCivil | null | undefined): string {
    return estadoCivil ? ESTADO_CIVIL_LABEL[estadoCivil] : '—';
  }

  /**
   * `new Date(fechaIso)` interpreta "YYYY-MM-DD" (LocalDate, sin hora) como medianoche UTC -- en Perú
   * (UTC-5) eso corresponde al día anterior en hora local, así que `getDate()`/`getMonth()` podían leer
   * un día menos. Justo en el borde del cumpleaños eso hacía contar un año de más o de menos. Se extraen
   * año/mes/día directo del string, sin pasar por Date/UTC.
   */
  private edadDe(fechaIso: string): number | null {
    if (!fechaIso) return null;
    const [anioNac, mesNac, diaNac] = fechaIso.split('-').map(Number);
    if (!anioNac || !mesNac || !diaNac) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - anioNac;
    const aunNoCumpleEsteAnio = hoy.getMonth() + 1 < mesNac || (hoy.getMonth() + 1 === mesNac && hoy.getDate() < diaNac);
    if (aunNoCumpleEsteAnio) edad--;
    return edad;
  }

  protected readonly formVehiculo = this.fb.nonNullable.group({
    marca: ['', Validators.required],
    modelo: ['', Validators.required],
    anio: [new Date().getFullYear(), [Validators.required, Validators.min(1990)]],
    color: [''],
    placa: [''],
    numeroMotor: [''],
    numeroChasis: [''],
    precioVehiculo: [0, [Validators.required, Validators.min(1)]],
    inicialIngresada: this.fb.control<number | null>(null),
    numeroPeriodos: this.fb.control<number | null>(null),
    incluyeSoat: [false, Validators.required]
  });

  protected readonly formReferencia = this.fb.nonNullable.group({
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    telefono: ['', Validators.required],
    relacion: ['Amigo(a)', Validators.required]
  });

  /** Mínimo 2, máximo 3 — Riesgo (BC-02) necesita poder verificar al menos 2 antes de aprobar, ver expediente-detail (admin-v2). */
  protected readonly puedeAgregarReferencia = computed(() => this.referencias().length < 3);
  protected readonly puedeContinuarReferencias = computed(() => this.referencias().length >= 2);

  constructor() {
    this.configurarLookupTitular();
    this.configurarLookupAvalista();
    this.configurarPreCalificacionTitular();
    this.configurarPreCalificacionAvalista();

    const idExistente = this.route.snapshot.paramMap.get('id');
    if (idExistente) {
      this.modoContinuar.set(true);
      this.cargarExpediente(idExistente);
    }
  }

  /** Precarga titular/aval/vehículo/referencias/documentos de una solicitud INCOMPLETA existente y posiciona el wizard en el primer paso que falta. */
  private cargarExpediente(solicitudId: string): void {
    this.cargandoExpediente.set(true);
    this.error.set(null);

    forkJoin({
      expediente: this.api.obtenerExpediente(solicitudId),
      documentos: this.api.listarDocumentos(solicitudId)
    }).subscribe({
      next: ({ expediente, documentos }) => {
        this.aplicarExpediente(expediente, documentos);
        this.cargandoExpediente.set(false);
      },
      error: () => {
        this.cargandoExpediente.set(false);
        this.error.set('No se pudo cargar la solicitud. Intenta de nuevo.');
      }
    });
  }

  private aplicarExpediente(expediente: ExpedienteSolicitudResponse, documentos: DocumentoSolicitudResponse[]): void {
    const { solicitud, titular, avalista, avalistaRelacion, vehiculo, referencias } = expediente;

    this.solicitud.set(solicitud);
    this.titular.set(titular);
    this.formTitular.patchValue({
      tipoDocumento: titular.tipoDocumento,
      numeroDocumento: titular.numeroDocumento,
      nombres: titular.nombres,
      apellidoPaterno: titular.apellidoPaterno,
      apellidoMaterno: titular.apellidoMaterno,
      telefono: titular.telefono ?? '',
      email: titular.email ?? '',
      departamento: titular.departamento ?? '',
      provincia: titular.provincia ?? '',
      distrito: titular.distrito ?? '',
      direccion: titular.direccion ?? '',
      direccionSugerida: titular.direccionSugerida ?? '',
      latitud: titular.latitud,
      longitud: titular.longitud,
      fechaNacimiento: titular.fechaNacimiento ?? '',
      nacionalidad: titular.nacionalidad ?? 'PERU',
      estadoCivil: titular.estadoCivil
    });

    this.documentosTitular.set(documentos.filter((d) => d.rol === 'TITULAR'));
    this.documentosAvalista.set(documentos.filter((d) => d.rol === 'AVALISTA'));
    this.cargarHistorialTitular(titular.tipoDocumento, titular.numeroDocumento);

    if (avalista) {
      this.avalista.set({ cliente: avalista, relacion: avalistaRelacion ?? '' });
      this.formAvalista.patchValue({
        tipoDocumento: avalista.tipoDocumento,
        numeroDocumento: avalista.numeroDocumento,
        nombres: avalista.nombres,
        apellidoPaterno: avalista.apellidoPaterno,
        apellidoMaterno: avalista.apellidoMaterno,
        telefono: avalista.telefono ?? '',
        departamento: avalista.departamento ?? '',
        provincia: avalista.provincia ?? '',
        distrito: avalista.distrito ?? '',
        direccion: avalista.direccion ?? '',
        direccionSugerida: avalista.direccionSugerida ?? '',
        latitud: avalista.latitud,
        longitud: avalista.longitud,
        fechaNacimiento: avalista.fechaNacimiento ?? '',
        nacionalidad: avalista.nacionalidad ?? 'PERU',
        estadoCivil: avalista.estadoCivil,
        relacion: avalistaRelacion ?? 'Padre/Madre'
      });
      this.verificarRelacionCircularAvalista(avalista.id);
    }

    if (vehiculo) {
      this.vehiculo.set(vehiculo);
      this.formVehiculo.patchValue({
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        anio: vehiculo.anio,
        color: vehiculo.color ?? '',
        placa: vehiculo.placa ?? '',
        numeroMotor: vehiculo.numeroMotor ?? '',
        numeroChasis: vehiculo.numeroChasis ?? '',
        precioVehiculo: vehiculo.precioVehiculo,
        inicialIngresada: vehiculo.inicialIngresada ?? null,
        numeroPeriodos: vehiculo.numeroPeriodos ?? null,
        incluyeSoat: vehiculo.incluyeSoat
      });
    }

    this.referencias.set(referencias);
    this.mostrarFormReferencia.set(referencias.length < 3);

    this.paso.set(this.primerPasoIncompleto(avalista !== null, vehiculo !== null, referencias.length));
  }

  private primerPasoIncompleto(tieneAvalista: boolean, tieneVehiculo: boolean, cantidadReferencias: number): Paso {
    // Documentos-titular/documentos-avalista nunca bloquean el avance (ver
    // continuarDocumentos*() más abajo) — mismo criterio acá, no se
    // consideran para decidir dónde retomar.
    if (!tieneAvalista) return 'avalista';
    if (!tieneVehiculo) return 'vehiculo';
    if (cantidadReferencias < 2) return 'referencias';
    return 'revision';
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

  /**
   * Pre-calificación temprana (2026-08-14) — al obtener el DNI del titular (mismo trigger que el lookup de
   * json.pe arriba, debounce independiente sobre el mismo `valueChanges`), consulta Equifax y evalúa el semáforo
   * ANTES de que el ejecutivo invierta tiempo en KYC completo (7+ documentos, avalista, referencias). Solo aplica
   * al titular — el avalista no financia el vehículo, no tiene sentido pre-calificarlo con el mismo criterio (ver
   * REGLAS_AVAL en el motor de riesgo real, que ya excluye capacidad de pago para el aval).
   *
   * <p>Si Equifax falla o el módulo no está disponible, nunca bloquea — igual criterio que el lookup de json.pe:
   * el ejecutivo sigue el flujo normal, sin ningún aviso (más seguro fallar "abierto" acá que trabar una venta por
   * un problema de la integración, no del cliente).
   */
  private configurarPreCalificacionTitular(): void {
    this.formTitular.controls.numeroDocumento.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        filter((numero) => numero.trim().length >= 8),
        tap(() => {
          this.preCalificacionTitular.set(null);
          this.evaluandoPreCalificacionTitular.set(true);
        }),
        switchMap((numero) =>
          this.preCalificacionApi
            .evaluar(this.codigoDocumentoEquifax(this.formTitular.controls.tipoDocumento.value), numero, 'TITULAR')
            .pipe(catchError(() => of(null)))
        )
      )
      .subscribe((resultado) => {
        this.evaluandoPreCalificacionTitular.set(false);
        if (!resultado) return;
        this.preCalificacionTitular.set(resultado);
        // Antes solo se avisaba AMARILLO/ROJO -- en VERDE el vendedor llenaba todo el formulario a ciegas, sin
        // saber si el titular había pasado el filtro (pedido 2026-08-22). Ahora se avisan las 3 zonas.
        this.mostrarAvisoPreCalificacion(resultado);
      });
  }

  /** Contraparte de configurarPreCalificacionTitular() para el aval — mismo patrón, mismo modal, mismo bloqueo en rojo. */
  private configurarPreCalificacionAvalista(): void {
    this.formAvalista.controls.numeroDocumento.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        filter((numero) => numero.trim().length >= 8),
        tap(() => {
          this.preCalificacionAvalista.set(null);
          this.evaluandoPreCalificacionAvalista.set(true);
        }),
        switchMap((numero) =>
          this.preCalificacionApi
            .evaluar(this.codigoDocumentoEquifax(this.formAvalista.controls.tipoDocumento.value), numero, 'AVAL')
            .pipe(catchError(() => of(null)))
        )
      )
      .subscribe((resultado) => {
        this.evaluandoPreCalificacionAvalista.set(false);
        if (!resultado) return;
        this.preCalificacionAvalista.set(resultado);
        this.mostrarAvisoPreCalificacion(resultado);
      });
  }

  /**
   * PreCalificacionApiService habla con Equifax, que usa su propio catálogo numérico de documento (1=DNI, 6=RUC,
   * 3=CE, 4=PAS — mismo que ya usa la pantalla "Consulta Crediticia" de admin-v2), distinto del catálogo de
   * originación (`TipoDocumentoIdentidad`, texto). El mapeo vive acá (no en el servicio) para no acoplar
   * `core/riesgo` al modelo de `core/originacion` — cada bounded context mantiene su propio vocabulario.
   */
  private codigoDocumentoEquifax(tipo: TipoDocumentoIdentidad): string {
    return tipo === 'CARNET_EXTRANJERIA' ? '3' : '1';
  }

  /**
   * ROJO: informativo, sin botón de continuar (el ejecutivo no puede avanzar — ver zonaBloqueaAvanceTitular()).
   * AMARILLO: si el ejecutivo elige "Continuar bajo riesgo", queda registrado en el backend (auditado) — nunca se
   * asume silenciosamente, es una decisión explícita del ejecutivo cada vez. VERDE (2026-08-22): antes no se
   * avisaba nada y el ejecutivo llenaba todo el formulario sin saber si el cliente había pasado el filtro —
   * ahora también se confirma explícitamente, mismo modal, sin decisión que tomar (solo "Entendido").
   */
  private mostrarAvisoPreCalificacion(resultado: ResultadoPreCalificacion): void {
    this.modalService
      .open(PreCalificacionAlertDialogComponent, {
        data: { zona: resultado.zona, mensaje: resultado.mensaje }
      })
      .closed.subscribe((continuar) => {
        if (resultado.zona === 'AMARILLO' && continuar === true) {
          this.preCalificacionApi.continuarBajoRiesgo(resultado.id).subscribe();
        }
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

  /** Prellena solo los campos que el OCR sí reconoció — numeroDocumento dispara el lookup de json.pe ya existente (valueChanges). */
  protected onFotoIdentidadTitular({ datos, publicUrl }: DocumentoIdentidadExtraido): void {
    this.fotoIdentidadTitularUrl.set(publicUrl);
    this.formTitular.patchValue({
      // Primero: si el OCR detectó un tipo distinto al marcado (subida antes
      // de llegar al selector), corregirlo ANTES de numeroDocumento — el
      // lookup de json.pe lee tipoDocumento.value al momento de consultar.
      ...(datos.tipoDocumentoDetectado ? { tipoDocumento: datos.tipoDocumentoDetectado } : {}),
      ...(datos.numeroDocumento ? { numeroDocumento: datos.numeroDocumento } : {}),
      ...(datos.fechaNacimiento ? { fechaNacimiento: datos.fechaNacimiento } : {}),
      ...(datos.nacionalidad ? { nacionalidad: datos.nacionalidad } : {})
    });
  }

  protected onFotoIdentidadAvalista({ datos, publicUrl }: DocumentoIdentidadExtraido): void {
    this.fotoIdentidadAvalistaUrl.set(publicUrl);
    this.formAvalista.patchValue({
      ...(datos.tipoDocumentoDetectado ? { tipoDocumento: datos.tipoDocumentoDetectado } : {}),
      ...(datos.numeroDocumento ? { numeroDocumento: datos.numeroDocumento } : {}),
      ...(datos.fechaNacimiento ? { fechaNacimiento: datos.fechaNacimiento } : {}),
      ...(datos.nacionalidad ? { nacionalidad: datos.nacionalidad } : {})
    });
  }

  protected onDireccionTitularParsed(data: DireccionParseada): void {
    this.formTitular.patchValue(data);
  }

  protected onCoordenadasTitular(coords: Coordenadas): void {
    this.formTitular.patchValue({ latitud: coords.latitud, longitud: coords.longitud });
  }

  /** El vendedor pidió explícitamente usar la sugerencia de Google como dirección final. */
  protected onUsarDireccionSugeridaTitular(direccion: string): void {
    this.formTitular.patchValue({ direccion });
  }

  protected onDireccionAvalistaParsed(data: DireccionParseada): void {
    this.formAvalista.patchValue(data);
  }

  protected onCoordenadasAvalista(coords: Coordenadas): void {
    this.formAvalista.patchValue({ latitud: coords.latitud, longitud: coords.longitud });
  }

  /** El vendedor pidió explícitamente usar la sugerencia de Google como dirección final. */
  protected onUsarDireccionSugeridaAvalista(direccion: string): void {
    this.formAvalista.patchValue({ direccion });
  }

  continuarTitular(): void {
    if (this.formTitular.invalid) {
      this.formTitular.markAllAsTouched();
      return;
    }
    // Defensivo — el botón ya queda [disabled] en el template (zonaBloqueaAvanceTitular()), esto cubre cualquier
    // otro disparador del submit (ej. Enter dentro de un input del form).
    if (this.zonaBloqueaAvanceTitular()) {
      return;
    }
    // Verificación de correo (2026-08-16) — solo bloquea si el vendedor tecleó un correo (sigue opcional). Mismo
    // patrón defensivo que el botón, que ya queda [disabled] en el template.
    if (this.emailTitularTexto()?.trim() && !this.correoVerificado()) {
      return;
    }
    const datos = this.formTitular.getRawValue();
    this.guardando.set(true);
    this.error.set(null);

    const titularExistente = this.titular();
    const solicitudExistente = this.solicitud();

    if (titularExistente && solicitudExistente) {
      // El titular y la solicitud ya se crearon en esta misma corrida del
      // wizard (el ejecutivo retrocedió a este paso y volvió a tocar
      // "Continuar") — crearSolicitud() ya no se puede volver a llamar (el
      // backend rechaza una 2da solicitud para el mismo titular), así que
      // solo se actualiza la dirección/GPS y se avanza, sin recrear nada.
      this.api
        .actualizarDireccionCliente(titularExistente.id, {
          departamento: datos.departamento,
          provincia: datos.provincia,
          distrito: datos.distrito,
          direccion: datos.direccion,
          direccionSugerida: datos.direccionSugerida,
          latitud: datos.latitud,
          longitud: datos.longitud,
          fechaNacimiento: datos.fechaNacimiento || null,
          nacionalidad: datos.nacionalidad,
          estadoCivil: datos.estadoCivil
        })
        .subscribe({
          next: (cliente) => {
            this.titular.set(cliente);
            this.guardando.set(false);
            this.paso.set('documentos-titular');
          },
          error: (err: HttpErrorResponse) => this.manejarError(err)
        });
      return;
    }

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
            direccionSugerida: datos.direccionSugerida,
            latitud: datos.latitud,
            longitud: datos.longitud,
            fechaNacimiento: datos.fechaNacimiento || null,
            nacionalidad: datos.nacionalidad,
            estadoCivil: datos.estadoCivil
          })
        ),
        switchMap((cliente) =>
          // documentosMinimosCompletos siempre false acá: la solicitud se crea
          // ANTES de que exista cualquier documento (el paso documentos-titular
          // es el siguiente). Nace INCOMPLETA y pasa a COMPLETA recién en
          // evaluarDocumentosMinimosCompletos(), tras subir los documentos —
          // ver MarcarSolicitudCompletaUseCase en motoya-api.
          this.api
            .crearSolicitud({ canal: 'TIENDA_ALIADA', titularId: cliente.id, documentosMinimosCompletos: false })
            .pipe(switchMap((solicitud) => of({ cliente, solicitud })))
        )
      )
      .subscribe({
        next: ({ cliente, solicitud }) => {
          this.titular.set(cliente);
          this.solicitud.set(solicitud);
          this.guardando.set(false);
          this.paso.set('documentos-titular');
          this.cargarHistorialTitular(cliente.tipoDocumento, cliente.numeroDocumento);
          this.registrarFotoIdentidadTitularSiExiste(solicitud.id);
          this.vincularPreCalificacionSiExiste(solicitud.id);
        },
        error: (err: HttpErrorResponse) => this.manejarError(err)
      });
  }

  /** Completa el vínculo pre-calificación↔solicitud (ver PreCalificacion.solicitudId en el backend) — best-effort, nunca bloquea el avance. */
  private vincularPreCalificacionSiExiste(solicitudId: string): void {
    const preCalificacionId = this.preCalificacionTitular()?.id;
    if (!preCalificacionId) return;
    this.preCalificacionApi.vincularSolicitud(preCalificacionId, solicitudId).subscribe({
      error: () => {
        /* No bloquea — el ciclo de retro-alimentación pierde este dato puntual, no la venta. */
      }
    });
  }

  /** Misma lógica que vincularPreCalificacionSiExiste, para el aval — acá la solicitud ya existía antes de llamar. */
  private vincularPreCalificacionAvalistaSiExiste(solicitudId: string): void {
    const preCalificacionId = this.preCalificacionAvalista()?.id;
    if (!preCalificacionId) return;
    this.preCalificacionApi.vincularSolicitud(preCalificacionId, solicitudId).subscribe({
      error: () => {
        /* No bloquea — el ciclo de retro-alimentación pierde este dato puntual, no la venta. */
      }
    });
  }

  /** La foto ya se subió a staging antes de crear la solicitud (mt-documento-identidad-upload) — se registra como DNI_FRENTE sin volver a subirla. */
  private registrarFotoIdentidadTitularSiExiste(solicitudId: string): void {
    const url = this.fotoIdentidadTitularUrl();
    if (!url) return;
    this.api.registrarDocumento(solicitudId, { rol: 'TITULAR', tipo: 'DNI_FRENTE', url }).subscribe({
      next: (documento) => this.onDocumentoTitularSubido(documento),
      error: () => {
        /* No bloquea — el vendedor puede subirla de nuevo manualmente en el paso de documentos. */
      }
    });
  }

  protected onDocumentoTitularSubido(documento: DocumentoSolicitudResponse): void {
    this.documentosTitular.update((lista) => [...lista.filter((d) => d.tipo !== documento.tipo), documento]);
  }

  protected documentoDe(lista: DocumentoSolicitudResponse[], tipo: TipoDocumentoSolicitud): DocumentoSolicitudResponse | null {
    return lista.find((d) => d.tipo === tipo) ?? null;
  }

  continuarDocumentosTitular(): void {
    this.paso.set('avalista');
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
    // Defensivo — el botón ya queda [disabled] en el template (zonaBloqueaAvanceAvalista()).
    if (this.zonaBloqueaAvanceAvalista()) {
      return;
    }
    const solicitud = this.solicitud();
    if (!solicitud) return;

    const datos = this.formAvalista.getRawValue();
    this.guardando.set(true);
    this.error.set(null);

    const avalistaExistente = this.avalista();

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
            direccionSugerida: datos.direccionSugerida,
            latitud: datos.latitud,
            longitud: datos.longitud,
            fechaNacimiento: datos.fechaNacimiento || null,
            nacionalidad: datos.nacionalidad,
            estadoCivil: datos.estadoCivil
          })
        ),
        switchMap((cliente) =>
          // Si ya había un aval guardado (se retrocedió a este paso), se
          // reemplaza en vez de agregar() — agregar() rechaza un 2do aval
          // para la misma solicitud, dejando el wizard sin forma de avanzar.
          (avalistaExistente
            ? this.api.reemplazarAvalista(solicitud.id, { clienteId: cliente.id, relacion: datos.relacion })
            : this.api.agregarAvalista(solicitud.id, { clienteId: cliente.id, relacion: datos.relacion })
          ).pipe(switchMap(() => of(cliente)))
        )
      )
      .subscribe({
        next: (cliente) => {
          this.avalista.set({ cliente, relacion: datos.relacion });
          this.guardando.set(false);
          this.paso.set('documentos-avalista');
          this.verificarRelacionCircularAvalista(cliente.id);
          this.registrarFotoIdentidadAvalistaSiExiste(solicitud.id);
          this.vincularPreCalificacionAvalistaSiExiste(solicitud.id);
        },
        error: (err: HttpErrorResponse) => this.manejarError(err)
      });
  }

  /** Misma lógica que registrarFotoIdentidadTitularSiExiste, para el aval. */
  private registrarFotoIdentidadAvalistaSiExiste(solicitudId: string): void {
    const url = this.fotoIdentidadAvalistaUrl();
    if (!url) return;
    this.api.registrarDocumento(solicitudId, { rol: 'AVALISTA', tipo: 'DNI_FRENTE', url }).subscribe({
      next: (documento) => this.onDocumentoAvalistaSubido(documento),
      error: () => {
        /* No bloquea — el vendedor puede subirla de nuevo manualmente en el paso de documentos. */
      }
    });
  }

  protected onDocumentoAvalistaSubido(documento: DocumentoSolicitudResponse): void {
    this.documentosAvalista.update((lista) => [...lista.filter((d) => d.tipo !== documento.tipo), documento]);
  }

  continuarDocumentosAvalista(): void {
    this.evaluarDocumentosMinimosCompletos();
    this.paso.set('vehiculo');
  }

  /**
   * Los "documentos mínimos" (§9.2 del doc de arquitectura) son el DNI
   * (frente+reverso) de titular y aval — el resto de slots (licencia,
   * selfie, certificado laboral, recibo, fachada, otros) son complementarios,
   * no bloquean. Si ambos DNI ya están, la solicitud pasa de INCOMPLETA a
   * COMPLETA en el backend. Best-effort y no bloqueante: si falla, la
   * solicitud simplemente se queda INCOMPLETA — sigue siendo más correcto
   * que el `true` fijo que se mandaba antes de tener un solo documento.
   */
  private evaluarDocumentosMinimosCompletos(): void {
    const solicitud = this.solicitud();
    if (!solicitud) return;
    if (!this.tieneDniCompleto(this.documentosTitular()) || !this.tieneDniCompleto(this.documentosAvalista())) {
      return;
    }
    this.api.marcarSolicitudCompleta(solicitud.id).subscribe({
      next: (actualizada) => this.solicitud.set(actualizada),
      error: () => {
        /* No bloquea el wizard — el evaluador puede completarla luego desde el panel interno. */
      }
    });
  }

  private tieneDniCompleto(documentos: DocumentoSolicitudResponse[]): boolean {
    return documentos.some((d) => d.tipo === 'DNI_FRENTE') && documentos.some((d) => d.tipo === 'DNI_REVERSO');
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

    const datos = this.formVehiculo.getRawValue();
    // Si ya había un vehículo guardado (se retrocedió a este paso), se
    // actualiza en vez de agregar() — agregar() rechaza un 2do vehículo para
    // la misma solicitud, dejando el wizard sin forma de avanzar.
    const request$ = this.vehiculo() ? this.api.actualizarVehiculo(solicitud.id, datos) : this.api.agregarVehiculo(solicitud.id, datos);

    request$.subscribe({
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
    this.modoContinuar.set(false);
    this.titular.set(null);
    this.solicitud.set(null);
    this.avalista.set(null);
    this.vehiculo.set(null);
    this.referencias.set([]);
    this.documentosTitular.set([]);
    this.documentosAvalista.set([]);
    this.fotoIdentidadTitularUrl.set(null);
    this.fotoIdentidadAvalistaUrl.set(null);
    this.error.set(null);
    this.historialTitular.set([]);
    this.relacionCircularDetectada.set(false);
    this.correoVerificado.set(false);
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
