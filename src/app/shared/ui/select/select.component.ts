import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  forwardRef,
  input,
  signal,
  viewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

export interface SelectOption<T = unknown> {
  label: string;
  value: T;
}

let nextId = 0;

/**
 * Select custom con el mismo lenguaje visual que mt-input (label flotante).
 * El panel de opciones usa CDK Overlay (posicionamiento + backdrop + escape),
 * no un <select> nativo, para poder compartir el sistema de diseño.
 */
@Component({
  selector: 'mt-select',
  standalone: true,
  imports: [CdkOverlayOrigin, CdkConnectedOverlay, IconComponent],
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true
    }
  ]
})
export class SelectComponent<T = unknown> implements ControlValueAccessor {
  readonly id = `mt-select-${nextId++}`;

  label = input.required<string>();
  options = input.required<SelectOption<T>[]>();
  errorMessage = input<string>();
  hint = input<string>();

  protected open = signal(false);
  protected value = signal<T | null>(null);
  protected disabled = signal(false);
  protected highlightedIndex = signal(0);
  protected triggerWidth = signal(240);

  private triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected selectedOption = computed(() => this.options().find((o) => o.value === this.value()) ?? null);
  protected hasValue = computed(() => this.selectedOption() !== null);

  private onChange: (value: T) => void = () => {};
  private onTouched: () => void = () => {};

  toggle(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
    if (this.open()) {
      const idx = this.options().findIndex((o) => o.value === this.value());
      this.highlightedIndex.set(idx >= 0 ? idx : 0);
      const width = this.triggerRef()?.nativeElement.offsetWidth;
      if (width) this.triggerWidth.set(width);
    }
  }

  close(): void {
    this.open.set(false);
    this.onTouched();
  }

  select(option: SelectOption<T>): void {
    this.value.set(option.value);
    this.onChange(option.value);
    this.close();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.open()) this.toggle();
    }
  }

  onPanelKeydown(event: KeyboardEvent): void {
    const options = this.options();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex.update((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex.update((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (options[this.highlightedIndex()]) this.select(options[this.highlightedIndex()]);
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
  }

  writeValue(value: T): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: T) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
