import { Page } from '@playwright/test';
import { environment } from '../src/environments/environment';

export type RolDePrueba = 'ADMINISTRADOR_ALIADO' | 'EJECUTIVO_ALIADO' | 'VENDEDOR_LIBRE';

const CLAVE_FIREBASE = environment.firebase.apiKey;
const PROYECTO = environment.firebase.projectId;

const base64Url = (objeto: unknown) => Buffer.from(JSON.stringify(objeto)).toString('base64url');

/**
 * Un ID token **bien formado pero sintético**. El SDK de Firebase nunca verifica la firma en el
 * cliente: decodifica el payload y mira `exp`/`iat`. Por eso alcanza con armar el JWT con los claims
 * que la app lee —el `rol`, que es el portón de la vista— y una expiración cómoda: así
 * `getIdTokenResult()` devuelve exactamente lo que devolvería el token real.
 */
function idTokenSintetico(rol: RolDePrueba, uid: string, email: string): string {
  const ahora = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROYECTO}`,
    aud: PROYECTO,
    auth_time: ahora,
    user_id: uid,
    sub: uid,
    iat: ahora,
    exp: ahora + 3600,
    email,
    email_verified: true,
    firebase: { identities: {}, sign_in_provider: 'password' },
    rol
  };
  return `${base64Url({ alg: 'RS256', typ: 'JWT' })}.${base64Url(payload)}.firma-sintetica`;
}

/**
 * Deja el portal con una sesión iniciada y el rol pedido, **sin credenciales reales**: simula las
 * tres llamadas de Firebase Auth (login, refresh de token y lookup de perfil) y deja que el propio
 * SDK arme la sesión con sus claims.
 *
 * <p>Por qué así y no como admin-v2 (que guarda una sesión real en `e2e/.auth/`): este frontend
 * apunta al proyecto Firebase **real** (`motoya-form`, sin emulador) y el rol es un custom claim que
 * solo se cambia desde el IAM del gateway. Sin esta simulación, probar el portón `VENDEDOR_LIBRE`
 * exigiría crear un usuario libre en producción — justo lo que una prueba no debe necesitar.
 *
 * <p>Lo que **no** se simula: la red de la aplicación. Cada spec mockea sus endpoints con
 * `page.route`; de esta sesión solo se usan el uid y los claims.
 */
export async function iniciarConRol(page: Page, rol: RolDePrueba): Promise<void> {
  const uid = `e2e-${rol.toLowerCase().replace(/_/g, '-')}`;
  const email = `${uid}@example.com`;
  const nombre = rol === 'VENDEDOR_LIBRE' ? 'Vendedor Libre Prueba' : 'Ejecutivo Aliado Prueba';
  const idToken = idTokenSintetico(rol, uid, email);
  const refreshToken = 'refresh-sintetico';
  const camposDeCuenta = {
    localId: uid,
    email,
    emailVerified: true,
    displayName: nombre,
    passwordHash: 'hash-sintetico',
    // `validSince` es un string (segundos epoch) y el SDK lo exige para aceptar la cuenta.
    validSince: String(Math.floor(Date.now() / 1000)),
    lastLoginAt: String(Date.now()),
    createdAt: String(Date.now())
  };

  // Login: el cuerpo que devuelve identitytoolkit al validar usuario y contraseña.
  await page.route('**/v1/accounts:signInWithPassword**', (r) =>
    r.fulfill({
      json: {
        kind: 'identitytoolkit#VerifyPasswordResponse',
        registered: true,
        localId: uid,
        email,
        displayName: nombre,
        idToken,
        refreshToken,
        expiresIn: '3600'
      }
    })
  );
  // Refresco de token (el SDK lo pide solo si el token está por vencer) y lookup de perfil: los dos
  // tienen que contestar, porque un error acá hace que el SDK borre la sesión que acaba de crear.
  await page.route('**/securetoken.googleapis.com/v1/token**', (r) =>
    r.fulfill({
      json: {
        access_token: idToken,
        id_token: idToken,
        refresh_token: refreshToken,
        expires_in: '3600',
        token_type: 'Bearer',
        user_id: uid,
        project_id: PROYECTO
      }
    })
  );
  await page.route('**/v1/accounts:lookup**', (r) =>
    r.fulfill({ json: { kind: 'identitytoolkit#GetAccountInfoResponse', users: [camposDeCuenta] } })
  );

  await page.goto('/auth/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill('clave-sintetica');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 20_000 });
}

/** Solo para dejar explícita la clave con la que el SDK guarda la sesión (verificado con una sonda). */
export const CLAVE_SESION_FIREBASE = `firebase:authUser:${CLAVE_FIREBASE}:[DEFAULT]`;
