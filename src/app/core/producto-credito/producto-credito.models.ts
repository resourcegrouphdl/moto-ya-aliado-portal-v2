/** Espeja los DTOs reales de motoya-api (BC-07 Producto Crediticio) — un solo punto de verdad. */

export interface DatosCotizacionRequest {
  codigoProducto: string | null;
  precioVehiculo: number;
  inicialIngresada: number | null;
  numeroPeriodos: number;
  incluirSoat: boolean;
  fechaDesembolso: string | null;
}

export interface CuotaAmortizacion {
  numero: number;
  fechaVencimiento: string;
  saldoInicial: number;
  interes: number;
  amortizacionCapital: number;
  cuotaTotal: number;
  saldoFinal: number;
}

export interface CotizacionCreditoResponse {
  codigoProducto: string;
  precioVehiculo: number;
  inicialMinima: number;
  inicialAplicada: number;
  /** true cuando la inicial mínima/ingresada no alcanzaba para que el monto a financiar quedara dentro del máximo del producto, y se subió automáticamente. */
  inicialAjustadaAutomaticamente: boolean;
  capitalBase: number;
  montoSoatAplicado: number;
  comisionMonto: number;
  comisionFinanciada: boolean;
  gastosAdministrativos: number;
  montoFinanciar: number;
  efectivoNeto: number;
  tea: number;
  tasaPeriodica: number;
  tcea: number;
  tceaConvergioCorrectamente: boolean;
  cuotaBase: number;
  totalIntereses: number;
  totalAPagar: number;
  cuotas: CuotaAmortizacion[];
}

/** Límites/parámetros informativos del producto vigente — de solo lectura, para mostrarle al vendedor las reglas ANTES o junto con el resultado, sin duplicarlas a mano en el frontend. */
export interface ProductoCreditoInfo {
  codigoProducto: string;
  porcentajeInicialMinima: number;
  montoMinFinanciar: number;
  montoMaxFinanciar: number;
  precioMaxVehiculo: number | null;
  montoSoat: number;
  gastosAdministrativos: number;
  plazoMinPeriodos: number;
  plazoMaxPeriodos: number;
  teaDefault: number;
}
