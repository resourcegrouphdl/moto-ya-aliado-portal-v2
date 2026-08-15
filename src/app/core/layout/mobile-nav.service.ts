import { Injectable, signal } from '@angular/core';

/**
 * Estado del drawer del sidebar en mobile — compartido entre NavbarComponent
 * (dispara el toggle) y SidebarComponent (lee el estado, se cierra al navegar
 * o al tocar el backdrop en ShellComponent). Solo importa por debajo de
 * $bp-md (ver sidebar.component.scss) — en desktop el sidebar siempre está
 * visible y este estado se ignora.
 */
@Injectable({ providedIn: 'root' })
export class MobileNavService {
  private readonly _open = signal(false);
  readonly open = this._open.asReadonly();

  toggle(): void {
    this._open.update((v) => !v);
  }

  close(): void {
    this._open.set(false);
  }
}
