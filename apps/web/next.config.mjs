/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bitgo'],
  },
  transpilePackages: ['@stealth/shared', '@stealth/crypto', '@stealth/db'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      const prev = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean);
      config.externals = [
        ...prev,
        ({ request }, callback) => {
          if (request === 'bitgo' || (request && request.startsWith('@bitgo/'))) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
