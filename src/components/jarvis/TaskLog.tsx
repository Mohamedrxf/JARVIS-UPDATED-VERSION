import { Activity } from "lucide-react";

interface Props {
  logs: string[];
}

export default function TaskLog({ logs }: Props) {
  return (
    <div className="glass-panel flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-jarvis-blue" />
        <h3 className="font-display text-xs uppercase tracking-widest text-jarvis-blue">
          Activity Log
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
        {logs.length === 0 && (
          <p className="text-muted-foreground text-xs text-center py-6">
            No activity yet
          </p>
        )}
        {logs.map((log, i) => (
          <div key={i} className="text-[11px] font-mono text-muted-foreground py-0.5 animate-fade-in">
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}
