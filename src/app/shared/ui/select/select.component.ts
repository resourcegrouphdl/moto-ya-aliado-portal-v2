import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  forwardRef,
  inject,
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
  /**
   * Muestra un buscador arriba del panel (2026-09-23, cascada de ubigeo): con listas largas — los 1892 distritos
   * del catálogo — desplazarse a dedo no es viable. Filtra por `label`, ignorando tildes y mayúsculas.
   */
  buscable = input(false, { transform: booleanAttribute });
  /** Texto del placeholder del buscador (solo si `buscable`). */
  placeholderBusqueda = input('Buscar');

  protected open = signal(false);
  protected value = signal<T | null>(null);
  protected disabled = signal(false);
  protected highlightedIndex = signal(0);
  protected triggerWidth = signal(240);
  protected filtro = signal('');

  private triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private buscadorRef = viewChild<ElementRef<HTMLInputElement>>('buscador');
  private readonly injector = inject(Injector);

  protected selectedOption = computed(() => this.options().find((o) => o.value === this.value()) ?? null);
  protected hasValue = computed(() => this.selectedOption() !== null);

  /** Con buscador activo, solo las opciones que matchean el filtro (el índice resaltado vive sobre esta lista). */
  protected opcionesVisibles = computed(() => {
    const termino = normalizar(this.filtro());
    const opciones = this.options();
    if (!this.buscable() || termino === '') return opciones;
    return opciones.filter((o) => normalizar(o.label).includes(termino));
  });

  /** Sin resultados es un estado propio: el panel lo dice en vez de quedar vacío. */
  protected sinResultados = computed(() => this.opcionesVisibles().length === 0);

  private onChange: (value: T) => void = () => {};
  private onTouched: () => void = () => {};

  toggle(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
    if (this.open()) {
      const idx = this.opcionesVisibles().findIndex((o) => o.value === this.value());
      this.highlightedIndex.set(idx >= 0 ? idx : 0);
      const width = this.triggerRef()?.nativeElement.offsetWidth;
      if (width) this.triggerWidth.set(width);
      this.enfocarBuscador();
    }
  }

  close(): void {
    this.open.set(false);
    this.filtro.set('');
    this.onTouched();
  }

  select(option: SelectOption<T>): void {
    this.value.set(option.value);
    this.onChange(option.value);
    this.close();
  }

  onFiltroInput(event: Event): void {
    this.filtro.set((event.target as HTMLInputElement).value);
    // Al filtrar, el resaltado vuelve arriba: Enter elige la primera coincidencia.
    this.highlightedIndex.set(0);
  }

  /**
   * Deja el cursor listo en el buscador al abrir el panel: quien abre un select de 1890 distritos viene a escribir.
   * Se hace con `afterNextRender` y no en el evento de apertura del overlay: el contenido del panel todavía no
   * existe cuando el overlay avisa que se adjuntó (`viewChild` vacío), y con un `setTimeout` la carrera se pierde
   * igual — el navegador confirmó que el input queda sin foco (2026-09-23).
   */
  enfocarBuscador(): void {
    if (!this.buscable()) return;
    afterNextRender(() => this.buscadorRef()?.nativeElement.focus(), { injector: this.injector });
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.open()) this.toggle();
    }
  }

  onPanelKeydown(event: KeyboardEvent): void {
    const options = this.opcionesVisibles();
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

/** Compara sin tildes y sin mayúsculas: quien busca escribe "jesus maria" o "Jesus María", no "JESUS MARIA". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}
