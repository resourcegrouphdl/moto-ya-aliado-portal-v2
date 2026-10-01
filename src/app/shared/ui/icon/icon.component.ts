import { ChangeDetectionStrategy, Component, HostBinding, computed, input } from '@angular/core';

/**
 * Wrapper de Material Symbols Rounded — un solo punto de verdad para el
 * tamaño/peso/relleno del ícono en todo el sistema (prompt maestro: "todos
 * los íconos deben mantener el mismo estilo").
 *
 * Decorativo por defecto (aria-hidden): si el ícono es el único contenido de
 * un control interactivo, el `aria-label` va en el botón/link contenedor, no aquí.
 */
@Component({
  selector: 'mt-icon',
  standalone: true,
  // El tamaño va en línea sobre el glifo: la hoja de Material Symbols fija 24 px en .material-symbols-rounded y, con la caja de
  // `size` px y overflow hidden, un ícono de 16 o 18 px salía recortado.
  template: `<span class="material-symbols-rounded" aria-hidden="true" [style.font-size.px]="size()" [style.--icon-opsz]="opticalSize()">{{ name() }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IconComponent {
  name = input.required<string>();
  size = input<number>(20);
  filled = input<boolean>(false);
  weight = input<number>(400);

  /** Tamaño óptico de la fuente (20–48): el trazo se ajusta al tamaño real, no a 24 para todos. */
  protected opticalSize = computed(() => Math.min(48, Math.max(20, this.size())));
  color = input<string>();

  @HostBinding('style.width.px') get widthPx() {
    return this.size();
  }
  @HostBinding('style.height.px') get heightPx() {
    return this.size();
  }
  @HostBinding('style.font-size.px') get fontSizePx() {
    return this.size();
  }
  @HostBinding('style.display') readonly display = 'inline-flex';
  @HostBinding('style.align-items') readonly alignItems = 'center';
  @HostBinding('style.justify-content') readonly justifyContent = 'center';

  @HostBinding('style.color') get colorStyle() {
    return this.color() ?? null;
  }
  @HostBinding('style.--icon-fill') get fillVar() {
    return this.filled() ? 1 : 0;
  }
  @HostBinding('style.--icon-weight') get weightVar() {
    return this.weight();
  }
}
