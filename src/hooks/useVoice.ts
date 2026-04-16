import { useState, useCallback, useRef, useEffect } from "react";

export type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface UseVoiceOptions {
  onTranscript: (text: string) => Promise<void> | void;
  wakeWord?: string;
  wakeWordEnabled?: boolean;
}

type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type ListenerMode = "none" | "wake" | "command";

function getSpeechRecognition(): (new () => RecognitionLike) | null {
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function useVoice({
  onTranscript,
  wakeWord = "hey jarvis",
  wakeWordEnabled = false,
}: UseVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isSupported, setIsSupported] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isWakeListening, setIsWakeListening] = useState(false);
  const [isCommandListening, setIsCommandListening] = useState(false);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [lastHeardWakeWord, setLastHeardWakeWord] = useState<string | null>(null);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const wakeRecognitionRef = useRef<RecognitionLike | null>(null);
  const speakingRef = useRef(false);
  const modeRef = useRef<ListenerMode>("none");
  const commandSessionIdRef = useRef(0);
  const wakeSessionIdRef = useRef(0);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    if (!getSpeechRecognition()) {
      setIsSupported(false);
    }
  }, []);

  const stopRecognitionInstance = useCallback((instance: RecognitionLike | null) => {
    if (!instance) return;

    try {
      instance.stop();
    } catch {
      try {
        instance.abort?.();
      } catch {
        // no-op
      }
    }
  }, []);

  const stopWakeWordListener = useCallback(() => {
    modeRef.current = modeRef.current === "wake" ? "none" : modeRef.current;
    setIsWakeListening(false);

    if (wakeRecognitionRef.current) {
      stopRecognitionInstance(wakeRecognitionRef.current);
      wakeRecognitionRef.current = null;
    }
  }, [stopRecognitionInstance]);

  const stopListening = useCallback(() => {
    modeRef.current = modeRef.current === "command" ? "none" : modeRef.current;
    setIsCommandListening(false);
    setInterimTranscript("");
    setWakeWordDetected(false);
    setLastHeardWakeWord(null);

    if (recognitionRef.current) {
      stopRecognitionInstance(recognitionRef.current);
      recognitionRef.current = null;
    }

    if (!speakingRef.current) {
      setVoiceState("idle");
    }
  }, [stopRecognitionInstance]);

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
    if (modeRef.current === "none") {
      setVoiceState("idle");
    }
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 0.95;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en")) ||
        voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("male")) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        null;

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      speakingRef.current = true;
      setVoiceState("speaking");

      utterance.onend = () => {
        speakingRef.current = false;
        if (modeRef.current === "command") {
          setVoiceState("listening");
        } else {
          setVoiceState("idle");
        }
        resolve();
      };

      utterance.onerror = () => {
        speakingRef.current = false;
        setVoiceState("idle");
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const startWakeWordListener = useCallback(() => {
    if (!wakeWordEnabled) return;

    const SR = getSpeechRecognition();
    if (!SR) {
      setIsSupported(false);
      return;
    }

    stopListening();
    stopWakeWordListener();

    modeRef.current = "wake";
    const currentWakeSession = ++wakeSessionIdRef.current;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    wakeRecognitionRef.current = recognition;

    recognition.onstart = () => {
      if (modeRef.current !== "wake" || currentWakeSession !== wakeSessionIdRef.current) return;
      console.log("Wake word listener active");
      setIsWakeListening(true);
      if (!speakingRef.current) {
        setVoiceState("idle");
      }
    };

    recognition.onresult = (event: any) => {
      if (modeRef.current !== "wake" || currentWakeSession !== wakeSessionIdRef.current) return;

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript ?? "";
        const normalizedTranscript = normalizeText(transcript);
        const normalizedWakeWord = normalizeText(wakeWord);

        console.log("Wake transcript:", transcript);

        const matchedWakeWord =
          normalizedTranscript.includes(normalizedWakeWord) ||
          normalizedTranscript.includes("jarvis") ||
          normalizedTranscript.includes("hi jarvis");

        if (matchedWakeWord) {
          console.log("Wake word detected:", transcript);
          setWakeWordDetected(true);
          setLastHeardWakeWord(transcript.trim());

          stopWakeWordListener();

          speak("Yes, how can I help you?").then(() => {
            startListening();
          });

          return;
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (modeRef.current !== "wake" || currentWakeSession !== wakeSessionIdRef.current) return;

      console.log("Wake listener error:", event?.error);
      setIsWakeListening(false);

      if (speakingRef.current || !wakeWordEnabled) return;

      setTimeout(() => {
        if (
          modeRef.current === "wake" &&
          currentWakeSession === wakeSessionIdRef.current &&
          !speakingRef.current &&
          wakeWordEnabled
        ) {
          try {
            recognition.start();
          } catch {
            // no-op
          }
        }
      }, 1200);
    };

    recognition.onend = () => {
      if (modeRef.current !== "wake" || currentWakeSession !== wakeSessionIdRef.current) return;

      setIsWakeListening(false);

      if (speakingRef.current || !wakeWordEnabled) return;

      setTimeout(() => {
        if (
          modeRef.current === "wake" &&
          currentWakeSession === wakeSessionIdRef.current &&
          !speakingRef.current &&
          wakeWordEnabled
        ) {
          try {
            recognition.start();
          } catch {
            // no-op
          }
        }
      }, 700);
    };

    try {
      console.log("Starting wake word listener...");
      recognition.start();
    } catch {
      setIsWakeListening(false);
      modeRef.current = "none";
    }
  }, [wakeWordEnabled, wakeWord, speak, stopListening, stopWakeWordListener]);

  const startListening = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setIsSupported(false);
      return;
    }

    stopWakeWordListener();

    if (recognitionRef.current) {
      stopRecognitionInstance(recognitionRef.current);
      recognitionRef.current = null;
    }

    modeRef.current = "command";
    const currentCommandSession = ++commandSessionIdRef.current;

    setIsCommandListening(false);
    setInterimTranscript("");
    setWakeWordDetected(false);
    setLastHeardWakeWord(null);

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      if (modeRef.current !== "command" || currentCommandSession !== commandSessionIdRef.current) return;
      setIsCommandListening(true);
      setVoiceState("listening");
    };

    recognition.onresult = async (event: any) => {
      if (modeRef.current !== "command" || currentCommandSession !== commandSessionIdRef.current) return;

      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";

        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim);

      if (final.trim()) {
        const finalText = final.trim();

        setInterimTranscript("");
        setVoiceState("processing");
        setIsCommandListening(false);

        try {
          await onTranscriptRef.current(finalText);
        } catch (error) {
          console.error("Transcript processing error:", error);
        } finally {
          modeRef.current = "none";
          recognitionRef.current = null;

          if (wakeWordEnabled) {
            setTimeout(() => {
              startWakeWordListener();
            }, 500);
          } else {
            setVoiceState("idle");
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (modeRef.current !== "command" || currentCommandSession !== commandSessionIdRef.current) return;

      console.log("Command listener error:", event?.error);
      setIsCommandListening(false);
      setInterimTranscript("");
      modeRef.current = "none";

      if (wakeWordEnabled) {
        setTimeout(() => {
          startWakeWordListener();
        }, 700);
      } else {
        setVoiceState("idle");
      }
    };

    recognition.onend = () => {
      if (modeRef.current !== "command" || currentCommandSession !== commandSessionIdRef.current) return;

      setIsCommandListening(false);
      setInterimTranscript("");
    };

    try {
      recognition.start();
    } catch {
      setIsCommandListening(false);
      modeRef.current = "none";
      setVoiceState("idle");
    }
  }, [stopRecognitionInstance, stopWakeWordListener, wakeWordEnabled, startWakeWordListener]);

  const stopAllVoice = useCallback(() => {
    modeRef.current = "none";
    stopSpeaking();
    stopListening();
    stopWakeWordListener();
    setWakeWordDetected(false);
    setLastHeardWakeWord(null);
    setInterimTranscript("");
    setVoiceState("idle");
  }, [stopListening, stopSpeaking, stopWakeWordListener]);

  useEffect(() => {
    if (!isSupported) return;

    if (wakeWordEnabled) {
      startWakeWordListener();
    } else {
      stopWakeWordListener();
    }

    return () => {
      stopWakeWordListener();
    };
  }, [wakeWordEnabled, isSupported, startWakeWordListener, stopWakeWordListener]);

  useEffect(() => {
    return () => {
      stopAllVoice();
    };
  }, [stopAllVoice]);

  return {
    voiceState,
    setVoiceState,
    isSupported,
    interimTranscript,
    isWakeListening,
    isCommandListening,
    wakeWordDetected,
    lastHeardWakeWord,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    startWakeWordListener,
    stopWakeWordListener,
    stopAllVoice,
  };
}