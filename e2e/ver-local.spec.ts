import { test } from '@playwright/test';
import { iniciarConRol } from './sesion';

/**
 * Abre el portal del aliado en ventanas visibles (escritorio y celular) con la sesión simulada de vendedor libre, para mirar el aspecto.
 * No corre en la suite normal: solo con VER_LOCAL=1  →  VER_LOCAL=1 npx playwright test e2e/ver-local.spec.ts --headed
 * Las ventanas siguen abiertas hasta que las cierres. Red simulada: no toca ningún backend.
 */
const TITULAR = {
  id: 'cliente-1', tipoDocumento: 'DNI', numeroDocumento: '12345678', nombres: 'JUAN CARLOS', apellidoPaterno: 'PEREZ',
  apellidoMaterno: 'GOMEZ', telefono: '987654321', email: 'juan@example.com', departamento: 'LIMA', provincia: 'LIMA',
  distrito: 'MIRAFLORES', ubigeoDistrito: '150122', direccion: 'Av. Siempre Viva 742', referencia: null, direccionSugerida: null,
  latitud: null, longitud: null, fechaNacimiento: '1990-01-02', nacionalidad: 'PERU', estadoCivil: 'SOLTERO', edad: 36
};
const VEHICULO = {
  id: 'v1', solicitudId: 's1', marca: 'Honda', modelo: 'CB160F', anio: 2026, color: 'Rojo', placa: null, numeroMotor: 'MOT123',
  numeroChasis: 'LF3PCLAE3TA000737', precioVehiculo: null, inicialIngresada: 1500, numeroPeriodos: 24, incluyeSoat: true
};
const REF = (n: number) => ({ id: `r${n}`, solicitudId: 's1', numero: n, nombres: `Ref${n}`, apellidos: 'Prueba', telefono: '999888777', relacion: 'Amigo(a)' });

function expediente(vehiculo: unknown, refs: number) {
  return {
    solicitud: { id: 's1', codigoSolicitud: 'SOL-2026-00099', estado: 'INCOMPLETA', canal: 'VENTA_DIRECTA', creadoEn: '2026-09-26T00:00:00-05:00' },
    titular: TITULAR,
    avalista: { ...TITULAR, id: 'cliente-2', numeroDocumento: '87654321', nombres: 'MARIA' },
    avalistaRelacion: 'Hermano(a)',
    vehiculo,
    referencias: Array.from({ length: refs }, (_, i) => REF(i + 1))
  };
}

async function simular(page: import('@playwright/test').Page, exp: unknown) {
  await page.route('**/partner/**', (r) => (r.request().url().includes('/expediente') ? r.fulfill({ json: exp }) : r.fulfill({ json: [] })));
  await page.route('**/partner/riesgo/pre-calificacion**', (r) => r.fulfill({ status: 500, json: {} }));
  await page.route(/\/api\/operaciones\/.*/, (r) => r.fulfill({ json: [] }));
}


test.skip(!process.env['VER_LOCAL'], 'solo con VER_LOCAL=1');

test('ver el portal del vendedor libre en escritorio y celular', async ({ browser }) => {
  test.setTimeout(0);
  const ventanas = [
    { viewport: { width: 1280, height: 820 } },
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
  ];
  const paginas = [];
  for (const opciones of ventanas) {
    const contexto = await browser.newContext(opciones);
    const page = await contexto.newPage();
    await simular(page, expediente(VEHICULO, 1));
    await iniciarConRol(page, 'VENDEDOR_LIBRE');
    await page.goto('/ejecutivo/solicitud/s1/continuar');
    paginas.push(page);
  }
  await Promise.all(paginas.map((p) => new Promise<void>((resolver) => p.on('close', () => resolver()))));
});
