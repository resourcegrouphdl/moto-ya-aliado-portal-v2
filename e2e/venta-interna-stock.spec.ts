import { expect, test } from '@playwright/test';
import { iniciarConRol } from './sesion';

/**
 * Venta interna en el portal del aliado (red-comercial-y-rentabilidad.md §10.1, DEC-060/DEC-066/
 * DEC-075): **solo el vendedor libre** trabaja con el stock y el catálogo de Motoya; el ejecutivo de
 * una tienda aliada trae su propia moto, su precio y su factura (DEC-072) y no ve este bloque.
 *
 * <p>Es el portón que la auditoría del 2026-09-26 marcó sin ninguna prueba (F-M5) — y el repo no
 * tenía arnés de Playwright: este es el primero. La sesión se simula (`e2e/sesion.ts`, sin
 * credenciales reales) y toda la red de la aplicación se mockea con `page.route`.
 */
const SOLICITUD_ID = 'sol-libre-1';
const CELULAR = { width: 390, height: 844 };

/** Vencimiento relativo a ahora: el contador de la reserva depende del reloj. */
const enHoras = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();

const TITULAR = {
  id: 'cliente-1',
  tipoDocumento: 'DNI',
  numeroDocumento: '12345678',
  nombres: 'JUAN CARLOS',
  apellidoPaterno: 'PEREZ',
  apellidoMaterno: 'GOMEZ',
  telefono: '987654321',
  email: 'juan@example.com',
  departamento: 'LIMA',
  provincia: 'LIMA',
  distrito: 'MIRAFLORES',
  ubigeoDistrito: '150122',
  direccion: 'Av. Siempre Viva 742',
  referencia: null,
  direccionSugerida: null,
  latitud: null,
  longitud: null,
  fechaNacimiento: '1990-01-02',
  nacionalidad: 'PERU',
  estadoCivil: 'SOLTERO'
};

/** Expediente con titular y aval ya cargados y **sin vehículo**: el wizard abre en el paso «La moto». */
const EXPEDIENTE = {
  solicitud: {
    id: SOLICITUD_ID,
    codigoSolicitud: 'MTD-0099',
    estado: 'INCOMPLETA',
    canal: 'VENTA_DIRECTA',
    creadoEn: '2026-09-26T00:00:00-05:00'
  },
  titular: TITULAR,
  avalista: { ...TITULAR, id: 'cliente-2', numeroDocumento: '87654321', nombres: 'MARIA' },
  avalistaRelacion: 'Hermano(a)',
  vehiculo: null,
  referencias: []
};

const MODELOS = [
  { id: 'modelo-honda-cb160f', marca: 'Honda', modelo: 'CB160F', categoria: 'Naked', precioCatalogo: 8500, precioMinimoNegociacion: 7800, activo: true }
];

function unidad(extra: Record<string, unknown>) {
  return {
    id: `unidad-${extra['vin']}`,
    vin: 'LF3PCLAE3TA000737',
    modeloId: 'modelo-honda-cb160f',
    anioModelo: 2026,
    estadoComercial: 'DISPONIBLE',
    estadoAbastecimiento: 'RECIBIDA',
    reservaExpiraEn: null,
    ubicacionTipo: 'TIENDA',
    ubicacionRefId: '22222222-2222-2222-2222-222222222222',
    ...extra
  };
}

const LIBRE = unidad({ vin: 'LF3PCLAE3TA000737' });
const EN_CAMINO = unidad({ vin: 'LF3PCLAE3TA000888', estadoAbastecimiento: 'POR_RECIBIR' });
const RESERVADA = unidad({
  vin: 'LF3PCLAE3TA000999',
  estadoComercial: 'RESERVADA',
  reservaExpiraEn: enHoras(30)
});

/** Red del wizard: expediente del aliado + catálogo/stock de Motoya. */
async function simular(page: import('@playwright/test').Page) {
  await page.route('**/partner/**', (r) => {
    const url = r.request().url();
    if (url.includes('/expediente')) return r.fulfill({ json: EXPEDIENTE });
    // Documentos e historial: vacíos, acá no es lo que se prueba.
    return r.fulfill({ json: [] });
  });
  // Equifax no responde: el wizard lo avisa discreto y sigue, sin el modal de pre-calificación que
  // taparía el selector (ese modal no es lo que se prueba acá, y su ausencia hace la prueba estable).
  await page.route('**/partner/riesgo/pre-calificacion**', (r) => r.fulfill({ status: 500, json: {} }));
  await page.route(/\/api\/operaciones\/modelos(\?.*)?$/, (r) => r.fulfill({ json: MODELOS }));
  await page.route(/\/api\/operaciones\/unidades-vehiculares(\?.*)?$/, (r) =>
    r.fulfill({ json: { contenido: [LIBRE, EN_CAMINO, RESERVADA], total: 3, page: 0, size: 100 } })
  );
}

