import { expect, test } from '@playwright/test';
import { iniciarConRol } from './sesion';

/**
 * La factura y el voucher del cliente entran por **Document Management** (fase D, 2026-09-28).
 *
 * La factura la emite la tienda aliada **al cliente**, no a Motoya: es su documento y el expediente de
 * la moto — no una cuenta por pagar ni una validación de Tesorería— y por eso el archivo se registra en
 * DM (DEC-057) y el expediente guarda **el id del Documento**, no una URL suelta de GCS. El OCR de la
 * factura tiene que pedirse con ese id (motoya-api la lee de DM y le manda el archivo en línea a
 * Document AI), y el voucher del pago de la inicial sigue el mismo camino.
 *
 * Toda la red está simulada: no se sube ningún archivo a ningún bucket real.
 */
const CONTRATO_ID = 'ct-1';
const DOCUMENTO_DM = 'doc-dm-1';

const CONTRATO = {
  id: CONTRATO_ID,
  numeroContrato: 'CT-2026-00007',
  canal: 'TIENDA_ALIADA',
  evaluacionId: 'ev-1',
  productoCreditoId: 'pr-1',
  tiendaId: null,
  fuenteFondeoId: null,
  precioVehiculo: 4500,
  inicialEsperada: 900,
  estadoFormalizacion: 'PENDIENTE_DOCUMENTOS',
  estadoCredito: null,
  motorCalculo: 'FRANCES',
  fechaFirma: null,
  documentoUrl: null,
  creadoPor: 'u-1',
  creadoEn: '2026-09-28T10:00:00-05:00',
  vendedorNombre: null,
  vehiculoReferencia: null
};

/** El archivo de prueba que se "sube": un byte cualquiera, nunca sale del navegador. */
const ARCHIVO = { name: 'factura.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) };

test('la factura se registra en Document Management y el OCR se pide con su documento', async ({ page }) => {
  await iniciarConRol(page, 'ADMINISTRADOR_ALIADO');

  let documentoRegistrado: Record<string, unknown> | null = null;
  let extraccion: Record<string, unknown> | null = null;
  let registroEnExpediente: Record<string, unknown> | null = null;
  let correcciones: Record<string, unknown> | null = null;

  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID, (r) => r.fulfill({ json: CONTRATO }));
  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID + '/cronograma', (r) => r.fulfill({ status: 404, json: {} }));
  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID + '/documentos/*/correcciones', (r) => {
    correcciones = r.request().postDataJSON() as Record<string, unknown>;
    return r.fulfill({ json: { reglasAprendidas: 1 } });
  });
  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID + '/documentos', (r) => {
    if (r.request().method() === 'POST') {
      registroEnExpediente = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill({ status: 201, json: { id: 'd-1', tipoDocumento: 'FACTURA' } });
    }
    return r.fulfill({ json: [] });
  });
  // Document Management: URL firmada -> subida directa -> registro del Documento.
  await page.route('**/api/operaciones/documentos/solicitar-subida', (r) =>
    r.fulfill({ json: { uploadUrl: 'https://storage.test/subida', gcsUri: 'gs://bucket/factura.jpg', contentType: 'image/jpeg' } })
  );
  await page.route('https://storage.test/**', (r) => r.fulfill({ status: 200 }));
  await page.route('**/api/operaciones/documentos', (r) => {
    if (r.request().method() === 'POST') {
      documentoRegistrado = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill({ status: 201, json: { id: DOCUMENTO_DM } });
    }
    return r.fulfill({ json: [] });
  });
  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID + '/documentos/extraer-factura', (r) => {
    extraccion = r.request().postDataJSON() as Record<string, unknown>;
    return r.fulfill({
      json: { marca: 'Honda', modelo: 'CB160F', anio: 2026, color: 'Rojo', numeroMotor: 'MOT98765', numeroChasis: 'CH12345', monto: 4500, posibleProblemaCalidad: false, detalleProblemaCalidad: null, datosOcrCrudo: null }
    });
  });

  await page.goto(`/administrador/contratos/${CONTRATO_ID}`);

  // El tipo se elige primero: el formulario cambia (campos del vehículo + «Registrar factura»).
  await page.getByLabel('Tipo de documento').click();
  await page.getByRole('option', { name: /Factura/i }).click();
  await page.locator('input[type="file"]').first().setInputFiles(ARCHIVO);

  // El archivo quedó registrado en DM con su tipo, su dueño (el expediente) y a qué está ligado.
  await expect.poll(() => documentoRegistrado?.['tipo']).toBe('FACTURA');
  expect(documentoRegistrado?.['entidadRelacionadaTipo']).toBe('CONTRATO');
  expect(documentoRegistrado?.['entidadRelacionadaId']).toBe(CONTRATO_ID);
  expect(documentoRegistrado?.['propietarioId']).toBe(CONTRATO_ID);

  // El OCR se pidió con el id del Documento (no con una ruta de GCS) y prellenó el formulario.
  await expect.poll(() => extraccion?.['documentoId']).toBe(DOCUMENTO_DM);
  expect(extraccion?.['gcsPath']).toBeUndefined();
  await expect(page.getByLabel('Marca')).toHaveValue('Honda');
  await expect(page.getByLabel('N° de chasis')).toHaveValue('CH12345');

  // Y al registrar, lo que viaja al expediente es el documento de DM — no una url.
  await page.getByRole('button', { name: /Registrar factura/i }).click();
  await expect.poll(() => registroEnExpediente?.['documentoId']).toBe(DOCUMENTO_DM);
  expect(registroEnExpediente?.['url']).toBeUndefined();

  // El aprendizaje (fase D): la tienda corrigió el prellenado y eso viaja como corrección.
  await expect.poll(() => (correcciones?.['campos'] as Record<string, string> | undefined)?.['NUMERO_CHASIS'])
    .toBe('CH12345');
});

