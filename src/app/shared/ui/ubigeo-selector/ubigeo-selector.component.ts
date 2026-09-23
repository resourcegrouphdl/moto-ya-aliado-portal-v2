import { ChangeDetectionStrategy, Component, DestroyRef, computed, forwardRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import {
  CatalogoUbigeo,
  UbicacionSeleccionada
} from '../../../core/ubigeo/ubigeo.models';
import {
  UbigeoService,
  buscarDepartamento,
  buscarProvincia,
  codigoDepartamentoPorNombre,
  codigoProvinciaPorNombre,
  opcionesDepartamento,
  opcionesDistrito,
  opcionesProvincia,
  ubicacionPorCodigoDistrito,
  ubicacionPorNombres
} from '../../../core/ubigeo/ubigeo.service';
import { SelectComponent } from '../select/select.component';

/**
 * Cascada obligatoria departamento → provincia → distrito de la dirección (2026-09-23, etapa 1 de originación /
 * DEC-029). Es un solo control (`ControlValueAccessor`) cuyo valor es una {@link UbicacionSeleccionada}: los tres
 * selects se habilitan en orden — sin departamento no hay provincias, sin provincia no hay distritos — para que no
 * se pueda guardar un distrito que no pertenece a su provincia.
 *
 * El distrito se busca escribiendo: son ~1890 en todo el Perú y desplazarse a mano no es viable. El buscador de
 * `mt-select` filtra sin tildes ni mayúsculas (`Jesús María` = `jesus maria`).
 *
 * Las direcciones capturadas ANTES de esta cascada se resuelven por nombre contra el catálogo (con alias para los
 * nombres que usa Google, ver `ubicacionPorNombres`); si no se pueden resolver, la ubicación vieja se muestra tal
 * como está guardada y se pide elegirla de nuevo — nunca se borra en silencio.
 */
@Component({
  selector: 'mt-ubigeo-selector',
  standalone: true,
  imports: [SelectComponent, ReactiveFormsModule],
  templateUrl: './ubigeo-selector.component.html',
  styleUrl: './ubigeo-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UbigeoSelectorComponent),
      multi: true
    }
  ]
})
export class UbigeoSelectorComponent implements ControlValueAccessor {
  private readonly ubigeo = inject(UbigeoService);
  private readonly destroyRef = inject(DestroyRef);

  errorMessage = input<string>();

  protected readonly controlDepartamento = new FormControl<string | null>({ value: null, disabled: true });
  protected readonly controlProvincia = new FormControl<string | null>({ value: null, disabled: true });
  protected readonly controlDistrito = new FormControl<string | null>({ value: null, disabled: true });

  protected readonly catalogo = signal<CatalogoUbigeo | null>(null);
  protected readonly cargando = signal(true);
  protected readonly falloCarga = signal(false);
  protected readonly departamento = signal<string | null>(null);
  protected readonly provincia = signal<string | null>(null);
  protected readonly distrito = signal<string | null>(null);
  /** Dirección guardada antes de la cascada que no se pudo resolver contra el catálogo (se muestra, no se pierde). */
  protected readonly ubicacionGuardada = signal<UbicacionSeleccionada | null>(null);

  protected readonly opcionesDepartamentos = computed(() => opcionesDepartamento(this.catalogo()));
  protected readonly opcionesProvincias = computed(() => opcionesProvincia(this.catalogo(), this.departamento()));
  protected readonly opcionesDistritos = computed(() => opcionesDistrito(this.catalogo(), this.provincia()));

  protected readonly hintProvincia = computed(() =>
    this.departamento() ? '' : 'Elige primero el departamento'
  );
  protected readonly hintDistrito = computed(() =>
    this.provincia() ? 'Escribe para buscar entre todos los distritos' : 'Elige primero la provincia'
  );

