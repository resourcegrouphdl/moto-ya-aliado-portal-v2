import { expect, test } from '@playwright/test';
import { iniciarConRol } from './sesion';

/**
 * Los documentos de la solicitud de crédito entran por **Document Management** (DEC-130): el archivo se registra con su tipo, su dueño (el
 * cliente: titular o aval) y la solicitud a la que está ligado, y la solicitud guarda el **id del Documento** —no una URL pública de
 * Firebase—. Para verlo, la URL de lectura se pide al abrirlo (vence). Un documento anterior sigue abriendo su enlace de siempre.
 *
 * Toda la red está simulada: no se sube ningún archivo a ningún bucket real.
 */
const SOLICITUD_ID = 'sol-dm-1';
const TITULAR_ID = 'cliente-titular-1';
const AVAL_ID = 'cliente-aval-1';
const DOCUMENTO_DM = 'doc-dm-dni';

const CLIENTE = {
  tipoDocumento: 'DNI', numeroDocumento: '12345678', nombres: 'JUAN CARLOS', apellidoPaterno: 'PEREZ', apellidoMaterno: 'GOMEZ',
  telefono: '987654321', email: 'juan@example.com', departamento: 'LIMA', provincia: 'LIMA', distrito: 'MIRAFLORES', ubigeoDistrito: '150122',
  direccion: 'Av. Siempre Viva 742', referencia: null, direccionSugerida: null, latitud: null, longitud: null, fechaNacimiento: '1990-01-02',
  nacionalidad: 'PERU', estadoCivil: 'SOLTERO', edad: 36
};

const EXPEDIENTE = {
  solicitud: { id: SOLICITUD_ID, codigoSolicitud: 'SOL-2026-00123', estado: 'INCOMPLETA', canal: 'VENTA_DIRECTA', creadoEn: '2026-10-01T00:00:00-05:00' },
  titular: { ...CLIENTE, id: TITULAR_ID },
  avalista: { ...CLIENTE, id: AVAL_ID, numeroDocumento: '87654321', nombres: 'MARIA' },
  avalistaRelacion: 'Hermano(a)',
  vehiculo: null,
  referencias: []
};

