import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnInit,
  PLATFORM_ID,
  booleanAttribute,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GoogleMapsModule } from '@angular/google-maps';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ButtonComponent } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';

export interface DireccionParseada {
  /**
   * Ausente cuando el geocoding se originó en el texto tipeado por el
   * usuario (nunca se debe pisar lo que está escribiendo) o cuando Google no
   * encontró calle/número reales para el punto marcado (zona sin catastro —
   * bug real 2026-08-10: antes esto caía a un Plus Code que terminaba
   * impreso tal cual en los contratos; ver {@code obtenerDireccionReversa}).
   * Cuando está presente, SÍ se auto-completa el campo "Dirección" del
   * formulario padre — es la misma dirección real que trae Google, auto-
   * completar acá está bien.
   */
  direccion?: string;
  /**
   * Igual que {@code direccion} cuando Google encontró algo real — se emite
   * aparte para que el padre la guarde en {@code direccionSugerida} (columna
   * propia, uso futuro) independientemente de si el vendedor luego edita a
   * mano el campo "Dirección". Nunca se usa para documentos generados
   * (contratos, etc.) — esa fuente sigue siendo únicamente `direccion`.
   */
  direccionSugerida?: string;
  departamento: string;
  provincia: string;
  distrito: string;
}

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

type EstadoGps = 'idle' | 'capturado';
type ModoMapa = 'roadmap' | 'satellite';

const CENTRO_DEFAULT: google.maps.LatLngLiteral = { lat: -12.0464, lng: -77.0428 };

/**
 * Picker de ubicación GPS del domicilio (titular/aval, BC-01) — portado de
 * mvmotors-front (legacy), reescrito a señales para calzar con el resto de
 * componentes `mt-*` (OnPush + signals) en vez del estilo por decoradores +
 * mutación directa de campos del original. Sigue necesitando el cargador
 * manual de <script> de Google Maps porque Geocoder se usa imperativamente —
 * @angular/google-maps solo cubre <google-map>/<map-marker> como directivas.
 *
 * <p>El campo de texto libre "Dirección" del formulario padre es la ÚNICA
 * fuente de lo que termina en los documentos generados (contratos, etc.) —
 * este componente nunca lo escribe por su cuenta (bug real 2026-08-10: antes
 * el reverse-geocoding al marcar el pin sí lo hacía, y en zonas sin catastro
 * terminaba imprimiendo un Plus Code en vez de una dirección real). Lo que
 * Google sugiere para el punto marcado se muestra aparte
 * ({@code direccionAproximada}) y se emite como {@code direccionSugerida} —
 * el padre decide qué hacer con eso (guardarlo aparte para uso futuro,
 * mostrar el botón "Usar esta dirección" que copia el texto a mano). El
 * forward-geocoding (buscar el pin a partir de lo tipeado, con debounce)
 * sigue funcionando igual que antes — eso sí ayuda a ubicar el mapa sin
 * pisar el campo de texto.
 */
