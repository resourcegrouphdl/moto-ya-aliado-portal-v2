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
