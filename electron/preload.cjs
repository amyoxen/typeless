const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("voicecraft", {
  transcribe: (payload) => ipcRenderer.invoke("voicecraft:transcribe", payload),
  polish: (payload) => ipcRenderer.invoke("voicecraft:polish", payload),
  copy: (text) => ipcRenderer.invoke("voicecraft:copy", text),
  getShortcut: () => ipcRenderer.invoke("voicecraft:get-shortcut"),
  finishDictationSession: () => ipcRenderer.invoke("voicecraft:finish-dictation-session"),
  pasteIntoActiveApp: (text) => ipcRenderer.invoke("voicecraft:paste-into-active-app", text),
  onToggleRecording: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("voicecraft:toggle-recording", listener);
    return () => ipcRenderer.removeListener("voicecraft:toggle-recording", listener);
  }
});
