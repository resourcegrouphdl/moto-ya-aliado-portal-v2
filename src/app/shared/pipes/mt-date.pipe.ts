import { DatePipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formatea fechas siempre en DD/MM/AAAA (el orden legible para la mayoría de
 * usuarios en Perú) — envuelve DatePipe con un formato fijo en vez de que
 * cada plantilla tenga que acordarse de escribir `| date: 'dd/MM/yyyy'` a
 * mano, donde basta un olvido para que alguna fecha salga con el formato por
 * defecto de Angular (locale-dependiente, no necesariamente DD/MM/AAAA).
 *
 * Uso: `{{ contrato.creadoEn | mtDate }}` → "19/07/2026"
 *      `{{ contrato.creadoEn | mtDate:true }}` → "19/07/2026 14:30" (con hora)
 */
@Pipe({
  name: 'mtDate',
  standalone: true
})
export class MtDatePipe implements PipeTransform {
  private readonly datePipe = new DatePipe('es-PE');

  transform(value: string | Date | null | undefined, conHora = false): string {
    if (!value) return '';
    return this.datePipe.transform(value, conHora ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy') ?? '';
  }
}
