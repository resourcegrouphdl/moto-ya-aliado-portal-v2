import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export interface PasoDelWizard<Id extends string = string> {
  id: Id;
  etiqueta: string;
  icono: string;
}

/**
 * Progreso de un asistente por pasos. Escritorio: todos los pasos con su ícono (los ya hechos se pueden tocar para volver).
 * Celular (≤ 640 px): un indicador compacto —nombre del paso, «Paso n de N» y una barra segmentada—, porque siete pasos no caben
 * y un scroll horizontal esconde justo el paso en el que estás.
 */
@Component({
  selector: 'mt-wizard-stepper',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './wizard-stepper.component.html',
  styleUrl: './wizard-stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WizardStepperComponent {
  pasos = input.required<readonly PasoDelWizard[]>();
  /** Posición (desde 0) del paso actual. */
  indice = input.required<number>();
  /** Se pide volver a un paso ya completado. */
  irA = output<string>();

  protected ir(id: string, posicion: number): void {
    if (posicion < this.indice()) {
      this.irA.emit(id);
    }
  }
}
