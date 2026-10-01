import { expect, test } from '@playwright/test';
import { iniciarConRol } from './sesion';

/**
 * Recorrido del vendedor libre por el portal del aliado, con la sesión simulada (`e2e/sesion.ts`, sin
 * credenciales) y la red vacía: sirve para mirar qué ve una persona sin tienda al entrar, en
 * escritorio y en celular, y para tener una base cuando se siga desarrollando su panel.
 * Las capturas quedan en `test-results/libre-*.png`.
 */
const CELULAR = { width: 390, height: 844 };

async function simularRedVacia(page: import('@playwright/test').Page) {
  await page.route('**/partner/**', (r) => r.fulfill({ json: [] }));
  await page.route(/\/api\/operaciones\/.*/, (r) => r.fulfill({ json: [] }));
}

const PANTALLAS = [
  { nombre: 'clientes', ruta: '/ejecutivo/clientes' },
  { nombre: 'nueva-solicitud', ruta: '/ejecutivo/solicitud' },
  { nombre: 'calculadora', ruta: '/ejecutivo/calculadora' }
];

for (const formato of [
  { nombre: 'escritorio', viewport: { width: 1280, height: 800 } },
  { nombre: 'celular', viewport: CELULAR }
]) {
  test(`el vendedor libre recorre su portal (${formato.nombre})`, async ({ page }) => {
    await page.setViewportSize(formato.viewport);
    await simularRedVacia(page);
    await iniciarConRol(page, 'VENDEDOR_LIBRE');

    // Aterriza en su home y no ve nada de administración ni de comisiones de tienda.
    await expect(page).toHaveURL(/\/ejecutivo\/clientes/);

    for (const p of PANTALLAS) {
      await page.goto(p.ruta);
      await expect(page).toHaveURL(new RegExp(p.ruta));
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `test-results/libre-${formato.nombre}-${p.nombre}.png`, fullPage: true });
    }

    // Lo de tienda aliada no es suyo: «Mis comisiones» y el panel de administrador lo devuelven a su home.
    await page.goto('/administrador/contratos');
    await expect(page).not.toHaveURL(/\/administrador\//);
  });
}
