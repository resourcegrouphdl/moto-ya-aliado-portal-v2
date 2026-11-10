import { BadgeVariant } from '../../shared/ui/badge/badge.component';

/** El SOAT en el portal del aliado (DEC-199/200): captar, seguir y cobrar. Quien capta nunca ve brokers ni ofertas: para él, Motoya cotiza y emite. */

export type Modalidad = 'CONTADO' | 'CREDITO';
export type TipoDocumentoIdentidad = 'DNI' | 'CARNET_EXTRANJERIA';

export type EstadoSolicitudSoat =
  | 'REGISTRADA'
  | 'EN_COTIZACION'
  | 'COTIZADA'
  | 'ESPERANDO_PAGO'
  | 'PAGO_VALIDADO'
  | 'EN_EVALUACION'
  | 'EN_REVISION'
  | 'APROBADA'
  | 'FORMALIZANDO'
  | 'ESPERANDO_PRENDA'
  | 'ENVIADA_AL_BROKER'
  | 'ACTIVADA'
  | 'CERRADA'
  | 'RECHAZADA'
  | 'DESISTIDA'
  | 'VENCIDA'
  | 'ANULADA';

export type TipoHito =
  | 'CONSENTIMIENTO'
  | 'DOCUMENTO_IDENTIDAD'
  | 'TIVE'
  | 'COTIZACION_ELEGIDA'
  | 'PRECIO_ACEPTADO'
  | 'PAGO_CONFIRMADO'
  | 'EVALUACION_APROBADA'
  | 'CONTRATO_FIRMADO'
  | 'INICIAL_CONFIRMADA'
  | 'PRENDA_INSCRITA'
  | 'PAGO_AL_BROKER'
  | 'POLIZA_RECIBIDA';

export const ESTADO_LABEL: Record<EstadoSolicitudSoat, string> = {
  REGISTRADA: 'Registrada',
  EN_COTIZACION: 'Cotizando',
  COTIZADA: 'Precio listo',
  ESPERANDO_PAGO: 'Esperando pago',
  PAGO_VALIDADO: 'Pago validado',
  EN_EVALUACION: 'En evaluación',
  EN_REVISION: 'En revisión',
  APROBADA: 'Crédito aprobado',
  FORMALIZANDO: 'Formalizando',
  ESPERANDO_PRENDA: 'Inscribiendo la garantía',
  ENVIADA_AL_BROKER: 'Emitiendo el SOAT',
  ACTIVADA: 'SOAT emitido',
  CERRADA: 'Entregada',
  RECHAZADA: 'Rechazada',
  DESISTIDA: 'Desistió',
  VENCIDA: 'Venció',
  ANULADA: 'Anulada'
};

export const ESTADO_BADGE: Record<EstadoSolicitudSoat, BadgeVariant> = {
  REGISTRADA: 'neutral',
  EN_COTIZACION: 'info',
  COTIZADA: 'info',
  ESPERANDO_PAGO: 'warning',
  PAGO_VALIDADO: 'info',
  EN_EVALUACION: 'info',
  EN_REVISION: 'warning',
  APROBADA: 'success',
  FORMALIZANDO: 'info',
  ESPERANDO_PRENDA: 'warning',
  ENVIADA_AL_BROKER: 'info',
  ACTIVADA: 'success',
  CERRADA: 'success',
  RECHAZADA: 'error',
  DESISTIDA: 'neutral',
  VENCIDA: 'neutral',
  ANULADA: 'error'
};

export const HITO_LABEL: Record<TipoHito, string> = {
  CONSENTIMIENTO: 'Autorización del cliente para usar sus datos',
  DOCUMENTO_IDENTIDAD: 'Documento de identidad',
  TIVE: 'Tarjeta de identificación vehicular (TIVE)',
  COTIZACION_ELEGIDA: 'Precio elegido por Motoya',
  PRECIO_ACEPTADO: 'El cliente aceptó el precio',
  PAGO_CONFIRMADO: 'Pago confirmado por Tesorería',
  EVALUACION_APROBADA: 'Evaluación aprobada',
  CONTRATO_FIRMADO: 'Contrato firmado',
  INICIAL_CONFIRMADA: 'Inicial confirmada',
  PRENDA_INSCRITA: 'Garantía inscrita',
  PAGO_AL_BROKER: 'SOAT pagado',
  POLIZA_RECIBIDA: 'Póliza recibida'
};

/** Los requisitos que quien capta cumple subiendo un archivo (el resto los cumple el sistema o Motoya). */
export type DocumentoDelCliente = 'DOCUMENTO_IDENTIDAD' | 'TIVE';

