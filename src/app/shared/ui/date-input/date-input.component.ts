import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

/**
 * Input de fecha en formato DD/MM/AAAA — a propósito no usa `<input
 * type="date">`: el <input> nativo SÍ guarda su valor interno siempre en ISO
 * (yyyy-MM-dd, eso nunca cambia), pero el orden VISIBLE que el usuario ve y
 * tipea depende del idioma/región del navegador — en un navegador en inglés
 * puede mostrar MM/DD/AAAA aunque el usuario esté en Perú. Este componente
 * enmascara la escritura para que el orden día/mes/año sea siempre el mismo
 * sin importar el navegador, y hacia afuera (ControlValueAccessor) sigue
 * emitiendo el mismo string ISO 'yyyy-MM-dd' que ya espera el resto del
 * código — reemplaza a `<mt-input type="date">` sin romper nada del lado
 * que recibe el valor.
 */
@Component({
  selector: 'mt-date-input',
  standalone: true,
  templateUrl: './date-input.component.html',
  styleUrl: './date-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateInputComponent),
      multi: true
    }
  ]
})
export class DateInputComponent implements ControlValueAccessor {
  readonly id = `mt-date-input-${nextId++}`;

  label = input.required<string>();
  errorMessage = input<string>();
  hint = input<string>();

  /** Lo que el usuario ve y tipea: siempre "DD/MM/AAAA", nunca el ISO interno. */
  protected texto = signal('');
  protected focused = signal(false);
  protected disabled = signal(false);

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  protected hasValue = () => this.texto().length > 0;

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const enmascarado = this.enmascarar(input.value);
    this.texto.set(enmascarado);
    input.value = enmascarado;
    this.emitirSiEsValida(enmascarado);
  }

  onFocus(): void {
    this.focused.set(true);
  }

  onBlur(): void {
    this.focused.set(false);
    this.onTouched();
  }

  writeValue(isoValue: string | null): void {
    this.texto.set(this.aTextoVisible(isoValue));
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  /** 'yyyy-MM-dd' (o null) → "dd/MM/yyyy" para mostrar. */
  private aTextoVisible(isoValue: string | null): string {
    if (!isoValue) return '';
    const [anio, mes, dia] = isoValue.split('-');
    if (!anio || !mes || !dia) return '';
    return `${dia}/${mes}/${anio}`;
  }

  /** Solo dígitos, con "/" auto-insertado después de día y mes — máximo 8 dígitos (DDMMAAAA). */
  private enmascarar(valorCrudo: string): string {
    const soloDigitos = valorCrudo.replace(/\D/g, '').slice(0, 8);
    const partes = [soloDigitos.slice(0, 2), soloDigitos.slice(2, 4), soloDigitos.slice(4, 8)].filter((p) => p.length > 0);
    return partes.join('/');
  }

  /** Solo emite (y solo un ISO real) cuando el texto ya es una fecha DD/MM/AAAA completa y calendaricamente válida — mientras tanto, emite null. */
  private emitirSiEsValida(texto: string): void {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
    if (!match) {
      this.onChange(null);
      return;
    }
    const [, diaStr, mesStr, anioStr] = match;
    const dia = Number(diaStr);
    const mes = Number(mesStr);
    const anio = Number(anioStr);
    const fecha = new Date(anio, mes - 1, dia);
    const esValida = fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
    this.onChange(esValida ? `${anioStr}-${mesStr}-${diaStr}` : null);
  }
}
