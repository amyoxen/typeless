import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, MicOff } from "lucide-react";

type Status = "idle" | "recording" | "transcribing" | "polishing" | "ready" | "error";

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
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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
    return "Start recording";
  }, [elapsedSeconds, status]);

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
      if (!transcriptText) {
        setStatus("ready");
        await api.finishDictationSession();
        return;
      }

      setStatus("polishing");
      const polished = await api.polish({
        transcript: transcriptText,
        tone: "natural",
        vocabulary: ""
      });

      setStatus("ready");
      if (polished.text.trim()) {
        await api.pasteIntoActiveApp(polished.text);
      } else {
        await api.finishDictationSession();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setStatus("error");
      await api.finishDictationSession();
    } finally {
      stopStream();
    }
  }, [api, stopStream]);

  const startRecording = useCallback(async () => {
    if (!canUseApp || isBusy || isRecording) return;

    try {
      setError("");
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
      <section className="simple-panel" aria-label={statusLabel}>
        <button
          className={`record-button ${isRecording ? "recording" : ""}`}
          onClick={toggleRecording}
          disabled={!canUseApp || isBusy}
          title={isRecording ? "Stop recording" : statusLabel}
          aria-label={isRecording ? "Stop recording" : statusLabel}
        >
          {isBusy ? <Loader2 size={34} className="spin" /> : isRecording ? <MicOff size={34} /> : <Mic size={34} />}
        </button>

        {error ? <div className="error-banner">{error}</div> : null}
        {!canUseApp ? (
          <div className="error-banner">This app needs to run inside Electron for AI and clipboard access.</div>
        ) : null}
      </section>
    </main>
  );
}