/** Qué tipo de Document Management corresponde a cada uno (DEC-057: todo archivo pasa por allí). */
export const TIPO_DM_DEL_DOCUMENTO: Record<DocumentoDelCliente, 'DNI' | 'TIVE'> = {
  DOCUMENTO_IDENTIDAD: 'DNI',
  TIVE: 'TIVE'
};

export const ESTADOS_ABIERTOS_PARA_DOCUMENTOS: EstadoSolicitudSoat[] = [
  'REGISTRADA',
  'EN_COTIZACION',
  'COTIZADA',
  'EN_EVALUACION',
  'EN_REVISION',
  'APROBADA',
  'FORMALIZANDO'
];

export const ESTADOS_QUE_ADMITEN_DESISTIR: EstadoSolicitudSoat[] = ['REGISTRADA', 'EN_COTIZACION', 'COTIZADA', 'ESPERANDO_PAGO', 'EN_REVISION', 'APROBADA', 'FORMALIZANDO'];

export const ESTADOS_TERMINALES_MALOS: EstadoSolicitudSoat[] = ['RECHAZADA', 'DESISTIDA', 'VENCIDA', 'ANULADA'];

/** Algo que le pasó a una solicitud suya (cambio de fase), dicho para el vendedor. Sale del historial; el servidor marca cuáles ya vio. */
/** La póliza del SOAT activado: vigencia y una URL temporal del PDF para abrirlo o compartirlo con el cliente. */
export interface PolizaDelSoat {
  numero: string;
  aseguradora: string;
  vigenteDesde: string;
  vigenteHasta: string;
  entregada: boolean;
  url: string;
}

export type TramoDeMora = 'VIGENTE' | 'DE_1_A_8' | 'DE_9_A_30' | 'DE_31_A_60' | 'DE_61_A_120' | 'MAS_DE_120';

export const TRAMO_LABEL: Record<TramoDeMora, string> = {
  VIGENTE: 'Al día',
  DE_1_A_8: '1–8 días',
  DE_9_A_30: '9–30 días',
  DE_31_A_60: '31–60 días',
  DE_61_A_120: '61–120 días',
  MAS_DE_120: 'Más de 120'
};

export interface ClienteConCredito {
  solicitudId: string;
  codigo: string;
  cliente: string;
  placa: string;
  numeroContrato: string;
  saldo: number;
  mora: number;
  diasDeMora: number;
  proximoVencimiento: string | null;
  enVentanaDeAnulacion: boolean;
  ultimoAviso: { tipo: string; estado: string; en: string } | null;
  tramo: TramoDeMora;
}

/** «Mis clientes»: los créditos SOAT del vendedor por antigüedad de mora y su comisión (la del mes, la acumulada, la reversada y lo que está por ganar). */
export interface MiCartera {
  cartera: {
    resumen: { creditosActivos: number; saldoPorCobrar: number; moraAcumulada: number; creditosEnMora: number; par1: number; par8: number; par30: number };
    tramos: { tramo: TramoDeMora; creditos: number; saldo: number; porcentaje: number }[];
    creditos: ClienteConCredito[];
  };
  comision: { periodo: string; delMes: number; total: number; reversada: number; porGanar: number; solicitudesPorGanar: number };
}

export type UrgenciaDeRenovacion = 'VENCIDA' | 'ESTA_SEMANA' | 'PROXIMA' | 'DEL_MES';

/** Una póliza que vence pronto (o venció hace poco) y nadie renovó: la venta repetida más fácil del vendedor. */
export interface RenovacionPorHacer {
  solicitudId: string;
  codigo: string;
  cliente: string;
  celular: string;
  placa: string;
  moto: string;
  aseguradora: string;
  venceEl: string;
  diasParaVencer: number;
  urgencia: UrgenciaDeRenovacion;
}

export interface AvisoDeSoat {
  solicitudId: string;
  codigo: string;
  cliente: string;
  placa: string;
  fase: EstadoSolicitudSoat;
  titulo: string;
  texto: string;
  motivo: string | null;
  ocurridoEn: string;
  leido: boolean;
}

export interface BandejaDeAvisos {
  sinLeer: number;
  avisos: AvisoDeSoat[];
}

export interface ResumenSolicitud {
  id: string;
  codigo: string;
  modalidad: Modalidad;
  estado: EstadoSolicitudSoat;
  placa: string;
  marca: string | null;
  modelo: string | null;
  clienteNombre: string;
  numeroDocumento: string;
  precioSoat: number | null;
  creadaEn: string;
  actualizadaEn: string;
}

export interface Seguimiento {
  id: string;
  codigo: string;
  modalidad: Modalidad;
  estado: EstadoSolicitudSoat;
  etapa: string;
  origen: string;
  clienteNombre: string;
  numeroDocumento: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  precioSoat: number | null;
  hitosCumplidos: TipoHito[];
  motivoDeCierre: string | null;
  creadaEn: string;
  actualizadaEn: string;
}