  private valorPendiente: UbicacionSeleccionada | null = null;
  private onChange: (value: UbicacionSeleccionada) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.ubigeo
      .catalogo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalogo) => {
          this.catalogo.set(catalogo);
          this.cargando.set(false);
          this.controlDepartamento.enable({ emitEvent: false });
          this.aplicarValor(this.valorPendiente);
        },
        error: () => {
          this.cargando.set(false);
          this.falloCarga.set(true);
        }
      });

    this.controlDepartamento.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((codigo) => {
      this.departamento.set(codigo);
      this.limpiarDesdeProvincia();
      this.controlProvincia.setValue(null, { emitEvent: false });
      codigo ? this.controlProvincia.enable({ emitEvent: false }) : this.controlProvincia.disable({ emitEvent: false });
      this.emitir();
    });

    this.controlProvincia.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((codigo) => {
      this.provincia.set(codigo);
      this.controlDistrito.setValue(null, { emitEvent: false });
      this.distrito.set(null);
      codigo ? this.controlDistrito.enable({ emitEvent: false }) : this.controlDistrito.disable({ emitEvent: false });
      this.emitir();
    });

    this.controlDistrito.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((codigo) => {
      this.distrito.set(codigo);
      this.ubicacionGuardada.set(null);
      this.emitir();
    });
  }

  writeValue(value: UbicacionSeleccionada | null): void {
    this.valorPendiente = value ?? null;
    this.aplicarValor(this.valorPendiente);
  }

  registerOnChange(fn: (value: UbicacionSeleccionada) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.controlDepartamento.disable({ emitEvent: false });
      this.controlProvincia.disable({ emitEvent: false });
      this.controlDistrito.disable({ emitEvent: false });
    } else if (this.catalogo()) {
      this.controlDepartamento.enable({ emitEvent: false });
      if (this.departamento()) this.controlProvincia.enable({ emitEvent: false });
      if (this.provincia()) this.controlDistrito.enable({ emitEvent: false });
    }
  }

  /** Aplica un valor al control (del formulario o del padre) sin volver a emitirlo — regla del `ControlValueAccessor`. */
  private aplicarValor(value: UbicacionSeleccionada | null): void {
    const catalogo = this.catalogo();
    if (!catalogo) return; // llega antes que el catálogo: se aplica cuando termine de cargar

    const conCodigo = value?.ubigeoDistrito ? ubicacionPorCodigoDistrito(catalogo, value.ubigeoDistrito) : null;
    const resuelta = conCodigo ?? ubicacionPorNombres(catalogo, value?.departamento ?? null, value?.provincia ?? null, value?.distrito ?? null);

    if (!resuelta) {
      // No se pudo resolver el distrito (nombre de Google, asentamiento humano, texto libre viejo): se deja
      // elegido lo que sí coincide (departamento y provincia) para que solo falte el distrito, y se muestra
      // aparte lo que había guardado — nunca se borra sin dejar rastro.
      this.preseleccionarPorNombres(value);
      this.ubicacionGuardada.set(value?.distrito ? value : null);
      return;
    }

    this.ubicacionGuardada.set(null);
    this.departamento.set(resuelta.codigoDepartamento);
    this.provincia.set(resuelta.codigoProvincia);
    this.distrito.set(resuelta.ubigeoDistrito);
    this.controlDepartamento.setValue(resuelta.codigoDepartamento, { emitEvent: false });
    this.controlProvincia.enable({ emitEvent: false });
    this.controlProvincia.setValue(resuelta.codigoProvincia, { emitEvent: false });
    this.controlDistrito.enable({ emitEvent: false });
    this.controlDistrito.setValue(resuelta.ubigeoDistrito, { emitEvent: false });
  }

  /**
   * Sin distrito resoluble, deja elegidos departamento y provincia si sus nombres coinciden con el catálogo:
   * es el caso del pin del mapa (`LIMA / LIMA` sin distrito) y el de una dirección vieja con distrito informal.
   * Así al vendedor solo le falta elegir el distrito.
   */
  private preseleccionarPorNombres(value: UbicacionSeleccionada | null): void {
    this.limpiarSeleccion();
    const catalogo = this.catalogo();
    const codigoDepartamento = codigoDepartamentoPorNombre(catalogo, value?.departamento ?? null);
    if (!codigoDepartamento) return;
    this.departamento.set(codigoDepartamento);
    this.controlDepartamento.setValue(codigoDepartamento, { emitEvent: false });
    this.controlProvincia.enable({ emitEvent: false });
    const codigoProvincia = codigoProvinciaPorNombre(catalogo, codigoDepartamento, value?.provincia ?? null);
    if (!codigoProvincia) return;
    this.provincia.set(codigoProvincia);
    this.controlProvincia.setValue(codigoProvincia, { emitEvent: false });
    this.controlDistrito.enable({ emitEvent: false });
  }

  private limpiarDesdeProvincia(): void {
    this.provincia.set(null);
    this.distrito.set(null);
    this.ubicacionGuardada.set(null);
  }

  private limpiarSeleccion(): void {
    this.departamento.set(null);
    this.provincia.set(null);
    this.distrito.set(null);
    this.controlDepartamento.setValue(null, { emitEvent: false });
    this.controlProvincia.setValue(null, { emitEvent: false });
    this.controlDistrito.setValue(null, { emitEvent: false });
    this.controlProvincia.disable({ emitEvent: false });
    this.controlDistrito.disable({ emitEvent: false });
  }

  /** Los tres nombres salen del catálogo — nunca del texto que se ve en pantalla. */
  private emitir(): void {
    const catalogo = this.catalogo();
    const departamento = buscarDepartamento(catalogo, this.departamento())?.nombre ?? '';
    const provincia = buscarProvincia(catalogo, this.provincia())?.nombre ?? '';
    const distrito = this.distrito()
      ? (buscarProvincia(catalogo, this.provincia())?.distritos.find((d) => d.codigo === this.distrito())?.nombre ?? '')
      : '';
    this.onChange({
      ubigeoDistrito: this.distrito(),
      departamento,
      provincia,
      distrito
    });
  }

  protected marcarTocado(): void {
    this.onTouched();
  }

  protected reintentar(): void {
    this.falloCarga.set(false);
    this.cargando.set(true);
    this.ubigeo.catalogo().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (catalogo) => {
        this.catalogo.set(catalogo);
        this.cargando.set(false);
        this.controlDepartamento.enable({ emitEvent: false });
        this.aplicarValor(this.valorPendiente);
      },
      error: () => {
        this.cargando.set(false);
        this.falloCarga.set(true);
      }
    });
  }
}
