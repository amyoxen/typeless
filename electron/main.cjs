const { app, BrowserWindow, clipboard, globalShortcut, ipcMain } = require("electron");
const { execFile } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const devUrl = process.env.VOICECRAFT_DEV_SERVER_URL;
const isDev = Boolean(devUrl);
let mainWindow;
let isQuitting = false;
let registeredShortcut = "";

const shortcutCandidates = [
  process.env.VOICECRAFT_HOTKEY,
  "CommandOrControl+Shift+Space",
  "CommandOrControl+Alt+Space"
].filter(Boolean);

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 680,
    minWidth: 480,
    minHeight: 560,
    backgroundColor: "#f7f2ea",
    title: "VoiceCraft Dictation",
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
  });

  return win;
}

function showDictationWindow() {
  if (!mainWindow) return;
  if (mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function sendToggleRecording() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow();
  }

  showDictationWindow();

  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow?.webContents.send("voicecraft:toggle-recording");
    });
    return;
  }

  mainWindow.webContents.send("voicecraft:toggle-recording");
}

function registerDictationShortcut() {
  for (const shortcut of shortcutCandidates) {
    const registered = globalShortcut.register(shortcut, sendToggleRecording);
    if (registered) {
      registeredShortcut = shortcut;
      return;
    }
  }

  registeredShortcut = "";
}

function assertOpenAiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. Add it to a .env file in the project root.");
  }
}

ipcMain.handle("voicecraft:transcribe", async (_event, payload) => {
  assertOpenAiKey();

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
  const audioBuffer = Buffer.from(payload.audio);
  const file = new File([audioBuffer], payload.fileName || "dictation.webm", {
    type: payload.mimeType || "audio/webm"
  });

  const form = new FormData();
  form.append("model", model);
  form.append("file", file);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: form
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcription failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return { text: data.text || "" };
});

ipcMain.handle("voicecraft:polish", async (_event, payload) => {
  assertOpenAiKey();

  const model = process.env.OPENAI_POLISH_MODEL || "gpt-4o-mini";
  const tone = payload.tone || "natural";
  const vocabulary = payload.vocabulary?.trim();

  const prompt = [
    "Rewrite this spoken dictation into clean typed text.",
    "",
    "Rules:",
    "- Remove filler words and false starts.",
    "- Remove unnecessary repetition.",
    "- Preserve the user's meaning and facts.",
    "- Keep names, numbers, punctuation, and formatting natural.",
    "- Do not add information that was not spoken.",
    "- Return only the rewritten text.",
    "",
    `Desired style: ${tone}.`,
    vocabulary ? `Custom vocabulary and preferred spellings: ${vocabulary}.` : "",
    "",
    `Transcript:\n${payload.transcript}`
  ].filter(Boolean).join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: prompt
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Polishing failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("") || "";

  return { text: text.trim() };
});

ipcMain.handle("voicecraft:copy", (_event, text) => {
  clipboard.writeText(text || "");
  return { ok: true };
});

ipcMain.handle("voicecraft:get-shortcut", () => {
  return {
    shortcut: registeredShortcut,
    registered: Boolean(registeredShortcut)
  };
});

ipcMain.handle("voicecraft:paste-into-active-app", async (_event, text) => {
  clipboard.writeText(text || "");
  mainWindow?.hide();

  await new Promise((resolve, reject) => {
    const command = [
      "$ws = New-Object -ComObject WScript.Shell",
      "Start-Sleep -Milliseconds 180",
      "$ws.SendKeys('^v')"
    ].join("; ");

    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });

  return { ok: true };
});

app.whenReady().then(() => {
  loadEnvFile();
  mainWindow = createWindow();
  registerDictationShortcut();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      showDictationWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
});

app.on("will-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});