@Component({
  selector: 'mt-gps-picker',
  standalone: true,
  imports: [GoogleMapsModule, ButtonComponent, IconComponent],
  templateUrl: './gps-picker.component.html',
  styleUrl: './gps-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GpsPickerComponent implements OnInit {
  label = input('Ubicación GPS del domicilio');
  esRequerido = input(false, { transform: booleanAttribute });
  /** Dirección tecleada en el campo de texto del formulario padre — dispara forward-geocoding con debounce. */
  direccionTexto = input('');

  coordenadasCambiadas = output<Coordenadas>();
  addressParsed = output<DireccionParseada>();
  /** El vendedor confirmó explícitamente que quiere copiar la sugerencia al campo "Dirección". */
  usarDireccionSugerida = output<string>();

  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);

  private geocoder: google.maps.Geocoder | null = null;
  private ultimaDireccionEmitida: string | null = null;
  private readonly direccionTexto$ = new Subject<string>();
  /** De dónde vino la última coordenada — determina si el reverse-geocoding puede pisar el campo de texto del padre. */
  private origenGeocodificacion: 'mapa' | 'texto' = 'mapa';

  private readonly seguirDireccionTexto = effect(() => this.direccionTexto$.next(this.direccionTexto()));

  constructor() {
    this.direccionTexto$
      .pipe(
        debounceTime(700),
        distinctUntilChanged(),
        filter((valor) => valor.trim().length > 4 && valor !== this.ultimaDireccionEmitida)
      )
      .subscribe((valor) => this.buscarDireccion(valor));
  }

  protected readonly estado = signal<EstadoGps>('idle');
  protected readonly mapsListo = signal(false);
  protected readonly expandido = signal(false);

  protected readonly coordenadas = signal<google.maps.LatLngLiteral | null>(null);
  protected readonly coordenadasTexto = signal('');
  protected readonly direccionAproximada = signal('');
  protected readonly modoMapa = signal<ModoMapa>('roadmap');
  /** Google no encontró calle/número (ni ningún resultado no-Plus-Code) para el punto marcado — zona sin catastro. */
  protected readonly sinDireccionExacta = signal(false);

  protected readonly centro = signal<google.maps.LatLngLiteral>(CENTRO_DEFAULT);
  protected readonly zoom = signal(13);

  protected readonly markerOptions = signal<google.maps.MarkerOptions>({
    draggable: true,
    title: 'Arrastra para ajustar tu ubicación'
  });

  protected readonly mapOptions = signal<google.maps.MapOptions>({
    mapTypeId: 'roadmap',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    zoomControl: true
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.cargarScriptMaps().then(() => {
      this.mapOptions.update((actual) => ({
        ...actual,
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER }
      }));

      this.markerOptions.update((actual) => ({
        ...actual,
        animation: google.maps.Animation.DROP,
        icon: {
          url:
            'data:image/svg+xml;charset=UTF-8,' +
            encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
              </filter>
              <path d="M20 0C9 0 0 9 0 20c0 15 20 28 20 28S40 35 40 20C40 9 31 0 20 0z"
                fill="#EF4444" filter="url(#shadow)"/>
              <circle cx="20" cy="20" r="8" fill="white" opacity="0.9"/>
              <circle cx="20" cy="20" r="4" fill="#EF4444"/>
            </svg>`),
          scaledSize: new google.maps.Size(40, 48),
          anchor: new google.maps.Point(20, 48)
        }
      }));

      this.geocoder = new google.maps.Geocoder();
      this.mapsListo.set(true);
    });
  }

  // ── Eventos del mapa ─────────────────────────────────────────────────────

  onMapClick(event: google.maps.MapMouseEvent): void {
    if (!event.latLng) return;
    this.origenGeocodificacion = 'mapa';
    this.actualizarCoordenadas(event.latLng.lat(), event.latLng.lng());
  }

  onMarkerDragEnd(event: google.maps.MapMouseEvent): void {
    if (!event.latLng) return;
    this.origenGeocodificacion = 'mapa';
    this.actualizarCoordenadas(event.latLng.lat(), event.latLng.lng());
  }

  // ── Sugerencia de dirección ──────────────────────────────────────────────

  /** El vendedor hizo clic en "Usar esta dirección" — copia la sugerencia al campo del formulario padre, a propósito. */
  protected confirmarDireccionSugerida(): void {
    const sugerida = this.direccionAproximada();
    if (!sugerida) return;
    this.ultimaDireccionEmitida = sugerida;
    this.usarDireccionSugerida.emit(sugerida);
  }

  // ── Modo mapa / satélite ─────────────────────────────────────────────────

  toggleModoMapa(): void {
    const siguiente: ModoMapa = this.modoMapa() === 'roadmap' ? 'satellite' : 'roadmap';
    this.modoMapa.set(siguiente);
    this.mapOptions.update((actual) => ({ ...actual, mapTypeId: siguiente }));
  }

  // ── Modal pantalla completa ──────────────────────────────────────────────

  abrirExpandido(): void {
    this.expandido.set(true);
    document.body.style.overflow = 'hidden';
  }

  cerrarExpandido(): void {
    this.expandido.set(false);
    document.body.style.overflow = '';
  }

  confirmarYCerrar(): void {
    this.cerrarExpandido();
  }

  // ── Limpiar ──────────────────────────────────────────────────────────────

  limpiarUbicacion(): void {
    this.coordenadas.set(null);
    this.coordenadasTexto.set('');
    this.direccionAproximada.set('');
    this.sinDireccionExacta.set(false);
    this.estado.set('idle');
  }

  // ── Helpers privados ─────────────────────────────────────────────────────

  private actualizarCoordenadas(lat: number, lng: number): void {
    this.coordenadas.set({ lat, lng });
    this.coordenadasTexto.set(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    this.estado.set('capturado');
    this.coordenadasCambiadas.emit({ latitud: lat, longitud: lng });
    this.obtenerDireccionReversa(lat, lng);
  }

  private buscarDireccion(direccion: string): void {
    if (!this.geocoder) return;
    this.geocoder.geocode({ address: direccion, region: 'pe' }, (results, status) => {
      this.ngZone.run(() => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.[0]) return;
        const ubicacion = results[0].geometry.location;
        const lat = ubicacion.lat();
        const lng = ubicacion.lng();
        this.centro.set({ lat, lng });
        this.zoom.set(17);
        this.origenGeocodificacion = 'texto';
        this.actualizarCoordenadas(lat, lng);
      });
    });
  }

  private obtenerDireccionReversa(lat: number, lng: number): void {
    if (!this.geocoder) return;
    this.geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      this.ngZone.run(() => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.length) return;

        // Google puede devolver un Plus Code como primer resultado cuando el
        // punto no tiene una dirección catastrada para esa ubicación exacta
        // (bug real 2026-08-10) — se descarta explícitamente en vez de
        // usarlo como "dirección aproximada".
        const resultado = results.find((r) => !r.types.includes('plus_code')) ?? null;
        this.direccionAproximada.set(resultado?.formatted_address ?? '');
        this.emitirDireccionParseada(resultado?.address_components ?? []);
      });
    });
  }

  private emitirDireccionParseada(components: google.maps.GeocoderAddressComponent[]): void {
    let calle = '';
    let numero = '';
    let distrito = '';
    let provincia = '';
    let departamento = '';

    for (const c of components) {
      if (c.types.includes('route')) calle = c.long_name;
      if (c.types.includes('street_number')) numero = c.long_name;
      if (c.types.includes('sublocality_level_1')) distrito = c.long_name;
      else if (!distrito && c.types.includes('locality')) distrito = c.long_name;
      if (c.types.includes('administrative_area_level_2')) provincia = c.long_name;
      if (c.types.includes('administrative_area_level_1')) departamento = c.long_name;
    }

    const calleYNumero = [calle, numero].filter(Boolean).join(' ');
    const hayDireccionReal = calleYNumero.length > 0;
    if (hayDireccionReal) {
      this.ultimaDireccionEmitida = calleYNumero;
    }

    // `direccion` (auto-completa el campo del padre) solo cuando: (a) el
    // geocoding vino del mapa, no de lo que el usuario está tipeando —
    // pisar el campo mientras escribe interrumpe la escritura; y (b) Google
    // encontró una calle/número reales, nunca un Plus Code/aproximación
    // (bug real 2026-08-10). `direccionSugerida` viaja aparte siempre que
    // haya una dirección real, sin importar el origen — el padre la guarda
    // en su propia columna para uso futuro, independiente de si el
    // vendedor edita luego el campo "Dirección" a mano.
    this.addressParsed.emit({
      ...(this.origenGeocodificacion === 'mapa' && hayDireccionReal ? { direccion: calleYNumero } : {}),
      ...(hayDireccionReal ? { direccionSugerida: calleYNumero } : {}),
      departamento,
      provincia,
      distrito
    });

    this.sinDireccionExacta.set(this.origenGeocodificacion === 'mapa' && !hayDireccionReal);
  }

  private cargarScriptMaps(): Promise<void> {
    if (typeof google !== 'undefined' && google.maps) return Promise.resolve();
    const ventana = window as unknown as { __googleMapsPromise?: Promise<void>; __onGoogleMapsReady?: () => void };
    if (ventana.__googleMapsPromise) {
      return ventana.__googleMapsPromise;
    }
    const promise = new Promise<void>((resolve, reject) => {
      ventana.__onGoogleMapsReady = () => resolve();
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places,geocoding&callback=__onGoogleMapsReady`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('No se pudo cargar Google Maps'));
      document.head.appendChild(script);
    });
    ventana.__googleMapsPromise = promise;
    return promise;
  }
}
