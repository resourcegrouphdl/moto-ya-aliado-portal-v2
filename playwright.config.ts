import { defineConfig, devices } from '@playwright/test';

/**
 * E2E del portal del aliado contra el stack local (`/levantar-local`: este frontend en :4301,
 * api-gateway en :8000). No arranca servidores: se asume el stack ya arriba.
 *
 * <p>Sesión: a diferencia de admin-v2 (que guarda una sesión real de Firebase en `e2e/.auth/`),
 * acá **no hace falta ninguna credencial** — `e2e/sesion.ts` deja el portal con una sesión
 * sintética del rol que cada prueba necesita, y toda la red se simula con `page.route`. Es lo que
 * permite probar el portón `VENDEDOR_LIBRE` (DEC-060/DEC-066) sin depender de un usuario libre real
 * en el Firebase de producción, que es el proyecto real que usa este frontend.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4301',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
