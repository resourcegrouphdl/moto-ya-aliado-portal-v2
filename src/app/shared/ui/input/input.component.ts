import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'search';

let nextId = 0;

/**
 * Input con label flotante — implementa ControlValueAccessor para funcionar
 * con Reactive Forms (formControlName) o template-driven (ngModel) por igual.
 */
@Component({
  selector: 'mt-input',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true
    }
  ]
})
export class InputComponent implements ControlValueAccessor {
  readonly id = `mt-input-${nextId++}`;

  label = input.required<string>();
  type = input<InputType>('text');
  icon = input<string>();
  errorMessage = input<string>();
  hint = input<string>();
  /** Se reenvía al <input> real — el atributo puesto directo en <mt-input> no llega al control interno. */
  autocomplete = input<string>();

  protected value = signal('');
  protected focused = signal(false);
  protected disabled = signal(false);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  protected hasValue = () => this.value().length > 0;

  onInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.value.set(next);
    this.onChange(next);
  }

  onFocus(): void {
    this.focused.set(true);
  }

  onBlur(): void {
    this.focused.set(false);
    this.onTouched();
  }

  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