export interface EventoSolicitud {
  tipo: 'SOLICITUD_REGISTRADA' | 'FASE_CAMBIADA' | 'HITO_CUMPLIDO' | 'HITO_REVOCADO';
  faseNueva: EstadoSolicitudSoat | null;
  hito: TipoHito | null;
  ocurridoEn: string;
}

export interface Consulta<T> {
  estado: 'ENCONTRADO' | 'NO_ENCONTRADO' | 'NO_DISPONIBLE';
  datos: T | null;
}

export interface MotoConsultada {
  marca: string | null;
  modelo: string | null;
  color: string | null;
}

export interface SoatPrevio {
  aseguradora: string | null;
  fechaFin: string | null;
  estado: string;
}

export interface ConsultaDePlaca {
  placa: string;
  moto: Consulta<MotoConsultada>;
  soat: Consulta<SoatPrevio>;
  yaTieneSolicitudEnCurso: boolean;
}

export interface RegistrarSolicitudRequest {
  modalidad: Modalidad;
  tipoDocumento: TipoDocumentoIdentidad;
  numeroDocumento: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  celular?: string;
  correo?: string;
  domicilio?: string;
  placa: string;
  marca?: string;
  modelo?: string;
}

export interface CuotaSimulada {
  numero: number;
  fechaVencimiento: string;
  total: number;
}

/** Las cuotas del crédito para decirle al cliente cuánto paga hoy y cuánto cada semana. */
export interface Simulacion {
  conPrecioReferencial: boolean;
  cotizacion: {
    precioSoat: number;
    inicial: number;
    capitalFinanciado: number;
    cronograma: { cuotas: CuotaSimulada[]; totalAPagar: number; tcea: number };
  };
}

export interface CreditoFormalizado {
  numeroContrato: string;
  precioSoat: number;
  inicial: number;
  montoFinanciado: number;
  numeroCuotas: number;
  totalAPagar: number;
  contratoGenerado: boolean;
}

export interface Formalizacion {
  seguimiento: Seguimiento;
  credito: CreditoFormalizado;
}

export interface InstruccionDePago {
  monto: number;
  /** El nombre de la cuenta recaudadora; el servidor manda también su número y CCI para quien no puede leer las cuentas de la empresa. */
  cuentaDeDeposito: string;
  numeroDeCuenta?: string | null;
  cci?: string | null;
}

export type EstadoVoucher = 'PENDIENTE_VALIDACION' | 'VALIDADO' | 'RECHAZADO';

export const ESTADO_VOUCHER_LABEL: Record<EstadoVoucher, string> = {
  PENDIENTE_VALIDACION: 'Esperando a Tesorería',
  VALIDADO: 'Validado',
  RECHAZADO: 'Rechazado'
};

export const ESTADO_VOUCHER_BADGE: Record<EstadoVoucher, BadgeVariant> = {
  PENDIENTE_VALIDACION: 'warning',
  VALIDADO: 'success',
  RECHAZADO: 'error'
};

export interface VoucherDelPago {
  id: string;
  monto: number;
  fechaOperacion: string;
  entidad: string;
  numeroOperacion: string;
  estado: EstadoVoucher;
  motivoRechazo: string | null;
}

export interface DetalleDelPago {
  situacion: 'SIN_COBRO' | 'ABIERTO' | 'CON_PENDIENTES' | 'COMPLETO';
  montoEsperado: number;
  montoValidado: number;
  vouchers: VoucherDelPago[];
}

/** Lo que la lectura (OCR) propone de un voucher; la persona lo confirma o corrige. */
export interface LecturaDelVoucher {
  entidad: string | null;
  numeroOperacion: string | null;
  fechaOperacion: string | null;
  monto: number | null;
  datosOcrCrudo: string | null;
}

export interface RegistrarVoucherRequest {
  documentoId: string;
  monto: number;
  fechaOperacion: string;
  entidad: string;
  numeroOperacion: string;
  datosOcrCrudo?: string | null;
}

/** Qué se está cobrando: el pago completo del contado o la cuota inicial del crédito (mismo circuito de Tesorería). */
export type TipoDeCobro = 'pago' | 'inicial';

export const CARGO_LABEL: Record<string, string> = {
  IGV: 'IGV sobre el interés',
  ADMINISTRATIVO: 'Cargo administrativo',
  COBRANZA: 'Gestión de cobranza',
  REGISTRAL: 'Gastos registrales'
};

/** Los pasos del crédito para quien lo capta: quién tiene la pelota y qué decirle al cliente. Nunca menciona brokers. */
export type SituacionDelPaso = 'HECHO' | 'ACTUAL' | 'PENDIENTE';

