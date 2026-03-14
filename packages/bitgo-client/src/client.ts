type BitGoModule = typeof import('bitgo');

let _bitgo: InstanceType<BitGoModule['BitGo']> | null = null;

export async function getBitGoInstance(): Promise<InstanceType<BitGoModule['BitGo']>> {
  if (_bitgo) return _bitgo;

  const bitgoLib = await import('bitgo');

  const env = (process.env['BITGO_ENV'] ?? 'test') as 'test' | 'prod';
  _bitgo = new bitgoLib.BitGo({ env });

  const token = process.env['BITGO_ACCESS_TOKEN'];
  if (token) {
    _bitgo.authenticateWithAccessToken({ accessToken: token });
  }

  return _bitgo;
}

export type BitGoEnv = 'test' | 'prod';
