type BitGoModule = typeof import('bitgo');

function loadBitGo(): BitGoModule {
  const runtimeRequire = (0, eval)('require') as NodeRequire;
  return runtimeRequire('bitgo') as BitGoModule;
}

let _bitgo: InstanceType<BitGoModule['BitGo']> | null = null;

export function getBitGoInstance(): InstanceType<BitGoModule['BitGo']> {
  if (_bitgo) return _bitgo;

  const BitGo = loadBitGo();

  const env = (process.env['BITGO_ENV'] ?? 'test') as 'test' | 'prod';
  _bitgo = new BitGo.BitGo({ env });

  const token = process.env['BITGO_ACCESS_TOKEN'];
  if (token) {
    _bitgo.authenticateWithAccessToken({ accessToken: token });
  }

  return _bitgo;
}

export type BitGoEnv = 'test' | 'prod';
