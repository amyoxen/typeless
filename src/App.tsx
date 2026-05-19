import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clipboard,
  Eraser,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  Wand2
} from "lucide-react";

type Tone = "natural" | "professional" | "short" | "friendly" | "email" | "notes";
type Status = "idle" | "recording" | "transcribing" | "polishing" | "ready" | "error";

const toneOptions: Array<{ value: Tone; label: string }> = [
  { value: "natural", label: "Natural" },
  { value: "professional", label: "Professional" },
  { value: "short", label: "Short" },
  { value: "friendly", label: "Friendly" },
  { value: "email", label: "Email" },
  { value: "notes", label: "Notes" }
];

function getSupportedMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/wav"
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export function App() {
  const [status, setStatus] = useState<Status>("idle");
  const [rawText, setRawText] = useState("");
  const [polishedText, setPolishedText] = useState("");
  const [tone, setTone] = useState<Tone>("natural");
  const [vocabulary, setVocabulary] = useState("");
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [autoPaste, setAutoPaste] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const api = window.voicecraft;

  const canUseApp = Boolean(api);
  const isBusy = status === "transcribing" || status === "polishing";
  const isRecording = status === "recording";

  const statusLabel = useMemo(() => {
    if (status === "recording") return `Recording ${elapsedSeconds}s`;
    if (status === "transcribing") return "Transcribing voice";
    if (status === "polishing") return "Polishing text";
    if (status === "ready") return "Ready";
    if (status === "error") return "Needs attention";
    return "Idle";
  }, [elapsedSeconds, status]);

  const reset = useCallback(() => {
    setRawText("");
    setPolishedText("");
    setError("");
    setStatus("idle");
    setElapsedSeconds(0);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const processAudio = useCallback(async (blob: Blob) => {
    if (!api) return;

    try {
      setStatus("transcribing");
      const audio = await blob.arrayBuffer();
      const transcript = await api.transcribe({
        audio,
        mimeType: blob.type || "audio/webm",
        fileName: "dictation.webm"
      });

      const transcriptText = transcript.text.trim();
      setRawText(transcriptText);

      if (!transcriptText) {
        setPolishedText("");
        setStatus("ready");
        return;
      }

      setStatus("polishing");
      const polished = await api.polish({
        transcript: transcriptText,
        tone,
        vocabulary
      });

      setPolishedText(polished.text);
      setStatus("ready");

      if (autoPaste && polished.text.trim()) {
        await api.pasteIntoActiveApp(polished.text);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setStatus("error");
    } finally {
      stopStream();
    }
  }, [api, stopStream, tone, vocabulary]);

  const startRecording = useCallback(async () => {
    if (!canUseApp || isBusy || isRecording) return;

    try {
      setError("");
      setRawText("");
      setPolishedText("");
      setElapsedSeconds(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });

      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void processAudio(blob);
      });

      startedAtRef.current = Date.now();
      recorder.start();
      setStatus("recording");
    } catch (caught) {
      stopStream();
      setError(caught instanceof Error ? caught.message : "Microphone permission was not granted.");
      setStatus("error");
    }
  }, [canUseApp, isBusy, isRecording, processAudio, stopStream]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    setStatus("transcribing");
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const polishAgain = useCallback(async () => {
    if (!api || !rawText.trim()) return;
    try {
      setError("");
      setStatus("polishing");
      const polished = await api.polish({
        transcript: rawText,
        tone,
        vocabulary
      });
      setPolishedText(polished.text);
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not polish the text.");
      setStatus("error");
    }
  }, [api, rawText, tone, vocabulary]);

  const copyPolished = useCallback(async () => {
    if (!api || !polishedText.trim()) return;
    await api.copy(polishedText);
  }, [api, polishedText]);

  useEffect(() => {
    if (!api) return;
    return api.onToggleRecording(toggleRecording);
  }, [api, toggleRecording]);

  useEffect(() => {
    if (!isRecording) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 250);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Application header">
        <div>
          <p className="eyebrow">AI voice dictation</p>
          <h1>VoiceCraft</h1>
        </div>
        <div className={`status-pill status-${status}`}>
          {isBusy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
          <span>{statusLabel}</span>
        </div>
      </section>

      <section className="workspace">
        <aside className="controls" aria-label="Dictation controls">
          <button
            className={`record-button ${isRecording ? "recording" : ""}`}
            onClick={toggleRecording}
            disabled={!canUseApp || isBusy}
            title={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? <MicOff size={34} /> : <Mic size={34} />}
          </button>

          <div className="shortcut">Ctrl + Shift + Space</div>

          <label className="toggle-row" htmlFor="autoPaste">
            <input
              id="autoPaste"
              checked={autoPaste}
              onChange={(event) => setAutoPaste(event.target.checked)}
              type="checkbox"
            />
            <span>Paste into active field</span>
          </label>

          <div className="field-group">
            <label htmlFor="tone">Tone</label>
            <div className="segmented" id="tone">
              {toneOptions.map((option) => (
                <button
                  key={option.value}
                  className={tone === option.value ? "active" : ""}
                  onClick={() => setTone(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="vocabulary">Vocabulary</label>
            <textarea
              id="vocabulary"
              value={vocabulary}
              onChange={(event) => setVocabulary(event.target.value)}
              placeholder="Names, product terms, acronyms, preferred spellings"
            />
          </div>

          <div className="action-row">
            <button onClick={polishAgain} disabled={!rawText.trim() || isBusy} title="Polish again">
              <Wand2 size={18} />
              Polish
            </button>
            <button onClick={reset} disabled={isBusy && !isRecording} title="Clear">
              <Eraser size={18} />
              Clear
            </button>
          </div>
        </aside>

        <section className="panels" aria-label="Transcription results">
          {error ? <div className="error-banner">{error}</div> : null}
          {!canUseApp ? (
            <div className="error-banner">This app needs to run inside Electron for AI and clipboard access.</div>
          ) : null}

          <article className="text-panel">
            <div className="panel-header">
              <h2>Polished text</h2>
              <div className="panel-actions">
                <button onClick={copyPolished} disabled={!polishedText.trim()} title="Copy polished text">
                  <Clipboard size={18} />
                  Copy
                </button>
                <button onClick={() => setPolishedText(rawText)} disabled={!rawText.trim()} title="Use raw text">
                  <RotateCcw size={18} />
                  Raw
                </button>
              </div>
            </div>
            <textarea
              className="output polished"
              value={polishedText}
              onChange={(event) => setPolishedText(event.target.value)}
              placeholder="Your cleaned-up dictation will appear here."
            />
          </article>

          <article className="text-panel raw-panel">
            <div className="panel-header">
              <h2>Raw transcript</h2>
            </div>
            <textarea
              className="output"
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="The direct speech-to-text transcript appears here."
            />
          </article>
        </section>
      </section>
    </main>
  );
}
