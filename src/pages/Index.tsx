import { useCallback, useState } from "react";
import JarvisOrb from "@/components/jarvis/JarvisOrb";
import type { OrbState } from "@/components/jarvis/JarvisOrb";
import TranscriptPanel from "@/components/jarvis/TranscriptPanel";
import MemoryPanel from "@/components/jarvis/MemoryPanel";
import TaskLog from "@/components/jarvis/TaskLog";
import MicButton from "@/components/jarvis/MicButton";
import StatusBar from "@/components/jarvis/StatusBar";
import { useVoice } from "@/hooks/useVoice";
import { useJarvis } from "@/hooks/useJarvis";
import { Settings, Keyboard, Volume2, VolumeX } from "lucide-react";

const Index = () => {
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [textInput, setTextInput] = useState("");

  const {
    messages,
    orbState,
    setOrbState,
    isProcessing,
    memories,
    taskLog,
    sendMessage,
    pinMemory,
    deleteMemory,
  } = useJarvis();

  const handleTranscript = useCallback(async (text: string) => {
    const response = await sendMessage(text);
    if (ttsEnabled && response) {
      await speak(response);
    }
    setOrbState("idle");
  }, [sendMessage, ttsEnabled]);

  const {
    voiceState,
    isSupported,
    interimTranscript,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoice({
    onTranscript: handleTranscript,
    wakeWordEnabled,
  });

  // Sync voice state to orb
  const displayOrbState: OrbState = 
    voiceState === "listening" ? "listening" : 
    voiceState === "speaking" ? "speaking" : 
    orbState;

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    const text = textInput.trim();
    setTextInput("");
    const response = await sendMessage(text);
    if (ttsEnabled && response) {
      await speak(response);
    }
    setOrbState("idle");
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border/50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <h1 className="font-display text-lg tracking-[0.3em] text-primary text-glow">
            J.A.R.V.I.S
          </h1>
          <span className="text-[10px] text-muted-foreground font-display tracking-widest ml-2">
            v2.0 — PERSONAL AI ASSISTANT
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className="p-2 rounded-md hover:bg-secondary transition-colors"
            title={ttsEnabled ? "Mute voice" : "Enable voice"}
          >
            {ttsEnabled ? (
              <Volume2 className="w-4 h-4 text-primary" />
            ) : (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
            className={`px-3 py-1.5 rounded-md text-[10px] font-display tracking-widest transition-all ${
              wakeWordEnabled 
                ? "bg-primary/20 text-primary border border-primary/30" 
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {wakeWordEnabled ? "WAKE WORD ON" : "WAKE WORD OFF"}
          </button>
          <button className="p-2 rounded-md hover:bg-secondary transition-colors">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Orb and Controls */}
        <div className="flex-shrink-0 w-[400px] flex flex-col items-center border-r border-border/50 p-6">
          {/* Orb */}
          <div className="flex-1 w-full max-h-[400px]">
            <JarvisOrb state={displayOrbState} />
          </div>
          
          {/* State Label */}
          <div className="mb-6 text-center">
            <p className="font-display text-[10px] tracking-[0.4em] text-muted-foreground uppercase">
              {displayOrbState === "idle" ? "Awaiting Command" :
               displayOrbState === "listening" ? "Listening..." :
               displayOrbState === "thinking" ? "Processing..." :
               displayOrbState === "speaking" ? "Responding..." :
               "Error Detected"}
            </p>
          </div>

          {/* Mic Button */}
          <MicButton
            voiceState={voiceState}
            onStart={startListening}
            onStop={stopListening}
            onStopSpeaking={stopSpeaking}
            isSupported={isSupported}
          />

          {/* Text Input */}
          <form onSubmit={handleTextSubmit} className="w-full mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a command..."
                className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                disabled={isProcessing}
              />
              <button
                type="submit"
                disabled={isProcessing || !textInput.trim()}
                className="p-2 rounded-md bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Keyboard className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Right Panel - Conversation & Tools */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top: Conversation */}
          <div className="flex-1 p-4 overflow-hidden">
            <TranscriptPanel messages={messages} interimTranscript={interimTranscript} />
          </div>

          {/* Bottom: Memory + Logs */}
          <div className="flex-shrink-0 h-[250px] flex gap-4 px-4 pb-4">
            <div className="flex-1">
              <MemoryPanel memories={memories} onPin={pinMemory} onDelete={deleteMemory} />
            </div>
            <div className="flex-1">
              <TaskLog logs={taskLog} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="flex-shrink-0 px-4 pb-3">
        <StatusBar orbState={displayOrbState} messageCount={messages.length} />
      </div>
    </div>
  );
};

export default Index;
