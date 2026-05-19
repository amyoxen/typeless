/// <reference types="vite/client" />

type VoicecraftApi = {
  transcribe: (payload: {
    audio: ArrayBuffer;
    mimeType: string;
    fileName: string;
  }) => Promise<{ text: string }>;
  polish: (payload: {
    transcript: string;
    tone: string;
    vocabulary: string;
  }) => Promise<{ text: string }>;
  copy: (text: string) => Promise<{ ok: boolean }>;
  getShortcut: () => Promise<{ shortcut: string; registered: boolean }>;
  pasteIntoActiveApp: (text: string) => Promise<{ ok: boolean }>;
  onToggleRecording: (callback: () => void) => () => void;
};

interface Window {
  voicecraft?: VoicecraftApi;
}
