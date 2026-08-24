"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function useDictation(onTranscript: (text: string) => void, maximumMs = 60_000) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setMessage("Dictation stopped.");
  }, [clearTimer]);

  const start = useCallback(() => {
    const speechWindow = window as SpeechWindow;
    const Speech = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Speech) {
      setMessage("Voice-to-text is not supported in this browser. You can still record a voice memo.");
      return;
    }
    const recognition = new Speech();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-CA";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) transcript += `${event.results[index][0].transcript} `;
      onTranscript(transcript.trim());
    };
    recognition.onend = () => {
      clearTimer();
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onerror = () => {
      clearTimer();
      recognitionRef.current = null;
      setListening(false);
      setMessage("Dictation stopped. Try again or use a voice memo.");
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setMessage("Listening… tap again when you’re finished.");
    timeoutRef.current = window.setTimeout(() => recognitionRef.current?.stop(), maximumMs);
  }, [clearTimer, maximumMs, onTranscript]);

  const toggle = useCallback(() => listening ? stop() : start(), [listening, start, stop]);

  useEffect(() => () => {
    clearTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, [clearTimer]);

  return { listening, message, start, stop, toggle };
}
