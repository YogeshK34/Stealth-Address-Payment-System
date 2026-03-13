const { execSync } = require('node:child_process');

function parsePorts(argv) {
  const parsed = argv
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0 && value < 65536);

  return parsed.length > 0 ? parsed : [3000, 3001, 5432];
}

function checkPort(port) {
  try {
    const output = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim();

    if (!output) {
      console.log(`[ports] ${port}: free`);
      return;
    }

    console.log(`[ports] ${port}: in use`);
    console.log(output);
  } catch {
    console.log(`[ports] ${port}: free`);
  }
}

function main() {
  const ports = parsePorts(process.argv.slice(2));
  for (const port of ports) {
    checkPort(port);
  }
}

main();