import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';

/**
 * Ripple ligero, sin dependencias (Material, etc.) — un solo círculo que se
 * expande y desvanece desde el punto de click. Puramente decorativo, así que
 * se omite por completo con prefers-reduced-motion (no solo se acorta).
 */
@Directive({
  selector: '[mtRipple]',
  standalone: true
})
export class RippleDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  mtRippleDisabled = input(false);

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    if (this.mtRippleDisabled()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const host = this.el.nativeElement;
    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'mt-ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    const previous = host.querySelector<HTMLElement>('.mt-ripple');
    previous?.remove();

    host.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }
}
