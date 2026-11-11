import { HttpErrorResponse } from '@angular/common/http';

/** Importes en soles con dos decimales, como se los dicen al cliente. */
export function soles(valor: number | null | undefined): string {
  return `S/ ${(valor ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** «Hoy» es siempre el de Lima (DEC-006): el navegador puede tener otra zona. Formato AAAA-MM-DD. */
export function hoyLima(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** El mensaje del servidor (`detail` o `message`) para mostrarlo tal cual; si no hay, el texto de respaldo. */
export function mensajeDeError(e: unknown, respaldo: string): string {
  if (e instanceof HttpErrorResponse) {
    const cuerpo = e.error as { detail?: string; message?: string; mensaje?: string } | null;
    const texto = cuerpo?.detail ?? cuerpo?.message ?? cuerpo?.mensaje;
    if (texto && texto.trim() !== '') return texto;
    if (e.status === 0) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
    if (e.status === 401 || e.status === 403) return 'Tu usuario no puede hacer esto.';
  }
  return respaldo;
}