test('el voucher de la inicial también va por Document Management', async ({ page }) => {
  await iniciarConRol(page, 'ADMINISTRADOR_ALIADO');

  let documentoRegistrado: Record<string, unknown> | null = null;
  let registroEnExpediente: Record<string, unknown> | null = null;

  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID, (r) => r.fulfill({ json: CONTRATO }));
  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID + '/cronograma', (r) => r.fulfill({ status: 404, json: {} }));
  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID + '/documentos', (r) => {
    if (r.request().method() === 'POST') {
      registroEnExpediente = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill({ status: 201, json: { id: 'd-2', tipoDocumento: 'BOUCHER' } });
    }
    return r.fulfill({ json: [] });
  });
  await page.route('**/api/operaciones/documentos/solicitar-subida', (r) =>
    r.fulfill({ json: { uploadUrl: 'https://storage.test/subida', gcsUri: 'gs://bucket/voucher.jpg', contentType: 'image/jpeg' } })
  );
  await page.route('https://storage.test/**', (r) => r.fulfill({ status: 200 }));
  await page.route('**/api/operaciones/documentos', (r) => {
    if (r.request().method() === 'POST') {
      documentoRegistrado = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill({ status: 201, json: { id: DOCUMENTO_DM } });
    }
    return r.fulfill({ json: [] });
  });

  await page.goto(`/administrador/contratos/${CONTRATO_ID}`);

  // El boucher del pago de la inicial es el tipo por defecto del formulario, y exige su monto.
  await page.getByLabel('Monto (S/)').fill('900');
  await page.locator('input[type="file"]').first().setInputFiles({ ...ARCHIVO, name: 'voucher.jpg' });
  await page.getByRole('button', { name: /Subir documento/i }).click();

  await expect.poll(() => documentoRegistrado?.['tipo']).toBe('VOUCHER');
  await expect.poll(() => registroEnExpediente?.['documentoId']).toBe(DOCUMENTO_DM);
});

/**
 * Fecha de corte 2026-09-28: con la evidencia de firma, la placa y el acta de entrega ya en el catálogo de
 * DM, **todo** el expediente entra por Document Management — la tienda ya no sube ningún documento por el
 * camino viejo de la URL firmada de GCS. Y el archivo ya registrado se abre pidiéndole la URL a DM **al
 * momento** (el enlace vence), no con una url guardada en el expediente.
 */
