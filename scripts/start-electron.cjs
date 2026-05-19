const { spawn } = require("node:child_process");
const electronPath = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const devServerUrl = process.argv[2];
if (devServerUrl) {
  env.VOICECRAFT_DEV_SERVER_URL = devServerUrl;
}

const child = spawn(electronPath, ["."], {
  env,
  stdio: "inherit",
  windowsHide: false
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
