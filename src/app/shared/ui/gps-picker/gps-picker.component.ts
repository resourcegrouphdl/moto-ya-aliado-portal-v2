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
  /** Ausente cuando el geocoding se originó en el texto tipeado por el usuario — nunca se debe pisar lo que está escribiendo. */
  direccion?: string;
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
 * Antes tenía su propio buscador de direcciones (Places Autocomplete) que
 * duplicaba visualmente el campo "Dirección" del formulario padre sin estar
 * sincronizados entre sí (corregido 2026-07-16). El campo de texto libre del
 * formulario sigue siendo la única fuente editable de la dirección — este
 * componente la sigue en ambos sentidos: reverse-geocoding cuando el
 * vendedor marca un punto en el mapa, y forward-geocoding (vía
 * {@code direccionTexto}, con debounce) cuando escribe la dirección a mano,
 * para que ubicar el pin no dependa de que sepa buscarlo manualmente en el
 * mapa (2026-07-20). {@code ultimaDireccionEmitida} evita el eco: el texto
 * que el propio reverse-geocoding acaba de escribir en el formulario padre
 * no debe disparar un nuevo forward-geocoding.
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
        if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
          const resultado = results[1] ?? results[0];
          this.direccionAproximada.set(resultado.formatted_address);
          this.emitirDireccionParseada(resultado.address_components || []);
        }
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

    const direccion = [calle, numero].filter(Boolean).join(' ') || this.direccionAproximada();
    this.ultimaDireccionEmitida = direccion;

    // Si el geocoding vino de lo que el usuario está tipeando, no se reenvía
    // `direccion` — pisar el campo con la versión normalizada de Google
    // interrumpe la escritura. Solo cuando el origen es el mapa (clic/arrastre
    // del pin) el texto del formulario se reemplaza por la dirección real.
    this.addressParsed.emit({
      ...(this.origenGeocodificacion === 'mapa' ? { direccion } : {}),
      departamento,
      provincia,
      distrito
    });
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
