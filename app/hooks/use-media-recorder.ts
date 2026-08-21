"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useMediaRecorder(onRecording: (blob: Blob) => void) {
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder?.state === "recording") recorder.stop();
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    chunksRef.current = [];
    if (mountedRef.current) setRecording(false);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else cleanup();
    setRecording(false);
  }, [cleanup]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(type));
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || preferred || "audio/webm" });
        stopMediaStream(streamRef.current);
        streamRef.current = null;
        recorderRef.current = null;
        chunksRef.current = [];
        if (mountedRef.current) {
          setRecording(false);
          if (blob.size) onRecording(blob);
        }
      };
      recorder.onerror = () => {
        setMessage("Recording stopped because the microphone became unavailable.");
        cleanup();
      };
      recorder.start();
      setRecording(true);
      setMessage("");
    } catch {
      cleanup();
      setMessage("Microphone access was unavailable. Check your browser permission and try again.");
    }
  }, [cleanup, onRecording]);

  const toggle = useCallback(() => recording ? stop() : void start(), [recording, start, stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return { recording, message, start, stop, toggle, cleanup };
}
