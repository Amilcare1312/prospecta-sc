import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt) as (s: string, salt: Buffer, n: number) => Promise<Buffer>;

export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scrypt(senha, salt, 64);
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [alg, s, h] = guardado.split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const esperado = Buffer.from(h, 'base64');
  const calc = await scrypt(senha, Buffer.from(s, 'base64'), esperado.length);
  return calc.length === esperado.length && timingSafeEqual(calc, esperado);
}
