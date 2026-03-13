const net = require('node:net');
const { spawn } = require('node:child_process');

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        resolve(false);
        return;
      }

      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '::');
  });
}

async function pickPort(preferredPort, maxOffset = 20) {
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const candidate = preferredPort + offset;
    const available = await isPortAvailable(candidate);
    if (available) {
      return candidate;
    }
  }

  throw new Error(
    `No available port found in range ${preferredPort}-${preferredPort + maxOffset}`
  );
}

async function main() {
  const preferredPort = Number(process.env.WEB_PORT || process.env.PORT || 3000);
  const selectedPort = await pickPort(preferredPort);
  const nextCliPath = require.resolve('next/dist/bin/next');

  if (selectedPort !== preferredPort) {
    console.log(
      `[web:dev] Port ${preferredPort} is in use, starting Next.js on ${selectedPort}`
    );
  } else {
    console.log(`[web:dev] Starting Next.js on ${selectedPort}`);
  }

  const child = spawn(process.execPath, [nextCliPath, 'dev', '--port', String(selectedPort)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(selectedPort),
      NEXT_DEV_PORT: String(selectedPort),
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error('[web:dev] Failed to start Next.js dev server:', error.message);
  process.exit(1);
});