import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ModalShellComponent } from '../../../../shared/ui/modal/modal-shell.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ModeloCatalogo } from '../../../../core/inventario/inventario.models';

export interface PedirMotoDialogData {
  modelos: ModeloCatalogo[];
  /** Modelo que el vendedor ya tenía elegido en el selector, si lo había. */
  modeloId: string | null;
}

/** Lo que el vendedor pide: el pedido real se crea al guardar el paso (así un diálogo descartado no deja pedidos sueltos). */
export interface PedirMotoResultado {
  modeloId: string;
  color: string;
  nota: string | null;
}

/**
 * «No está: pedir esta moto» (DEC-152): el cliente quiere un modelo que no tenemos en el stock. El vendedor dice qué modelo y de qué color, y
 * gerencia verá el pedido en Compras para decidir cuándo comprarla; mientras tanto la solicitud sigue su curso con la moto «por pedir».
 */
@Component({
  selector: 'mt-pedir-moto-dialog',
  standalone: true,
  imports: [FormsModule, ModalShellComponent, ButtonComponent, InputComponent, AlertComponent, SelectComponent],
  template: `
    <mt-modal-shell title="Pedir esta moto" (closeRequested)="cerrar()">
      <p class="text-muted">
        La moto no está en el stock. Gerencia verá el pedido y decidirá cuándo comprarla; la solicitud sigue su curso mientras tanto.
      </p>
      @if (falta()) {
        <mt-alert variant="error">{{ falta() }}</mt-alert>
      }
      <mt-select label="Modelo" [options]="opciones()" [(ngModel)]="modeloId" (ngModelChange)="falta.set(null)" />
      <mt-input label="Color que pide el cliente" [(ngModel)]="color" (ngModelChange)="falta.set(null)" hint="Ej.: Rojo, Negro mate" />
      <mt-input label="Nota para gerencia (opcional)" [(ngModel)]="nota" hint="Ej.: lo necesita antes de fin de mes" />
      <div modal-footer>
        <mt-button variant="secondary" (click)="cerrar()">Volver</mt-button>
        <mt-button (click)="confirmar()">Pedir esta moto</mt-button>
      </div>
    </mt-modal-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PedirMotoDialogComponent {
  private readonly dialogRef = inject<DialogRef<PedirMotoResultado | null>>(DialogRef);
  private readonly data = inject<PedirMotoDialogData>(DIALOG_DATA);

  protected modeloId = this.data.modeloId ?? '';
  protected color = '';
  protected nota = '';
  protected readonly falta = signal<string | null>(null);

  protected readonly opciones = computed<SelectOption<string>[]>(() => [
    { label: 'Elige el modelo', value: '' },
    ...this.data.modelos.map((m) => ({ label: `${m.marca} ${m.modelo}`, value: m.id }))
  ]);

  protected cerrar(): void {
    this.dialogRef.close(null);
  }

  protected confirmar(): void {
    if (!this.modeloId) {
      this.falta.set('Elige el modelo que pide el cliente.');
      return;
    }
    if (!this.color.trim()) {
      this.falta.set('Escribe el color: sin color gerencia no puede pedir la moto.');
      return;
    }
    this.dialogRef.close({ modeloId: this.modeloId, color: this.color.trim(), nota: this.nota.trim() || null });
  }
}