test('un tipo que antes iba por GCS entra por DM y el archivo se abre con su Documento', async ({ page }) => {
  await iniciarConRol(page, 'ADMINISTRADOR_ALIADO');

  let documentoRegistrado: Record<string, unknown> | null = null;
  let registroEnExpediente: Record<string, unknown> | null = null;
  const urlsDeLectura: string[] = [];
  let pedidosAlCaminoViejo = 0;

  await page.addInitScript(() => {
    (window as unknown as { __abiertas: string[] }).__abiertas = [];
    window.open = ((url: string) => {
      (window as unknown as { __abiertas: string[] }).__abiertas.push(url);
      return null;
    }) as typeof window.open;
  });

  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID, (r) => r.fulfill({ json: CONTRATO }));
  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID + '/cronograma', (r) => r.fulfill({ status: 404, json: {} }));
  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID + '/documentos', (r) => {
    if (r.request().method() === 'POST') {
      registroEnExpediente = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill({ status: 201, json: { id: 'd-3', tipoDocumento: 'EVIDENCIA_FIRMA', documentoId: DOCUMENTO_DM } });
    }
    return r.fulfill({
      json: [
        {
          id: 'd-3', contratoId: CONTRATO_ID, tipoDocumento: 'EVIDENCIA_FIRMA', documentoId: DOCUMENTO_DM, monto: null,
          estado: 'PENDIENTE', subidoPor: 'u-1', subidoEn: '2026-09-28T10:00:00-05:00',
          validadoPor: null, validadoEn: null, notas: null
        }
      ]
    });
  });
  // El camino viejo ya no se usa (y el backend ya no lo tiene): si algo lo llamara, quedaría registrado acá.
  await page.route('**/partner/contrato/contratos/*/documentos/solicitar-subida', (r) => {
    pedidosAlCaminoViejo += 1;
    return r.fulfill({ status: 410, json: {} });
  });
  await page.route('**/api/operaciones/documentos/solicitar-subida', (r) =>
    r.fulfill({ json: { uploadUrl: 'https://storage.test/subida', gcsUri: 'gs://bucket/firma.jpg', contentType: 'image/jpeg' } })
  );
  await page.route('https://storage.test/**', (r) => r.fulfill({ status: 200 }));
  await page.route('**/api/operaciones/documentos', (r) => {
    if (r.request().method() === 'POST') {
      documentoRegistrado = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill({ status: 201, json: { id: DOCUMENTO_DM } });
    }
    return r.fulfill({ json: [] });
  });
  await page.route('**/api/operaciones/documentos/*/url', (r) => {
    urlsDeLectura.push(r.request().url());
    return r.fulfill({ json: { url: 'https://storage.test/firma-firmada' } });
  });

  await page.goto(`/administrador/contratos/${CONTRATO_ID}`);

  // Abrir el archivo ya registrado: la URL se pide a DM con el id del Documento.
  await page.getByRole('button', { name: 'Ver archivo' }).click();
  await expect.poll(() => urlsDeLectura.length).toBe(1);
  expect(urlsDeLectura[0]).toContain('/api/operaciones/documentos/' + DOCUMENTO_DM + '/url');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __abiertas: string[] }).__abiertas))
    .toEqual(['https://storage.test/firma-firmada']);

  // La evidencia de firma —un tipo que antes se subía directo a GCS— entra por DM con su tipo del catálogo.
  await page.getByLabel('Tipo de documento').click();
  await page.getByRole('option', { name: /Evidencia de firma/i }).click();
  await page.locator('input[type="file"]').first().setInputFiles({ ...ARCHIVO, name: 'firma.jpg' });
  await page.getByRole('button', { name: /Subir documento/i }).click();

  await expect.poll(() => documentoRegistrado?.['tipo']).toBe('EVIDENCIA_FIRMA');
  await expect.poll(() => registroEnExpediente?.['documentoId']).toBe(DOCUMENTO_DM);
  expect(registroEnExpediente?.['url']).toBeUndefined();
  expect(pedidosAlCaminoViejo).toBe(0);
});

/**
 * Móvil primero (390 px): el expediente del contrato es una **página** acá, así que lo que no puede
 * desbordar es la pantalla entera — y el botón «Ver archivo» tiene que seguir siendo alcanzable.
 */
test('el expediente del contrato entra completo en un teléfono', async ({ page }) => {
  await iniciarConRol(page, 'ADMINISTRADOR_ALIADO');
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID, (r) => r.fulfill({ json: CONTRATO }));
  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID + '/cronograma', (r) => r.fulfill({ status: 404, json: {} }));
  await page.route('**/partner/contrato/contratos/' + CONTRATO_ID + '/documentos', (r) =>
    r.fulfill({
      json: [
        {
          id: 'd-3', contratoId: CONTRATO_ID, tipoDocumento: 'EVIDENCIA_FIRMA', documentoId: DOCUMENTO_DM,
          monto: null, estado: 'PENDIENTE', subidoPor: 'u-1', subidoEn: '2026-09-28T10:00:00-05:00',
          validadoPor: null, validadoEn: null, notas: null
        }
      ]
    })
  );

  await page.goto(`/administrador/contratos/${CONTRATO_ID}`);
  await expect(page.getByRole('button', { name: 'Ver archivo' })).toBeVisible();

  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(desborde).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/contrato-expediente-movil.png', fullPage: true });
});
