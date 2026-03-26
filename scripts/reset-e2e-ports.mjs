import { execSync } from "node:child_process";

const PORTS = [3100, 3101];

for (const port of PORTS) {
  try {
    const output = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();

    if (!output) continue;

    for (const pid of output.split("\n")) {
      if (!pid) continue;
      execSync(`kill ${pid}`, {
        stdio: ["ignore", "ignore", "ignore"],
      });
    }
  } catch {
    // Nothing is listening on this port, which is exactly what we want.
  }
}
