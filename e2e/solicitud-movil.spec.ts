import { expect, test } from '@playwright/test';
import { iniciarConRol } from './sesion';

/**
 * El wizard de solicitud en el celular y en escritorio (auditoría UX/UI 2026-10-01): indicador compacto en vez de un stepper que
 * esconde el paso actual, pie con «Atrás» y la acción principal siempre a la mano, sin scroll horizontal. Red simulada, sesión simulada.
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

const CELULAR = { width: 390, height: 844 };

test('celular: el indicador compacto dice dónde estás y el pie queda a la mano', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await simular(page, expediente(VEHICULO, 1));
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  await page.goto('/ejecutivo/solicitud/s1/continuar');

  const compacto = page.getByRole('progressbar', { name: 'Progreso de la solicitud' });
  await expect(compacto).toContainText('Referencias');
  await expect(compacto).toContainText('Paso 6 de 7');
  // El stepper de 7 pasos (que en 390 px dejaba fuera el paso actual) ya no se pinta.
  await expect(page.locator('ol.stepper')).toBeHidden();

  // El pie está dentro de la ventana aunque el formulario sea largo, y no hay scroll horizontal.
  const atras = page.getByRole('button', { name: 'Atrás' });
  await expect(atras).toBeVisible();
  const caja = await page.getByRole('button', { name: /Continuar/ }).boundingBox();
  expect(caja!.y + caja!.height).toBeLessThanOrEqual(CELULAR.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/wizard-celular-referencias.png' });
});

test('«Atrás» vuelve al paso anterior sin perder lo guardado', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await simular(page, expediente(VEHICULO, 1));
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  await page.goto('/ejecutivo/solicitud/s1/continuar');

  await expect(page.getByRole('heading', { name: 'Referencias personales' })).toBeVisible();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await expect(page.getByRole('heading', { name: 'La moto' })).toBeVisible();
  // Los datos de la moto siguen donde estaban.
  await expect(page.getByLabel('Modelo')).toHaveValue('CB160F');
  await expect(page.getByRole('progressbar', { name: 'Progreso de la solicitud' })).toContainText('Paso 5 de 7');
});

test('el primer paso no tiene «Atrás»', async ({ page }) => {
  await simular(page, expediente(null, 0));
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  await page.goto('/ejecutivo/solicitud');
  await expect(page.getByRole('heading', { name: 'Datos del titular' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atrás' })).toHaveCount(0);
});

test('escritorio: se conserva el stepper completo y el compacto no aparece', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await simular(page, expediente(VEHICULO, 2));
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  await page.goto('/ejecutivo/solicitud/s1/continuar');

  await expect(page.locator('ol.stepper')).toBeVisible();
  await expect(page.locator('.stepper__step')).toHaveCount(7);
  await expect(page.getByRole('progressbar', { name: 'Progreso de la solicitud' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Revisa antes de enviar' })).toBeVisible();
  // La revisión muestra la moto completa: color y chasis, no solo marca y precio.
  await expect(page.getByText('Chasis ' + VEHICULO.numeroChasis)).toBeVisible();
  await page.screenshot({ path: 'test-results/wizard-escritorio-revision.png' });
});
