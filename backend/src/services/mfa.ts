import speakeasy from 'speakeasy';

export function verificarCodigoTotp(secret: string, token: unknown, time?: number): token is string {
  return typeof token === 'string'
    && /^\d{6}$/.test(token)
    && speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
      ...(time === undefined ? {} : { time }),
    });
}
