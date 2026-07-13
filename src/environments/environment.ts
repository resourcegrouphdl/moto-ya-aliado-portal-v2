// Producción (ng build sin --configuration development).
//
// El apiKey de Firebase web NO es secreto por diseño — la seguridad real la
// dan las Firebase Security Rules + Firebase Auth (y App Check si se activa),
// no ocultar este objeto. Es normal y esperado que quede visible en el bundle.
export const environment = {
  production: true,
  gatewayBaseUrl: 'https://moto-ya-gateway-26647667439.us-central1.run.app',
  // API key de cliente para Google Maps JS (Places + Geocoding) — GPS del
  // domicilio en el wizard de originación. Placeholder vacío a propósito:
  // completar en Google Cloud Console y restringir por referrer HTTP +
  // Maps JavaScript API/Places API/Geocoding API antes de usarla en real.
  googleMapsApiKey: '',
  firebase: {
    apiKey: 'AIzaSyDSm_NM4QShVmIhd_5SpJT2WG9tz4h6LLQ',
    authDomain: 'motoya-form.firebaseapp.com',
    projectId: 'motoya-form',
    storageBucket: 'motoya-form.appspot.com',
    messagingSenderId: '26647667439',
    appId: '1:26647667439:web:388dce55f64aac6115f11a',
    measurementId: 'G-9WCRJ5KVH6'
  }
};
