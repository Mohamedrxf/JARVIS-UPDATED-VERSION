import { useEffect, useRef } from "react";
import type { Message } from "@/hooks/useJarvis";
import { Mic, Bot } from "lucide-react";

interface Props {
  messages: Message[];
  interimTranscript: string;
}

export default function TranscriptPanel({ messages, interimTranscript }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimTranscript]);

  return (
    <div className="glass-panel flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border/50">
        <h3 className="font-display text-xs uppercase tracking-widest text-primary">
          Conversation
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        {messages.length === 0 && !interimTranscript && (
          <p className="text-muted-foreground text-sm text-center py-8">
            Press the mic button or say "Hey Jarvis" to begin...
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 animate-fade-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3 h-3 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                msg.role === "user"
                  ? "bg-primary/15 text-foreground border border-primary/20"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-jarvis-purple/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Mic className="w-3 h-3 text-jarvis-purple" />
              </div>
            )}
          </div>
        ))}
        {interimTranscript && (
          <div className="flex gap-2 justify-end animate-fade-in">
            <div className="max-w-[80%] px-3 py-2 rounded-lg text-sm bg-primary/10 text-muted-foreground border border-primary/10 italic">
              {interimTranscript}...
            </div>
            <div className="w-6 h-6 rounded-full bg-jarvis-purple/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Mic className="w-3 h-3 text-jarvis-purple animate-pulse" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
