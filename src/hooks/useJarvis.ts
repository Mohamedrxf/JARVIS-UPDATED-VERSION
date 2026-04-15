import { useState, useCallback } from "react";
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

// Simple AI via Lovable AI Gateway (will be edge function later)
// For now, use a local conversation approach
async function getAIResponse(messages: Message[]): Promise<string> {
  // Build conversation for context
  const systemPrompt = `You are JARVIS, an advanced AI assistant inspired by Iron Man's JARVIS. You are helpful, intelligent, concise, and slightly formal but friendly. You address the user respectfully. Keep responses brief and actionable — typically 1-3 sentences unless more detail is needed. You can help with:
- Answering questions conversationally
- Web research and summaries
- Taking and managing notes
- Task planning and reminders
- Code generation and technical help
- General productivity assistance

When the user asks you to remember something, acknowledge it warmly. When asked what you remember, summarize stored context. Always be proactive and suggest next steps when appropriate.`;

  const chatMessages = messages.slice(-10).map(m => ({
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
    // Fallback
  }
  
  // Local fallback responses
  const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || "";
  if (lastMsg.includes("remember")) {
    return "Noted. I've stored that in my memory banks. You can ask me about it anytime.";
  }
  if (lastMsg.includes("calendar") || lastMsg.includes("schedule")) {
    return "I'd need calendar integration to check your schedule. For now, I can help you plan your day manually. What's on your agenda?";
  }
  if (lastMsg.includes("email")) {
    return "Email integration isn't configured yet. Would you like me to help draft an email instead?";
  }
  if (lastMsg.includes("note")) {
    return "I've made a note of that. You can view your notes in the memory panel.";
  }
  if (lastMsg.includes("hello") || lastMsg.includes("hi") || lastMsg.includes("hey")) {
    return "Hello! I'm JARVIS, at your service. How may I assist you today?";
  }
  return "I understand your request. To provide the best assistance, I recommend connecting Lovable Cloud for full AI capabilities. For now, I can help with basic interactions.";
}

export function useJarvis() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [taskLog, setTaskLog] = useState<string[]>([]);

  const addTaskLog = useCallback((entry: string) => {
    setTaskLog(prev => [`[${new Date().toLocaleTimeString()}] ${entry}`, ...prev].slice(0, 50));
  }, []);

  const sendMessage = useCallback(async (text: string): Promise<string> => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);
    setOrbState("thinking");
    addTaskLog(`Processing: "${text.slice(0, 50)}..."`);

    // Check for memory commands
    const lower = text.toLowerCase();
    if (lower.includes("remember")) {
      const memContent = text.replace(/remember\s*(that\s*)?/i, "").trim();
      if (memContent) {
        setMemories(prev => [...prev, {
          id: crypto.randomUUID(),
          content: memContent,
          timestamp: new Date(),
          pinned: false,
        }]);
        addTaskLog("Memory saved");
      }
    }

    try {
      const allMsgs = [...messages, userMsg];
      const response = await getAIResponse(allMsgs);
      
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMsg]);
      addTaskLog("Response generated");
      setOrbState("speaking");
      setIsProcessing(false);
      return response;
    } catch (err) {
      setOrbState("error");
      setIsProcessing(false);
      addTaskLog("Error processing request");
      const errMsg = "I apologize, but I encountered an error. Please try again.";
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: errMsg,
        timestamp: new Date(),
      }]);
      return errMsg;
    }
  }, [messages, addTaskLog]);

  const clearMessages = useCallback(() => setMessages([]), []);

  const pinMemory = useCallback((id: string) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, pinned: !m.pinned } : m));
  }, []);

  const deleteMemory = useCallback((id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  }, []);

  return {
    messages,
    orbState,
    setOrbState,
    isProcessing,
    memories,
    taskLog,
    sendMessage,
    clearMessages,
    pinMemory,
    deleteMemory,
  };
}
