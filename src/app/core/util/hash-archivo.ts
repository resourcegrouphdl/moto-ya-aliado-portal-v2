/**
 * SHA-256 de un archivo, en el navegador (Web Crypto). El binario va directo a almacenamiento con una URL firmada y no pasa por el
 * backend, así que el hash de integridad que se registra en Document Management se calcula aquí, del mismo archivo elegido.
 */
export async function sha256Hex(archivo: Blob): Promise<string> {
  const buffer = await archivo.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