test('el vendedor libre elige la moto del stock de Motoya en el paso «La moto»', async ({ page }) => {
  await simular(page);
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  await page.goto(`/ejecutivo/solicitud/${SOLICITUD_ID}/continuar`);

  // El bloque que DEC-060 reserva para la venta interna, solo con las motos libres o en camino.
  await expect(page.locator('.catalogo-interno')).toBeVisible();
  await page.getByRole('button', { name: 'Elegir moto del stock' }).click();

  // Scoped al overlay: el aviso de pre-calificación también es un mt-modal-shell.
  const modal = page.locator('.mt-modal-panel mt-modal-shell');
  await expect(modal).toContainText('Elegir moto del stock de Motoya');
  await expect(modal).toContainText(LIBRE.vin);
  await expect(modal).toContainText('Libre');
  await expect(modal).toContainText('En camino');
  await expect(modal).toContainText('Reservada · vence en');
  await page.screenshot({ path: 'test-results/aliado-selector-stock.png' });

  // Una reservada se ve pero no se puede tomar: la reserva del que llegó primero manda (DEC-061).
  await modal.getByRole('button', { name: new RegExp(RESERVADA.vin) }).click();
  await expect(modal).toContainText(`La moto ${RESERVADA.vin} está reservada por otra solicitud`);
  await expect(modal).toBeVisible();

  // Elegir la libre cierra el modal y precompleta marca/modelo/año/chasis del formulario de la moto.
  await modal.getByRole('button', { name: new RegExp(LIBRE.vin) }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByLabel('Marca')).toHaveValue('Honda');
  await expect(page.getByLabel('Modelo')).toHaveValue('CB160F');
  await expect(page.getByLabel(/N° de chasis/)).toHaveValue(LIBRE.vin);
  await expect(page.getByText('Moto elegida:')).toBeVisible();
  await page.screenshot({ path: 'test-results/aliado-moto-elegida.png', fullPage: true });
});

test('el ejecutivo de una tienda aliada NO ve el stock de Motoya (DEC-060/DEC-072)', async ({ page }) => {
  await simular(page);
  await iniciarConRol(page, 'EJECUTIVO_ALIADO');
  await page.goto(`/ejecutivo/solicitud/${SOLICITUD_ID}/continuar`);

  // Su moto la carga él: el stock propio de Motoya no es asunto suyo, y si lo viera podría reservar
  // una unidad nuestra para una solicitud que no es venta interna.
  await expect(page.locator('.catalogo-interno')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Elegir moto del stock' })).toHaveCount(0);
  // El paso sigue siendo el de la moto: el formulario manual está, lo que no está es el catálogo.
  await expect(page.getByLabel('Marca')).toBeVisible();
  await page.screenshot({ path: 'test-results/aliado-sin-stock.png', fullPage: true });
});

test('un fallo del stock se ve como fallo, no como «no hay motos» (F-A3)', async ({ page }) => {
  await simular(page);
  let fallando = true;
  // Sobrescribe el mock del stock (el último route registrado gana).
  await page.route(/\/api\/operaciones\/unidades-vehiculares(\?.*)?$/, (r) =>
    fallando ? r.fulfill({ status: 500, json: {} }) : r.fulfill({ json: { contenido: [LIBRE], total: 1, page: 0, size: 100 } })
  );

  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  await page.goto(`/ejecutivo/solicitud/${SOLICITUD_ID}/continuar`);
  await page.getByRole('button', { name: 'Elegir moto del stock' }).click();

  // Si esto se viera igual que «no hay motos», el vendedor cargaría la moto a mano y se perdería la
  // reserva sin que nadie se entere.
  const modal = page.locator('.mt-modal-panel mt-modal-shell');
  await expect(modal).toContainText('No se pudo consultar el stock');
  await expect(modal).not.toContainText('No hay motos de este modelo');

  fallando = false;
  await modal.getByRole('button', { name: 'Reintentar' }).click();
  await expect(modal).toContainText(LIBRE.vin);
});

test('en celular el selector se usa a 390 px sin desbordar', async ({ page }) => {
  await page.setViewportSize(CELULAR);
  await simular(page);
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  await page.goto(`/ejecutivo/solicitud/${SOLICITUD_ID}/continuar`);
  await page.getByRole('button', { name: 'Elegir moto del stock' }).click();

  const modal = page.locator('.mt-modal-panel mt-modal-shell');
  await expect(modal).toContainText(LIBRE.vin);
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(0);
  await modal.screenshot({ path: 'test-results/aliado-selector-celular.png' });
});
