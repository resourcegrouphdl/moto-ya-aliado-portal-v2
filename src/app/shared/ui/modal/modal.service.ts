import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';

/** Portado de admin-v2 — solo `open()` (sin `confirm()`/`systemError()` genéricos, no hacían falta todavía aquí). */
@Injectable({ providedIn: 'root' })
export class ModalService {
  private readonly dialog = inject(Dialog);

  // Debe calzar con --duration-base en _motion.scss (motion.exit-up del panel).
  private static readonly EXIT_ANIMATION_MS = 200;

  /**
   * Abre cualquier componente como modal — el componente debe usar
   * <mt-modal-shell> en su propia plantilla para el header/body/footer.
   */
  open<T, R = unknown, D = unknown>(component: ComponentType<T>, config?: DialogConfig<D, DialogRef<R, T>>): DialogRef<R, T> {
    const ref = this.dialog.open<R, D, T>(component, {
      panelClass: 'mt-modal-panel',
      backdropClass: 'mt-modal-backdrop',
      ...config
    });
    return this.withExitAnimation(ref);
  }

  /**
   * mt-modal-shell entra con motion.enter-up, pero CDK Dialog remueve el nodo
   * del DOM al instante en cuanto se llama dialogRef.close() — la salida
   * quedaba sin ninguna animación. Se envuelve el close() del ref para agregar
   * la clase que dispara motion.exit-up y recién después ejecutar el close real de CDK.
   */
  private withExitAnimation<T, R>(ref: DialogRef<R, T>): DialogRef<R, T> {
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const originalClose = ref.close.bind(ref);

    ref.close = ((result?: R) => {
      if (prefersReducedMotion) {
        originalClose(result);
        return;
      }
      ref.overlayRef.overlayElement.classList.add('mt-modal-panel--closing');
      ref.overlayRef.backdropElement?.classList.add('mt-modal-backdrop--closing');
      setTimeout(() => originalClose(result), ModalService.EXIT_ANIMATION_MS);
    }) as DialogRef<R, T>['close'];

    return ref;
  }
}
