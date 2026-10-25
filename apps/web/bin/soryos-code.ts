#!/usr/bin/env node
/**
 * SoryOS-Code CLI Adapter
 * Routes to the official @soryos/cli package (same engine as the web app).
 */

import { runCLI } from "@soryos/cli";

if (require.main === module) {
  runCLI()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { runCLI };
