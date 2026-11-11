import { HttpErrorResponse } from '@angular/common/http';
import { hoyLima, mensajeDeError, soles } from '../../features/ejecutivo/pages/soat/soat.util';
import { comisionEstimada, lineaDeTiempoDelCredito, Seguimiento } from './soat.models';

function seguimiento(parcial: Partial<Seguimiento>): Seguimiento {
  return {
    id: 's1',
    codigo: 'SOAT-1',
    modalidad: 'CREDITO',
    estado: 'REGISTRADA',
    etapa: 'etapa',
    origen: 'ALIADO',
    clienteNombre: 'Lucia',
    numeroDocumento: '40123456',
    placa: 'ABC123',
    marca: 'HONDA',
    modelo: 'XR150L',
    precioSoat: 720,
    hitosCumplidos: [],
    motivoDeCierre: null,
    creadaEn: '2026-11-09T00:00:00Z',
    actualizadaEn: '2026-11-09T00:00:00Z',
    ...parcial
  };
}

describe('Línea de tiempo del crédito SOAT', () => {
  it('al registrarse, el primer paso es el actual y lleva «qué decirle»', () => {
    const pasos = lineaDeTiempoDelCredito(seguimiento({}));
    expect(pasos.length).toBe(8);
    expect(pasos[0].situacion).toBe('ACTUAL');
    expect(pasos[0].queDecirle).toBeTruthy();
    expect(pasos.slice(1).every((p) => p.situacion === 'PENDIENTE' && p.queDecirle === null)).toBeTrue();
  });

  it('con el contrato firmado y sin la inicial, el actual es la inicial', () => {
    const pasos = lineaDeTiempoDelCredito(seguimiento({ estado: 'FORMALIZANDO', hitosCumplidos: ['CONSENTIMIENTO', 'COTIZACION_ELEGIDA', 'CONTRATO_FIRMADO'] }));
    expect(pasos.find((p) => p.situacion === 'ACTUAL')?.titulo).toBe('Inicial pagada');
  });

  it('un crédito activo tiene todo hecho aunque falten hitos en el seguimiento', () => {
    const pasos = lineaDeTiempoDelCredito(seguimiento({ estado: 'ACTIVADA', hitosCumplidos: ['POLIZA_RECIBIDA'] }));
    expect(pasos.every((p) => p.situacion === 'HECHO')).toBeTrue();
  });

  it('no hay pasos si es al contado o terminó mal', () => {
    expect(lineaDeTiempoDelCredito(seguimiento({ modalidad: 'CONTADO' })).length).toBe(0);
    for (const estado of ['DESISTIDA', 'RECHAZADA', 'VENCIDA', 'ANULADA'] as const) {
      expect(lineaDeTiempoDelCredito(seguimiento({ estado })).length).toBe(0);
    }
  });

  it('nunca menciona brokers', () => {
    const textos = lineaDeTiempoDelCredito(seguimiento({})).flatMap((p) => [p.titulo, p.quien, p.queDecirle ?? '']);
    expect(textos.some((t) => /broker/i.test(t))).toBeFalse();
  });
});

describe('Comisión estimada del SOAT', () => {
  it('es el 3 % solo si la solicitud la lleva quien la captó', () => {
    expect(comisionEstimada(720, 'ALIADO')).toBe(21.6);
    expect(comisionEstimada(720, 'VENTA_PROPIA')).toBe(21.6);
    expect(comisionEstimada(720, 'LIBRE')).toBe(21.6);
    expect(comisionEstimada(720, 'PLATAFORMA')).toBeNull();
    expect(comisionEstimada(720, 'USUARIO_INTERNO')).toBeNull();
    expect(comisionEstimada(null, 'ALIADO')).toBeNull();
  });
});

describe('Utilidades de SOAT', () => {
  it('hoyLima usa el día de Lima, no el de Greenwich', () => {
    // 2026-11-10 03:00 UTC es todavía el 9 de noviembre a las 22:00 en Lima.
    expect(hoyLima(new Date('2026-11-10T03:00:00Z'))).toBe('2026-11-09');
    expect(hoyLima(new Date('2026-11-10T06:00:00Z'))).toBe('2026-11-10');
  });

  it('los importes salen con dos decimales', () => {
    expect(soles(108)).toBe('S/ 108.00');
    expect(soles(null)).toBe('S/ 0.00');
  });

  it('muestra el mensaje del servidor tal cual y, si no hay, uno de respaldo', () => {
    expect(mensajeDeError(new HttpErrorResponse({ status: 409, error: { detail: 'Esta moto ya tiene una solicitud.' } }), 'x')).toBe('Esta moto ya tiene una solicitud.');
    expect(mensajeDeError(new HttpErrorResponse({ status: 0 }), 'x')).toContain('Sin conexión');
    expect(mensajeDeError(new HttpErrorResponse({ status: 500, error: null }), 'respaldo')).toBe('respaldo');
  });
});
