type RawQueryFn = <T = unknown>(
  query: string | TemplateStringsArray,
  ...values: unknown[]
) => Promise<T>;
type PrismaLike = { $queryRaw: RawQueryFn; $executeRaw: RawQueryFn };

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { PrismaClient } = require('@prisma/client') as {
  PrismaClient: new (...args: any[]) => PrismaLike;
};

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaLike | undefined;
}

export const prisma: PrismaLike =
  global.__prisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma__ = prisma;
}