const ARCHIVO = { name: 'dni-frente.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) };

const documento = (extra: Record<string, unknown>) => ({
  id: 'ds-1', rol: 'TITULAR', tipo: 'LICENCIA_FRENTE', url: null, documentoId: null, subidoEn: '2026-10-01T10:00:00-05:00',
  estado: 'PENDIENTE', observaciones: null, validadoEn: null, ...extra
});

test('un documento del titular se sube por Document Management con su dueño y su solicitud', async ({ page }) => {
  await iniciarConRol(page, 'VENDEDOR_LIBRE');

  let registradoEnDm: Record<string, unknown> | null = null;
  let registradoEnSolicitud: Record<string, unknown> | null = null;
  let abrioLectura = false;

  await page.route('**/partner/**', (r) => {
    const url = r.request().url();
    if (url.includes('/expediente')) return r.fulfill({ json: EXPEDIENTE });
    if (url.endsWith(`/solicitudes/${SOLICITUD_ID}/documentos`) && r.request().method() === 'POST') {
      registradoEnSolicitud = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill({ status: 201, json: documento({ documentoId: DOCUMENTO_DM }) });
    }
    return r.fulfill({ json: [] });
  });
  // Después de la ruta amplia: la última registrada es la que gana. Sin la pre-calificación el wizard avisa discreto y sigue.
  await page.route('**/partner/riesgo/pre-calificacion**', (r) => r.fulfill({ status: 500, json: {} }));
  await page.route('**/api/operaciones/documentos/solicitar-subida', (r) =>
    r.fulfill({ json: { uploadUrl: 'https://storage.test/subida', gcsUri: 'gs://bucket/dni.jpg', contentType: 'image/jpeg' } })
  );
  await page.route('https://storage.test/**', (r) => r.fulfill({ status: 200 }));
  await page.route('**/api/operaciones/documentos', (r) => {
    registradoEnDm = r.request().postDataJSON() as Record<string, unknown>;
    return r.fulfill({ status: 201, json: { id: DOCUMENTO_DM } });
  });
  await page.route(`**/api/operaciones/documentos/${DOCUMENTO_DM}/url`, (r) => {
    abrioLectura = true;
    return r.fulfill({ json: { url: 'https://storage.test/lectura-temporal' } });
  });
  // El enlace de lectura temporal abre una pestaña: se atiende sin tocar la red.
  await page.route('https://storage.test/lectura-temporal', (r) => r.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' }));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ejecutivo/solicitud/${SOLICITUD_ID}/continuar`);
  // El expediente trae titular y aval sin vehículo: abre en «La moto»; los documentos del titular están dos pasos atrás.
  await expect(page.getByRole('heading', { name: 'La moto' })).toBeVisible();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await expect(page.getByRole('heading', { name: 'Documentos del titular' })).toBeVisible();

  await page.locator('mt-documento-upload').first().locator('input[type="file"]').setInputFiles(ARCHIVO);

  // En Document Management: su tipo, su dueño (el cliente titular) y la solicitud a la que está ligado.
  // El primer slot del paso es la licencia (frente): su tipo del catálogo de DM es LICENCIA_CONDUCIR. El DNI entra por la foto del OCR (F4).
  await expect.poll(() => registradoEnDm?.['tipo']).toBe('LICENCIA_CONDUCIR');
  expect(registradoEnDm?.['etiqueta']).toBe('Licencia de conducir — frente');
  expect(registradoEnDm?.['propietarioId']).toBe(TITULAR_ID);
  expect(registradoEnDm?.['entidadRelacionadaTipo']).toBe('SOLICITUD_CREDITO');
  expect(registradoEnDm?.['entidadRelacionadaId']).toBe(SOLICITUD_ID);
  expect(typeof registradoEnDm?.['hashIntegridad']).toBe('string');

  // En la solicitud: el id del Documento, no una url.
  await expect.poll(() => registradoEnSolicitud?.['documentoId']).toBe(DOCUMENTO_DM);
  expect(registradoEnSolicitud?.['url']).toBeUndefined();
  expect(registradoEnSolicitud?.['tipo']).toBe('LICENCIA_FRENTE');

  // «Ver» pide la URL de lectura temporal al abrirlo.
  const nueva = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Ver' }).first().click();
  await nueva;
  expect(abrioLectura).toBe(true);
  await page.screenshot({ path: 'test-results/solicitud-documento-dm.png' });
});

test('el documento del aval se sube con el aval como dueño', async ({ page }) => {
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  let registradoEnDm: Record<string, unknown> | null = null;

  await page.route('**/partner/**', (r) => {
    const url = r.request().url();
    if (url.includes('/expediente')) return r.fulfill({ json: EXPEDIENTE });
    if (url.endsWith('/documentos') && r.request().method() === 'POST') return r.fulfill({ status: 201, json: documento({ rol: 'AVALISTA', documentoId: DOCUMENTO_DM }) });
    return r.fulfill({ json: [] });
  });
  // Después de la ruta amplia: la última registrada es la que gana. Sin la pre-calificación el wizard avisa discreto y sigue.
  await page.route('**/partner/riesgo/pre-calificacion**', (r) => r.fulfill({ status: 500, json: {} }));
  await page.route('**/api/operaciones/documentos/solicitar-subida', (r) =>
    r.fulfill({ json: { uploadUrl: 'https://storage.test/subida', gcsUri: 'gs://bucket/dni.jpg', contentType: 'image/jpeg' } })
  );
  await page.route('https://storage.test/**', (r) => r.fulfill({ status: 200 }));
  await page.route('**/api/operaciones/documentos', (r) => {
    registradoEnDm = r.request().postDataJSON() as Record<string, unknown>;
    return r.fulfill({ status: 201, json: { id: DOCUMENTO_DM } });
  });

  await page.goto(`/ejecutivo/solicitud/${SOLICITUD_ID}/continuar`);
  await expect(page.getByRole('heading', { name: 'La moto' })).toBeVisible();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await expect(page.getByRole('heading', { name: 'Documentos del aval' })).toBeVisible();

  await page.locator('mt-documento-upload').first().locator('input[type="file"]').setInputFiles(ARCHIVO);
  await expect.poll(() => registradoEnDm?.['propietarioId']).toBe(AVAL_ID);
  expect(registradoEnDm?.['entidadRelacionadaId']).toBe(SOLICITUD_ID);
});

test('el detalle abre un documento nuevo por su enlace temporal y uno anterior por el de siempre; y reemplaza por Document Management', async ({ page }) => {
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  // Se registran las URLs que la pantalla pide abrir (un popup real no hereda las rutas simuladas).
  await page.addInitScript(() => {
    (window as unknown as { __abiertas: string[] }).__abiertas = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { __abiertas: string[] }).__abiertas.push(String(url));
      return null;
    };
  });
  const abiertas = () => page.evaluate(() => (window as unknown as { __abiertas: string[] }).__abiertas);
  const legado = documento({ id: 'ds-legado', tipo: 'FACHADA', url: 'https://storage.test/legado.jpg', estado: 'RECHAZADO', observaciones: 'borrosa' });
  const nuevo = documento({ id: 'ds-nuevo', tipo: 'SELFIE', documentoId: DOCUMENTO_DM });
  let pidioLectura = 0;
  let reemplazo: Record<string, unknown> | null = null;
  let registradoEnDm: Record<string, unknown> | null = null;

  await page.route('**/partner/**', (r) => {
    const url = r.request().url();
    if (url.includes('/expediente')) return r.fulfill({ json: EXPEDIENTE });
    if (url.endsWith(`/solicitudes/${SOLICITUD_ID}/documentos`)) return r.fulfill({ json: [legado, nuevo] });
    if (url.endsWith('/documentos/ds-legado/reemplazar')) {
      reemplazo = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill({ json: documento({ id: 'ds-legado', tipo: 'FACHADA', documentoId: 'doc-dm-fachada' }) });
    }
    return r.fulfill({ json: [] });
  });
  await page.route('**/api/operaciones/documentos/solicitar-subida', (r) =>
    r.fulfill({ json: { uploadUrl: 'https://storage.test/subida', gcsUri: 'gs://bucket/fachada.jpg', contentType: 'image/jpeg' } })
  );
  await page.route('https://storage.test/**', (r) => r.fulfill({ status: 200 }));
  await page.route('**/api/operaciones/documentos', (r) => {
    registradoEnDm = r.request().postDataJSON() as Record<string, unknown>;
    return r.fulfill({ status: 201, json: { id: 'doc-dm-fachada' } });
  });
  await page.route(`**/api/operaciones/documentos/${DOCUMENTO_DM}/url`, (r) => {
    pidioLectura += 1;
    return r.fulfill({ json: { url: 'https://storage.test/lectura-temporal' } });
  });

  await page.goto(`/ejecutivo/solicitud/${SOLICITUD_ID}`);
  await expect(page.getByText('Selfie').first()).toBeVisible();

  // Uno nuevo: la URL de lectura se pide al abrirlo.
  await page.getByRole('button', { name: /Selfie/ }).click();
  await expect.poll(abiertas).toEqual(['https://storage.test/lectura-temporal']);
  expect(pidioLectura).toBe(1);

  // Uno anterior a Document Management: abre su enlace de siempre, sin pedir nada.
  await page.getByRole('button', { name: /Fachada/ }).click();
  await expect.poll(abiertas).toEqual(['https://storage.test/lectura-temporal', 'https://storage.test/legado.jpg']);
  expect(pidioLectura).toBe(1);

  // Reemplazar el rechazado: el archivo nuevo entra por DM con el titular de dueño y manda su id.
  await page.locator('#reemplazo-ds-legado').setInputFiles(ARCHIVO);
  await expect.poll(() => reemplazo?.['documentoId']).toBe('doc-dm-fachada');
  expect(reemplazo?.['url']).toBeUndefined();
  expect(registradoEnDm?.['tipo']).toBe('FACHADA_DOMICILIO');
  expect(registradoEnDm?.['propietarioId']).toBe(TITULAR_ID);
  expect(registradoEnDm?.['entidadRelacionadaId']).toBe(SOLICITUD_ID);
});
