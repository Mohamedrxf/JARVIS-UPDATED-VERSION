import { useState, useCallback, useRef, useEffect } from "react";

export type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface UseVoiceOptions {
  onTranscript: (text: string) => void;
  wakeWord?: string;
  wakeWordEnabled?: boolean;
}

export function useVoice({ onTranscript, wakeWord = "hey jarvis", wakeWordEnabled = false }: UseVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isSupported, setIsSupported] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wakeRecognitionRef = useRef<SpeechRecognition | null>(null);
  const speakingRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 0.9;
      utterance.volume = 1.0;
      
      // Try to pick a good voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) 
        || voices.find(v => v.lang.startsWith("en") && v.name.includes("Male"))
        || voices.find(v => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;
      
      speakingRef.current = true;
      setVoiceState("speaking");
      utterance.onend = () => { speakingRef.current = false; setVoiceState("idle"); resolve(); };
      utterance.onerror = () => { speakingRef.current = false; setVoiceState("idle"); resolve(); };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    setVoiceState("idle");
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => setVoiceState("listening");
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimTranscript(interim);
      if (final) {
        setInterimTranscript("");
        setVoiceState("processing");
        onTranscript(final.trim());
      }
    };
    
    recognition.onerror = () => setVoiceState("idle");
    recognition.onend = () => {
      if (voiceState === "listening") setVoiceState("idle");
    };

    recognition.start();
  }, [onTranscript, voiceState]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setVoiceState("idle");
    setInterimTranscript("");
  }, []);

  // Wake word listener
  const startWakeWordListener = useCallback(() => {
    if (!wakeWordEnabled) return;
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    wakeRecognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase();
        if (transcript.includes(wakeWord)) {
          try { recognition.stop(); } catch {}
          speak("Yes, how can I help you?").then(() => startListening());
          return;
        }
      }
    };
    
    recognition.onend = () => {
      // Restart wake word listener
      if (wakeWordEnabled && !speakingRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 500);
      }
    };
    
    recognition.onerror = () => {
      setTimeout(() => {
        try { recognition.start(); } catch {}
      }, 1000);
    };

    try { recognition.start(); } catch {}
  }, [wakeWordEnabled, wakeWord, speak, startListening]);

  const stopWakeWordListener = useCallback(() => {
    if (wakeRecognitionRef.current) {
      try { wakeRecognitionRef.current.stop(); } catch {}
      wakeRecognitionRef.current = null;
    }
  }, []);

  return {
    voiceState,
    setVoiceState,
    isSupported,
    interimTranscript,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    startWakeWordListener,
    stopWakeWordListener,
  };
}
