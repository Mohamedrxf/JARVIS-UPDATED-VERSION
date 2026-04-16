import { useState, useCallback, useEffect } from "react";
import type { OrbState } from "@/components/jarvis/JarvisOrb";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface MemoryItem {
  id: string;
  content: string;
  timestamp: Date;
  pinned: boolean;
}

const STORAGE_KEYS = {
  messages: "jarvis_messages",
  memories: "jarvis_memories",
  taskLog: "jarvis_task_log",
};

function deserializeMessages(raw: string | null): Message[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Omit<Message, "timestamp"> & { timestamp: string }>;
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function deserializeMemories(raw: string | null): MemoryItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Omit<MemoryItem, "timestamp"> & { timestamp: string }>;
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function deserializeTaskLog(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function summarizeMemories(memories: MemoryItem[]) {
  if (!memories.length) {
    return "I do not have any saved memories yet.";
  }

  const pinned = memories.filter((m) => m.pinned);
  const recent = [...memories]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);

  const parts: string[] = [];

  if (pinned.length) {
    parts.push(`Pinned memories: ${pinned.map((m) => m.content).join(" | ")}`);
  }

  parts.push(`Recent memories: ${recent.map((m) => m.content).join(" | ")}`);

  return parts.join(" ");
}

async function getAIResponse(messages: Message[], memories: MemoryItem[]): Promise<string> {
  const memoryContext = memories.length
    ? `Known user memory:\n${summarizeMemories(memories)}`
    : "Known user memory:\nNo saved memory yet.";

  const systemPrompt = `You are JARVIS, an advanced AI assistant inspired by Iron Man's JARVIS.
You are helpful, intelligent, concise, and slightly formal but friendly.
Address the user respectfully.
Keep responses brief and actionable, usually 1 to 3 sentences unless more detail is clearly needed.

You can help with:
- Conversational answers
- Study help
- Productivity assistance
- Code generation and technical help
- Task planning
- Notes and memory
- Lightweight research and summarization

${memoryContext}

Behavior rules:
- If the user asks you to remember something, acknowledge it warmly.
- If the user asks what you remember, summarize stored memory clearly.
- Suggest next steps when relevant.
- Do not pretend unavailable integrations are working.`;

  const chatMessages = messages.slice(-12).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  try {
    const { data, error } = await supabase.functions.invoke("jarvis-chat", {
      body: { messages: chatMessages, systemPrompt },
    });

    if (!error && data?.response) {
      return data.response as string;
    }
  } catch {
    // fallback below
  }

  const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || "";

  if (lastMsg.includes("what do you remember") || lastMsg.includes("what you remember")) {
    return summarizeMemories(memories);
  }

  if (lastMsg.includes("remember")) {
    return "Understood. I have stored that in memory for future reference.";
  }

  if (lastMsg.includes("calendar") || lastMsg.includes("schedule")) {
    return "Calendar integration is not connected yet, but I can still help you plan your schedule manually.";
  }

  if (lastMsg.includes("email")) {
    return "Email integration is not configured yet. I can still help draft or summarize email content.";
  }

  if (lastMsg.includes("note")) {
    return "Noted. I can keep that in memory and help you organize it further if needed.";
  }

  if (lastMsg.includes("hello") || lastMsg.includes("hi") || lastMsg.includes("hey")) {
    return "Hello. I am JARVIS, at your service. How may I assist you today?";
  }

  return "I understand your request. I can help with planning, memory, study support, and technical assistance from here.";
}

export function useJarvis() {
  const [messages, setMessages] = useState<Message[]>(() =>
    deserializeMessages(localStorage.getItem(STORAGE_KEYS.messages))
  );
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [memories, setMemories] = useState<MemoryItem[]>(() =>
    deserializeMemories(localStorage.getItem(STORAGE_KEYS.memories))
  );
  const [taskLog, setTaskLog] = useState<string[]>(() =>
    deserializeTaskLog(localStorage.getItem(STORAGE_KEYS.taskLog))
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.memories, JSON.stringify(memories));
  }, [memories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.taskLog, JSON.stringify(taskLog));
  }, [taskLog]);

  const addTaskLog = useCallback((entry: string) => {
    setTaskLog((prev) => [
      `[${new Date().toLocaleTimeString()}] ${entry}`,
      ...prev,
    ].slice(0, 50));
  }, []);

  const rememberContentIfNeeded = useCallback(
    (text: string) => {
      const lower = text.toLowerCase();
      if (!lower.includes("remember")) return;

      const memContent = text.replace(/remember\s*(that\s*)?/i, "").trim();
      if (!memContent) return;

      const item: MemoryItem = {
        id: crypto.randomUUID(),
        content: memContent,
        timestamp: new Date(),
        pinned: false,
      };

      setMemories((prev) => [item, ...prev]);
      addTaskLog("Memory saved");
    },
    [addTaskLog]
  );

  const sendMessage = useCallback(
    async (text: string): Promise<string> => {
      const cleanedText = text.trim();
      if (!cleanedText) return "";

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: cleanedText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);
      setOrbState("thinking");
      addTaskLog(`Processing: "${cleanedText.slice(0, 60)}${cleanedText.length > 60 ? "..." : ""}"`);

      rememberContentIfNeeded(cleanedText);

      try {
        const allMsgs = [...messages, userMsg];
        const response = await getAIResponse(allMsgs, memories);

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setIsProcessing(false);
        setOrbState("speaking");
        addTaskLog("Response generated");

        return response;
      } catch {
        const errMsg =
          "I apologize, but I encountered an error while processing your request. Please try again.";

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: errMsg,
            timestamp: new Date(),
          },
        ]);

        setIsProcessing(false);
        setOrbState("error");
        addTaskLog("Error processing request");

        return errMsg;
      }
    },
    [messages, memories, addTaskLog, rememberContentIfNeeded]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEYS.messages);
    addTaskLog("Conversation cleared");
  }, [addTaskLog]);

  const clearTaskLog = useCallback(() => {
    setTaskLog([]);
    localStorage.removeItem(STORAGE_KEYS.taskLog);
  }, []);

  const clearMemories = useCallback(() => {
    setMemories([]);
    localStorage.removeItem(STORAGE_KEYS.memories);
    addTaskLog("Memory cleared");
  }, [addTaskLog]);

  const pinMemory = useCallback((id: string) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m))
    );
  }, []);

  const deleteMemory = useCallback(
    (id: string) => {
      setMemories((prev) => prev.filter((m) => m.id !== id));
      addTaskLog("Memory deleted");
    },
    [addTaskLog]
  );

  const addMemory = useCallback(
    (content: string, pinned = false) => {
      if (!content.trim()) return;

      const item: MemoryItem = {
        id: crypto.randomUUID(),
        content: content.trim(),
        timestamp: new Date(),
        pinned,
      };

      setMemories((prev) => [item, ...prev]);
      addTaskLog("Memory added manually");
    },
    [addTaskLog]
  );

  return {
    messages,
    orbState,
    setOrbState,
    isProcessing,
    memories,
    taskLog,
    sendMessage,
    clearMessages,
    clearTaskLog,
    clearMemories,
    addMemory,
    pinMemory,
    deleteMemory,
  };
}