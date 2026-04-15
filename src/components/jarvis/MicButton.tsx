import { Mic, MicOff, Square } from "lucide-react";
import type { VoiceState } from "@/hooks/useVoice";

interface Props {
  voiceState: VoiceState;
  onStart: () => void;
  onStop: () => void;
  onStopSpeaking: () => void;
  isSupported: boolean;
}

export default function MicButton({ voiceState, onStart, onStop, onStopSpeaking, isSupported }: Props) {
  if (!isSupported) {
    return (
      <div className="text-center text-muted-foreground text-xs">
        <MicOff className="w-5 h-5 mx-auto mb-1" />
        Speech not supported
      </div>
    );
  }

  const isListening = voiceState === "listening";
  const isSpeaking = voiceState === "speaking";
  const isProcessing = voiceState === "processing";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => {
          if (isSpeaking) onStopSpeaking();
          else if (isListening) onStop();
          else onStart();
        }}
        disabled={isProcessing}
        className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
          isListening
            ? "bg-primary/20 border-2 border-primary shadow-[0_0_25px_hsl(var(--jarvis-cyan)/0.4)]"
            : isSpeaking
            ? "bg-jarvis-purple/20 border-2 border-jarvis-purple shadow-[0_0_25px_hsl(var(--jarvis-purple)/0.3)]"
            : isProcessing
            ? "bg-muted border-2 border-muted-foreground/30 cursor-wait"
            : "bg-secondary border-2 border-border hover:border-primary/50 hover:bg-primary/10 hover:shadow-[0_0_15px_hsl(var(--jarvis-cyan)/0.2)]"
        }`}
      >
        {/* Ripple when listening */}
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-full border border-primary animate-ripple" />
            <span className="absolute inset-0 rounded-full border border-primary animate-ripple" style={{ animationDelay: "0.5s" }} />
          </>
        )}
        {isSpeaking ? (
          <Square className="w-5 h-5 text-jarvis-purple" />
        ) : (
          <Mic className={`w-6 h-6 ${isListening ? "text-primary" : isProcessing ? "text-muted-foreground" : "text-foreground"}`} />
        )}
      </button>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-display">
        {isListening ? "Listening..." : isSpeaking ? "Speaking..." : isProcessing ? "Thinking..." : "Push to Talk"}
      </span>
    </div>
  );
}
