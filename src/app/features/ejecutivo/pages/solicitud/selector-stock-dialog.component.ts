import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BadgeComponent, BadgeVariant } from '../../../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { ModalShellComponent } from '../../../../shared/ui/modal/modal-shell.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import {
  ModeloCatalogo,
  UnidadDisponible,
  esElegible,
  estadoDeStock
} from '../../../../core/inventario/inventario.models';
import { InventarioApiService } from '../../../../core/inventario/inventario-api.service';

export interface SeleccionStockDialogData {
  /** Modelo que el vendedor ya tenía elegido en la solicitud, si había alguno. */
  modeloId: string | null;
}

/** Lo que la solicitud se queda: la unidad y el modelo (de ahí salen marca/modelo/año del formulario). */
export interface SeleccionStockResult {
  unidad: UnidadDisponible;
  modelo: ModeloCatalogo;
}

/**
 * Selector de moto del stock de Motoya (DEC-075) para el **vendedor libre**: las motos del modelo
 * elegido con su estado real —libre (elegible), en camino (elegible: ya está facturada al importador
 * y llega igual; su ventana de reserva arranca al llegar, DEC-074) y reservada (visible con su
 * vencimiento, pero no elegible)—.
 *
 * <p>Antes eran dos filas de chips que solo mostraban unidades `DISPONIBLE`: una moto reservada por
 * otra solicitud simplemente no aparecía —parecía que no existía— y no había forma de saber si la
 * moto estaba en el salón o todavía venía.
 *
 * <p>Sin filtro por local acá: los locales de Motoya los administra su propia gente y este portal no
 * tiene acceso a esa lista (el endpoint de sucursales es del pool `admin` del gateway). El local de
 * cada moto se muestra por tipo —tienda, central, almacén—, que es lo que el vendedor necesita para
 * decirle al cliente dónde está.
 */
@Component({
  selector: 'mt-selector-stock-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ModalShellComponent,
    ButtonComponent,
    SelectComponent,
    AlertComponent,
    EmptyStateComponent,
    IconComponent,
    BadgeComponent
  ],
  templateUrl: './selector-stock-dialog.component.html',
  styleUrl: './selector-stock-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectorStockDialogComponent {
  private readonly inventarioApi = inject(InventarioApiService);
  private readonly dialogRef = inject(DialogRef<SeleccionStockResult | null>);
  private readonly data = inject<SeleccionStockDialogData | null>(DIALOG_DATA, { optional: true });

  protected readonly modelos = signal<ModeloCatalogo[]>([]);
  /** '' = «Todos los modelos»: el filtro arranca diciendo lo que muestra (vacío se lee como «falta
   * elegir algo»), y llega preseleccionado si el vendedor ya tenía un modelo elegido. */
  protected readonly modeloId = signal<string | null>(this.data?.modeloId ?? '');
  protected readonly unidades = signal<UnidadDisponible[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Qué pasó con la última moto que se tocó: una reservada no se puede tomar y hay que decirlo. */
  protected readonly aviso = signal<string | null>(null);

  protected readonly modeloOptions = computed<SelectOption<string>[]>(() => [
    { label: 'Todos los modelos del catálogo', value: '' },
    ...this.modelos().map((m) => ({ label: `${m.marca} ${m.modelo}`, value: m.id }))
  ]);

  protected readonly esElegible = esElegible;
  protected readonly estadoDeStock = estadoDeStock;

  constructor() {
    this.cargarModelos();
    this.cargarStock();
  }

  private cargarModelos(): void {
    this.inventarioApi.listarModelos().subscribe({
      // Solo los vigentes: un modelo descontinuado no se ofrece en una venta nueva.
      next: (modelos) => this.modelos.set(modelos.filter((m) => m.activo)),
      // El filtro por modelo es una ayuda para acotar, no un requisito: si falla, se ve todo el stock.
      error: () => this.modelos.set([])
    });
  }

  protected cargarStock(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.inventarioApi.listarStock(this.modeloId()).subscribe({
      next: (unidades) => {
        this.unidades.set(this.ordenar(unidades));
        this.cargando.set(false);
      },
      error: () => {
        this.unidades.set([]);
        this.cargando.set(false);
        // Un fallo no puede verse igual que «no hay motos»: el vendedor teclearía el VIN a mano y se
        // perdería la reserva sin que nadie se entere.
        this.error.set('No se pudo consultar el stock. Reintentá antes de cargar la moto a mano.');
      }
    });
  }

  protected cambiarModelo(modeloId: string | null): void {
    this.modeloId.set(modeloId || null);
    this.cargarStock();
  }

  /**
   * Primero lo que se puede elegir —y entre eso, las que ya están en el salón antes que las que
   * vienen— y al final las reservadas. Vendidas y bloqueadas no se listan: no son una opción y
   * ofrecerlas sería un error de venta.
   */
  private ordenar(unidades: UnidadDisponible[]): UnidadDisponible[] {
    const peso = (u: UnidadDisponible) => (esElegible(u) ? (u.estadoAbastecimiento === 'POR_RECIBIR' ? 1 : 0) : 2);
    return unidades
      .filter((u) => esElegible(u) || u.estadoComercial === 'RESERVADA')
      .sort((a, b) => peso(a) - peso(b) || a.vin.localeCompare(b.vin));
  }

  protected elegir(unidad: UnidadDisponible): void {
    if (!esElegible(unidad)) {
      // Se ve, se puede mirar, pero no se toma: la reserva del que llegó primero manda (DEC-061).
      this.aviso.set(
        `La moto ${unidad.vin} está reservada por otra solicitud. Elegí otra o pedile a Motoya que la libere.`
      );
      return;
    }
    const modelo = this.modelos().find((m) => m.id === unidad.modeloId);
    if (!modelo) {
      this.aviso.set('Esa moto no tiene modelo del catálogo: no se puede usar en esta solicitud.');
      return;
    }
    this.dialogRef.close({ unidad, modelo });
  }

  protected estadoBadge(unidad: UnidadDisponible): BadgeVariant {
    if (unidad.estadoComercial === 'RESERVADA') return 'warning';
    return unidad.estadoAbastecimiento === 'POR_RECIBIR' ? 'info' : 'success';
  }

  /** Dónde está la moto, sin nombres de local (este portal no tiene esa lista): el tipo alcanza para
   * que el vendedor sepa si está en el salón o en el almacén. */
  protected localDe(unidad: UnidadDisponible): string {
    switch (unidad.ubicacionTipo) {
      case 'TIENDA':
        return 'Tienda';
      case 'CENTRAL':
        return 'Central';
      case 'ALMACEN':
        return 'Almacén';
      default:
        return 'Local';
    }
  }

  protected close(): void {
    this.dialogRef.close(null);
  }
}
