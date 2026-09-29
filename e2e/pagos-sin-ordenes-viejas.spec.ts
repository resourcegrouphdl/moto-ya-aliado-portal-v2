import { expect, test } from '@playwright/test';
import { iniciarConRol } from './sesion';

/**
 * Pieza 5 de la fase D (2026-09-28) — **la pantalla de pagos de la tienda ya no pide las órdenes del circuito
 * viejo**: esa ruta dejó de existir (el saldo que se le debe a la tienda es una obligación de Contabilidad, y la
 * inicial no es un pago nuestro). Lo que queda es «Contratos anteriores» — las facturas del legado, que se
 * consultan en vivo contra Firestore.
 *
 * Toda la red está simulada. El test guarda además la regresión: **nadie llama a `/ordenes-pago`**.
 */
test('la pantalla de pagos solo trae los contratos anteriores y no llama a las órdenes viejas', async ({ page }) => {
  const pedidos: string[] = [];
  page.on('request', (peticion) => pedidos.push(peticion.url()));

  await iniciarConRol(page, 'ADMINISTRADOR_ALIADO');

  await page.goto('/administrador/pagos');

  await expect(page.getByRole('heading', { name: 'Pagos' })).toBeVisible();
  // La descripción ya no habla de las cuotas iniciales y los desembolsos: eso se retiró, y con él su lista y su
  // estado vacío (que era el de las órdenes).
  await expect(page.getByText('Tus contratos anteriores y cómo van sus pagos.')).toBeVisible();
  await expect(page.getByText('Sin pagos todavía')).toHaveCount(0);

  // Lo que se retiró no se pide (y su endpoint ya no existe en el backend).
  const alViejo = pedidos.filter((url) => url.includes('/tesoreria/ordenes-pago'));
  expect(alViejo).toEqual([]);

  await page.screenshot({ path: 'test-results/pagos-tienda.png', fullPage: true });
});
