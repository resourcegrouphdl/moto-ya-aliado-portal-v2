import { expect, test } from '@playwright/test';
import { iniciarConRol } from './sesion';

/**
 * Los documentos de la solicitud de crédito entran por **Document Management** (DEC-130): el archivo se registra con su tipo, su dueño (el
 * cliente: titular o aval) y la solicitud a la que está ligado, y la solicitud guarda el **id del Documento** —no una URL pública de
 * Firebase—. Para verlo, la URL de lectura se pide al abrirlo (vence). Un documento anterior sigue abriendo su enlace de siempre.
 *
 * El portal del aliado **no llama a Document Management directo** (el gateway le cierra `/api/operaciones/**`): pide la URL de subida, registra lo
 * subido y lee por `motoya-api` (`…/documentos/dm/*`), que comprueba que la solicitud sea suya y resuelve el tipo y el dueño. Cada prueba verifica
 * que **ninguna** llamada salga hacia `/api/operaciones/documentos`.
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


/**
 * Las llamadas a Document Management (`/api/operaciones/documentos`) que haga el portal: en producción el gateway las rechaza para el pool `tienda`, así que
 * no debe haber ninguna. (El catálogo de modelos y el stock, también de `api-operaciones`, sí son lectura permitida a `tienda`.)
 */
async function vigilarOperaciones(page: import('@playwright/test').Page) {
  const llamadas: string[] = [];
  await page.route('**/api/operaciones/documentos**', (r) => {
    llamadas.push(`${r.request().method()} ${r.request().url()}`);
    return r.fulfill({ status: 403, json: { codigo: 'POOL_INCORRECTO' } });
  });
  return llamadas;
}

interface VistoDm {
  solicitud: Record<string, unknown> | null;
  registro: Record<string, unknown> | null;
  lecturas: string[];
}

/** Simula `motoya-api` como intermediario de Document Management: URL de subida, registro del archivo subido y lectura temporal. */
async function simularDmPorMotoya(page: import('@playwright/test').Page, opts: { documentoId?: string; fallaSubida?: boolean } = {}): Promise<VistoDm> {
  const visto: VistoDm = { solicitud: null, registro: null, lecturas: [] };
  await page.route('**/documentos/dm/solicitar-subida', (r) => {
    visto.solicitud = r.request().postDataJSON() as Record<string, unknown>;
    return opts.fallaSubida
      ? r.fulfill({ status: 500, json: {} })
      : r.fulfill({ json: { uploadUrl: 'https://storage.test/subida', gcsUri: 'gs://bucket/archivo.jpg', contentType: 'image/jpeg' } });
  });
  await page.route('https://storage.test/**', (r) => r.fulfill({ status: 200 }));
  await page.route('**/documentos/dm/registrar-subido', (r) => {
    visto.registro = r.request().postDataJSON() as Record<string, unknown>;
    return r.fulfill({ json: { documentoId: opts.documentoId ?? DOCUMENTO_DM } });
  });
  await page.route('**/documentos/*/url', (r) => {
    visto.lecturas.push(r.request().url());
    return r.fulfill({ json: { url: 'https://storage.test/lectura-temporal' } });
  });
  return visto;
}

const documento = (extra: Record<string, unknown>) => ({
  id: 'ds-1', rol: 'TITULAR', tipo: 'LICENCIA_FRENTE', url: null, documentoId: null, subidoEn: '2026-10-01T10:00:00-05:00',
  estado: 'PENDIENTE', observaciones: null, validadoEn: null, ...extra
});