export interface PasoDelCredito {
  titulo: string;
  quien: string;
  situacion: SituacionDelPaso;
  queDecirle: string | null;
}

const ORDEN_DE_ESTADOS: EstadoSolicitudSoat[] = [
  'REGISTRADA',
  'EN_COTIZACION',
  'COTIZADA',
  'EN_EVALUACION',
  'EN_REVISION',
  'APROBADA',
  'FORMALIZANDO',
  'ESPERANDO_PRENDA',
  'ENVIADA_AL_BROKER',
  'ACTIVADA',
  'CERRADA'
];

function llego(s: Seguimiento, estado: EstadoSolicitudSoat): boolean {
  const i = ORDEN_DE_ESTADOS.indexOf(s.estado);
  return i >= 0 && i >= ORDEN_DE_ESTADOS.indexOf(estado);
}

const PASOS: { titulo: string; quien: string; queDecirle: string; hecho: (s: Seguimiento) => boolean }[] = [
  {
    titulo: 'Autorización del cliente',
    quien: 'Tú',
    queDecirle: 'Dile que necesitas su permiso para consultar su historial y pedir el precio del SOAT.',
    hecho: (s) => s.hitosCumplidos.includes('CONSENTIMIENTO') || llego(s, 'COTIZADA')
  },
  {
    titulo: 'Precio del SOAT',
    quien: 'Motoya',
    queDecirle: 'Estamos pidiendo el precio; en un momento te lo confirmamos para decírselo.',
    hecho: (s) => s.hitosCumplidos.includes('COTIZACION_ELEGIDA') || llego(s, 'COTIZADA')
  },
  {
    titulo: 'Evaluación del crédito',
    quien: 'Motoya',
    queDecirle: 'Estamos revisando su crédito. Si hace falta, gerencia lo revisa; no tiene que hacer nada.',
    hecho: (s) => llego(s, 'APROBADA')
  },
  {
    titulo: 'Contrato firmado',
    quien: 'El cliente',
    queDecirle: 'Motoya prepara su contrato y se lo manda a su correo para firmar: dile que esté atento y lo firme apenas lo reciba.',
    hecho: (s) => s.hitosCumplidos.includes('CONTRATO_FIRMADO') || llego(s, 'ESPERANDO_PRENDA')
  },
  {
    titulo: 'Inicial pagada',
    quien: 'El cliente',
    queDecirle: 'Debe depositar la inicial a la cuenta de la empresa y enviarte la foto del voucher.',
    hecho: (s) => s.hitosCumplidos.includes('INICIAL_CONFIRMADA') || llego(s, 'ESPERANDO_PRENDA')
  },
  {
    titulo: 'Garantía inscrita',
    quien: 'Motoya',
    queDecirle: 'Se inscribe la garantía sobre su moto. No tiene que hacer nada.',
    hecho: (s) => s.hitosCumplidos.includes('PRENDA_INSCRITA') || llego(s, 'ENVIADA_AL_BROKER')
  },
  {
    titulo: 'SOAT pagado',
    quien: 'Motoya',
    queDecirle: 'Estamos pagando su SOAT para emitirlo.',
    hecho: (s) => s.hitosCumplidos.includes('PAGO_AL_BROKER') || llego(s, 'ACTIVADA')
  },
  {
    titulo: 'Póliza emitida y crédito activo',
    quien: 'Motoya',
    queDecirle: 'Ya llega su póliza. Las cuotas semanales empiezan 7 días después de la póliza.',
    hecho: (s) => s.hitosCumplidos.includes('POLIZA_RECIBIDA') || llego(s, 'ACTIVADA')
  }
];

export function lineaDeTiempoDelCredito(s: Seguimiento): PasoDelCredito[] {
  if (s.modalidad !== 'CREDITO' || ESTADOS_TERMINALES_MALOS.includes(s.estado)) return [];
  const primeroSinHacer = PASOS.findIndex((p) => !p.hecho(s));
  return PASOS.map((p, i) => {
    const situacion: SituacionDelPaso = primeroSinHacer === -1 || i < primeroSinHacer ? 'HECHO' : i === primeroSinHacer ? 'ACTUAL' : 'PENDIENTE';
    return { titulo: p.titulo, quien: p.quien, situacion, queDecirle: situacion === 'ACTUAL' ? p.queDecirle : null };
  });
}

/** La comisión del 3 % del valor cotizado, solo informativa y solo si la solicitud la lleva quien la captó (DEC-201/210). */
export function comisionEstimada(precio: number | null, origen: string): number | null {
  if (precio === null || precio <= 0 || !['ALIADO', 'VENTA_PROPIA', 'LIBRE'].includes(origen)) return null;
  return Math.round(precio * 3) / 100;
}

