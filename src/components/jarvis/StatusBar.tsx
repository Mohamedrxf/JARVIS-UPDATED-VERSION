import type { OrbState } from "./JarvisOrb";
import { Wifi, Cpu, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  orbState: OrbState;
  messageCount: number;
}

export default function StatusBar({ orbState, messageCount }: Props) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const stateLabel: Record<OrbState, string> = {
    idle: "STANDBY",
    listening: "LISTENING",
    thinking: "PROCESSING",
    speaking: "RESPONDING",
    error: "ERROR",
  };

  const stateColor: Record<OrbState, string> = {
    idle: "text-muted-foreground",
    listening: "text-primary",
    thinking: "text-jarvis-purple",
    speaking: "text-primary",
    error: "text-destructive",
  };

  return (
    <div className="glass-panel px-4 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest font-display">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${orbState === "idle" ? "bg-muted-foreground" : orbState === "error" ? "bg-destructive animate-pulse" : "bg-primary animate-pulse"}`} />
          <span className={stateColor[orbState]}>{stateLabel[orbState]}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Wifi className="w-3 h-3" />
          <span>Online</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-muted-foreground">
        <div className="flex items-center gap-1">
          <Cpu className="w-3 h-3" />
          <span>{messageCount} msgs</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{time.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