test('un documento del titular se sube por Document Management a través de motoya-api', async ({ page }) => {
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  const operaciones = await vigilarOperaciones(page);
  let registradoEnSolicitud: Record<string, unknown> | null = null;

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
  const visto = await simularDmPorMotoya(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/ejecutivo/solicitud/${SOLICITUD_ID}/continuar`);
  // El expediente trae titular y aval sin vehículo: abre en «La moto»; los documentos del titular están dos pasos atrás.
  await expect(page.getByRole('heading', { name: 'La moto' })).toBeVisible();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await expect(page.getByRole('heading', { name: 'Documentos del titular' })).toBeVisible();

  await page.locator('mt-documento-upload').first().locator('input[type="file"]').setInputFiles(ARCHIVO);

  // 1) La URL de subida: pide el slot (el servidor resuelve el tipo del catálogo de Document Management).
  await expect.poll(() => visto.solicitud?.['tipo']).toBe('LICENCIA_FRENTE');
  expect(visto.solicitud?.['contentType']).toBe('image/jpeg');
  // 2) El registro del archivo subido: el rol y el archivo; el dueño y la solicitud los pone el servidor, no el navegador.
  await expect.poll(() => visto.registro?.['gcsUri']).toBe('gs://bucket/archivo.jpg');
  expect(visto.registro?.['rol']).toBe('TITULAR');
  expect(visto.registro?.['tipo']).toBe('LICENCIA_FRENTE');
  expect(visto.registro?.['etiqueta']).toBe('Licencia de conducir — frente');
  expect(visto.registro).not.toHaveProperty('propietarioId');
  // 3) En la solicitud: el id del Documento, no una url.
  await expect.poll(() => registradoEnSolicitud?.['documentoId']).toBe(DOCUMENTO_DM);
  expect(registradoEnSolicitud?.['url']).toBeUndefined();
  expect(registradoEnSolicitud?.['tipo']).toBe('LICENCIA_FRENTE');

  // «Ver» pide la URL de lectura temporal al abrirlo, por la fila del documento en la solicitud.
  const nueva = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Ver' }).first().click();
  await nueva;
  expect(visto.lecturas).toEqual([expect.stringContaining(`/solicitudes/${SOLICITUD_ID}/documentos/ds-1/url`)]);
  expect(operaciones).toEqual([]);
  await page.screenshot({ path: 'test-results/solicitud-documento-dm.png' });
});

test('el documento del aval se registra con el rol de aval', async ({ page }) => {
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  const operaciones = await vigilarOperaciones(page);

  await page.route('**/partner/**', (r) => {
    const url = r.request().url();
    if (url.includes('/expediente')) return r.fulfill({ json: EXPEDIENTE });
    if (url.endsWith('/documentos') && r.request().method() === 'POST') return r.fulfill({ status: 201, json: documento({ rol: 'AVALISTA', documentoId: DOCUMENTO_DM }) });
    return r.fulfill({ json: [] });
  });
  await page.route('**/partner/riesgo/pre-calificacion**', (r) => r.fulfill({ status: 500, json: {} }));
  const visto = await simularDmPorMotoya(page);

  await page.goto(`/ejecutivo/solicitud/${SOLICITUD_ID}/continuar`);
  await expect(page.getByRole('heading', { name: 'La moto' })).toBeVisible();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await expect(page.getByRole('heading', { name: 'Documentos del aval' })).toBeVisible();

  await page.locator('mt-documento-upload').first().locator('input[type="file"]').setInputFiles(ARCHIVO);
  await expect.poll(() => visto.registro?.['rol']).toBe('AVALISTA');
  expect(visto.registro).not.toHaveProperty('propietarioId');
  expect(operaciones).toEqual([]);
});

test('el detalle abre un documento nuevo por su enlace temporal y uno anterior por el de siempre; y reemplaza por Document Management', async ({ page }) => {
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  const operaciones = await vigilarOperaciones(page);
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
  let reemplazo: Record<string, unknown> | null = null;

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
  const visto = await simularDmPorMotoya(page, { documentoId: 'doc-dm-fachada' });

  await page.goto(`/ejecutivo/solicitud/${SOLICITUD_ID}`);
  await expect(page.getByText('Selfie').first()).toBeVisible();

  // Uno nuevo: la URL de lectura se pide al abrirlo.
  await page.getByRole('button', { name: /Selfie/ }).click();
  await expect.poll(abiertas).toEqual(['https://storage.test/lectura-temporal']);
  expect(visto.lecturas).toEqual([expect.stringContaining('/documentos/ds-nuevo/url')]);

  // Uno anterior a Document Management: abre su enlace de siempre, sin pedir nada.
  await page.getByRole('button', { name: /Fachada/ }).click();
  await expect.poll(abiertas).toEqual(['https://storage.test/lectura-temporal', 'https://storage.test/legado.jpg']);
  expect(visto.lecturas).toHaveLength(1);

  // Reemplazar el rechazado: el archivo nuevo entra por DM con el rol del documento y manda su id.
  await page.locator('#reemplazo-ds-legado').setInputFiles(ARCHIVO);
  await expect.poll(() => reemplazo?.['documentoId']).toBe('doc-dm-fachada');
  expect(reemplazo?.['url']).toBeUndefined();
  expect(visto.solicitud?.['tipo']).toBe('FACHADA');
  expect(visto.registro?.['rol']).toBe('TITULAR');
  expect(visto.registro?.['tipo']).toBe('FACHADA');
  expect(operaciones).toEqual([]);
});

// ---- F4 (DEC-130): la foto del DNI que alimenta el OCR, en el wizard ----

async function simularWizardConFotoDni(page: import('@playwright/test').Page, opts: { fallaDm: boolean }) {
  const operaciones = await vigilarOperaciones(page);
  const enSolicitud: { cuerpo: Record<string, unknown> | null } = { cuerpo: null };
  const clienteCreado = { ...CLIENTE, id: TITULAR_ID };
  await page.route('**/partner/**', (r) => {
    const url = r.request().url();
    const metodo = r.request().method();
    if (url.includes('/clientes/documento/') && metodo === 'GET') return r.fulfill({ status: 404, json: {} });
    if (url.endsWith('/clientes') && metodo === 'POST') return r.fulfill({ status: 201, json: clienteCreado });
    if (url.includes('/direccion') && metodo === 'PATCH') return r.fulfill({ json: clienteCreado });
    if (url.endsWith('/solicitudes') && metodo === 'POST') return r.fulfill({ status: 201, json: EXPEDIENTE.solicitud });
    if (url.endsWith(`/solicitudes/${SOLICITUD_ID}/documentos`) && metodo === 'POST') {
      enSolicitud.cuerpo = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill({ status: 201, json: documento({ id: 'ds-dni', tipo: 'DNI_FRENTE', documentoId: enSolicitud.cuerpo['documentoId'] ?? null, url: enSolicitud.cuerpo['url'] ?? null }) });
    }
    if (url.endsWith('/documentos-identidad/solicitar-subida')) {
      return r.fulfill({ json: { uploadUrl: 'https://storage.test/paso', publicUrl: 'https://storage.test/paso-publica.jpg', gcsPath: 'staging/dni.jpg', headerRequeridoNombre: 'x-goog-meta-firebasestoragedownloadtokens', headerRequeridoValor: 'tok' } });
    }
    if (url.endsWith('/documentos-identidad/extraer')) {
      return r.fulfill({ json: { numeroDocumento: '12345678', fechaNacimiento: '1990-01-02', fechaEmision: null, fechaCaducidad: null, nacionalidad: 'PERU', posibleProblemaCalidad: false, detalleProblemaCalidad: null, posibleFraude: false, tipoDocumentoDetectado: null } });
    }
    return r.fulfill({ json: [] });
  });
  await page.route('**/partner/riesgo/pre-calificacion**', (r) => r.fulfill({ status: 500, json: {} }));
  const visto = await simularDmPorMotoya(page, { fallaSubida: opts.fallaDm });
  return { visto, enSolicitud, operaciones };
}

/** Llena el formulario del titular por el componente (el DNI, el mapa y la cascada de ubigeo no son lo que se prueba acá). */
async function completarFormularioDelTitular(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const ng = (window as unknown as { ng: { getComponent: (el: Element) => { formTitular: { patchValue: (v: unknown) => void } } } }).ng;
    const pagina = ng.getComponent(document.querySelector('mt-solicitud-page')!);
    pagina.formTitular.patchValue({
      tipoDocumento: 'DNI', numeroDocumento: '12345678', nombres: 'JUAN CARLOS', apellidoPaterno: 'PEREZ', apellidoMaterno: 'GOMEZ',
      telefono: '987654321', direccion: 'Av. Siempre Viva 742', fechaNacimiento: '1990-01-02', nacionalidad: 'PERU', estadoCivil: 'SOLTERO',
      ubicacion: { ubigeoDistrito: '150122', departamento: 'LIMA', provincia: 'LIMA', distrito: 'MIRAFLORES' }
    });
  });
}

test('la foto del DNI del wizard se registra por Document Management cuando se crea la solicitud', async ({ page }) => {
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  const { visto, enSolicitud, operaciones } = await simularWizardConFotoDni(page, { fallaDm: false });
  await page.goto('/ejecutivo/solicitud');
  await page.locator('mt-documento-identidad-upload').first().locator('input[type="file"]').setInputFiles(ARCHIVO);
  await expect(page.getByText(/Foto del DNI|listo|Cambiar/i).first()).toBeVisible();

  await completarFormularioDelTitular(page);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Documentos del titular' })).toBeVisible();

  await expect.poll(() => visto.registro?.['tipo']).toBe('DNI_FRENTE');
  expect(visto.registro?.['rol']).toBe('TITULAR');
  expect(visto.registro?.['etiqueta']).toBe('DNI (frente)');
  expect(visto.solicitud?.['tipo']).toBe('DNI_FRENTE');
  await expect.poll(() => enSolicitud.cuerpo?.['documentoId']).toBe(DOCUMENTO_DM);
  expect(enSolicitud.cuerpo?.['tipo']).toBe('DNI_FRENTE');
  expect(enSolicitud.cuerpo?.['url']).toBeUndefined();
  expect(operaciones).toEqual([]);
});

test('si Document Management no responde, la foto del DNI del wizard se registra como antes', async ({ page }) => {
  await iniciarConRol(page, 'VENDEDOR_LIBRE');
  const { visto, enSolicitud } = await simularWizardConFotoDni(page, { fallaDm: true });
  await page.goto('/ejecutivo/solicitud');
  await page.locator('mt-documento-identidad-upload').first().locator('input[type="file"]').setInputFiles(ARCHIVO);
  await expect(page.getByText(/Foto del DNI|listo|Cambiar/i).first()).toBeVisible();

  await completarFormularioDelTitular(page);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Documentos del titular' })).toBeVisible();

  await expect.poll(() => enSolicitud.cuerpo?.['url']).toBe('https://storage.test/paso-publica.jpg');
  expect(enSolicitud.cuerpo?.['documentoId']).toBeUndefined();
  expect(visto.registro).toBeNull();
});
