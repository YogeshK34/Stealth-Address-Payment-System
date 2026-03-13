const { execSync } = require('node:child_process');

function parsePorts(argv) {
  const parsed = argv
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0 && value < 65536);

  return parsed.length > 0 ? parsed : [3000, 3001];
}

function pidsOnPort(port) {
  try {
    const output = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim();

    if (!output) {
      return [];
    }

    return output
      .split('\n')
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value));
  } catch {
    return [];
  }
}

function killPid(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

function killPort(port) {
  const pids = pidsOnPort(port);

  if (pids.length === 0) {
    console.log(`[ports] ${port}: no listener to kill`);
    return;
  }

  const uniquePids = [...new Set(pids)];

  for (const pid of uniquePids) {
    const terminated = killPid(pid, 'SIGTERM');
    if (terminated) {
      console.log(`[ports] ${port}: sent SIGTERM to PID ${pid}`);
    }
  }

  setTimeout(() => {
    const remaining = pidsOnPort(port);
    for (const pid of remaining) {
      const killed = killPid(pid, 'SIGKILL');
      if (killed) {
        console.log(`[ports] ${port}: sent SIGKILL to PID ${pid}`);
      }
    }
  }, 400);
}

function main() {
  const ports = parsePorts(process.argv.slice(2));
  for (const port of ports) {
    killPort(port);
  }
}

main();