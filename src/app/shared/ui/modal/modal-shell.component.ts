import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Chrome visual compartido de todo modal (header con título+cerrar, body,
 * footer opcional). Se usa DENTRO del componente que abre ModalService.open() —
 * no gestiona el DialogRef en sí, solo emite `closeRequested` para que el
 * consumidor decida (algunos modales piden confirmación antes de cerrar).
 * Portado tal cual desde admin-v2 (mismos tokens/mixins/motion, ver
 * pre-calificacion-alert-dialog.component.ts, primer consumidor en este proyecto).
 */
@Component({
  selector: 'mt-modal-shell',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './modal-shell.component.html',
  styleUrl: './modal-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalShellComponent {
  title = input.required<string>();
  showCloseButton = input(true, { transform: booleanAttribute });

  closeRequested = output<void>();
}
