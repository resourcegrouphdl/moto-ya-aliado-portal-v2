import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';
import { ModalShellComponent } from './modal-shell.component';

export interface PreCalificacionAlertDialogData {
  zona: 'AMARILLO' | 'ROJO';
  mensaje: string;
}

/**
 * Aviso de pre-calificación temprana (pedido 2026-08-14: consultar Equifax al obtener el DNI, antes de que el
 * vendedor invierta tiempo en KYC completo). A propósito solo recibe `zona`+`mensaje` genérico — nunca el detalle
 * del reporte crediticio (score, calificación SBS, montos de deuda): el vendedor no necesita verlo, solo saber que
 * hay un motivo (ver `CriterioPreCalificacion.mensajeVendedor()` en el backend, que es quien decide ese texto).
 *
 * <p>ROJO: solo "Entendido" — no hay forma de continuar, coherente con que el negocio pidió bloqueo duro sin
 * excepción para ese semáforo ("nuestro primer filtro"). AMARILLO: "Cancelar" / "Continuar bajo riesgo" — el
 * `DialogRef<boolean>` resuelve `true` solo si el vendedor elige continuar explícitamente.
 */
@Component({
  standalone: true,
  imports: [ModalShellComponent, ButtonComponent, IconComponent],
  template: `
    <mt-modal-shell [title]="titulo" [showCloseButton]="data.zona === 'AMARILLO'" (closeRequested)="cancelar()">
      <div class="mt-precal__aviso" [class.mt-precal__aviso--rojo]="data.zona === 'ROJO'">
        <mt-icon [name]="data.zona === 'ROJO' ? 'block' : 'warning'" [size]="28" />
        <p>{{ data.mensaje }}</p>
      </div>

      <div modal-footer>
        @if (data.zona === 'AMARILLO') {
          <mt-button variant="ghost" (click)="cancelar()">Cancelar</mt-button>
          <mt-button variant="danger" (click)="continuar()">Continuar bajo riesgo</mt-button>
        } @else {
          <mt-button variant="primary" (click)="cancelar()">Entendido</mt-button>
        }
      </div>
    </mt-modal-shell>
  `,
  styles: [
    `
      .mt-precal__aviso {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        color: var(--color-warning);

        p {
          margin: 0;
          color: var(--color-text);
          line-height: 1.5;
        }
      }

      .mt-precal__aviso--rojo {
        color: var(--color-error);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreCalificacionAlertDialogComponent {
  protected readonly data = inject<PreCalificacionAlertDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean>);

  protected readonly titulo = this.data.zona === 'ROJO' ? 'No es posible continuar' : 'Antes de continuar';

  continuar(): void {
    this.dialogRef.close(true);
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
