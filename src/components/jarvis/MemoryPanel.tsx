import type { MemoryItem } from "@/hooks/useJarvis";
import { Pin, Trash2, Brain } from "lucide-react";

interface Props {
  memories: MemoryItem[];
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function MemoryPanel({ memories, onPin, onDelete }: Props) {
  const sorted = [...memories].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  return (
    <div className="glass-panel flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
        <Brain className="w-3.5 h-3.5 text-jarvis-purple" />
        <h3 className="font-display text-xs uppercase tracking-widest text-jarvis-purple">
          Memory
        </h3>
        <span className="ml-auto text-xs text-muted-foreground">{memories.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {sorted.length === 0 && (
          <p className="text-muted-foreground text-xs text-center py-6">
            Say "remember that..." to save memories
          </p>
        )}
        {sorted.map((mem) => (
          <div
            key={mem.id}
            className={`p-2.5 rounded-md text-xs animate-fade-in transition-colors ${
              mem.pinned ? "bg-jarvis-purple/10 border border-jarvis-purple/20" : "bg-secondary/50"
            }`}
          >
            <p className="text-foreground/90 leading-relaxed">{mem.content}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-muted-foreground text-[10px]">
                {mem.timestamp.toLocaleTimeString()}
              </span>
              <div className="flex gap-1">
                <button onClick={() => onPin(mem.id)} className="p-1 rounded hover:bg-muted transition-colors">
                  <Pin className={`w-3 h-3 ${mem.pinned ? "text-jarvis-purple" : "text-muted-foreground"}`} />
                </button>
                <button onClick={() => onDelete(mem.id)} className="p-1 rounded hover:bg-destructive/20 transition-colors">
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
