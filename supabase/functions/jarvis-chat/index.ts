import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function sanitizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((msg) => {
      return (
        msg &&
        typeof msg === "object" &&
        typeof (msg as Record<string, unknown>).role === "string" &&
        typeof (msg as Record<string, unknown>).content === "string"
      );
    })
    .map((msg) => {
      const typedMsg = msg as { role: string; content: string };

      const safeRole: ChatMessage["role"] =
        typedMsg.role === "assistant"
          ? "assistant"
          : typedMsg.role === "system"
            ? "system"
            : "user";

      return {
        role: safeRole,
        content: typedMsg.content.trim(),
      };
    })
    .filter((msg) => msg.content.length > 0)
    .slice(-20);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const rawMessages = (body as Record<string, unknown>).messages;
    const rawSystemPrompt = (body as Record<string, unknown>).systemPrompt;

    const messages = sanitizeMessages(rawMessages);
    const systemPrompt =
      typeof rawSystemPrompt === "string" && rawSystemPrompt.trim().length > 0
        ? rawSystemPrompt.trim()
        : "You are JARVIS, an advanced AI assistant. Be concise, helpful, and slightly formal.";

    if (messages.length === 0) {
      return jsonResponse({ error: "No valid messages provided" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const LOVABLE_MODEL =
      Deno.env.get("LOVABLE_MODEL") || "google/gemini-3-flash-preview";

    if (!LOVABLE_API_KEY) {
      return jsonResponse(
        { error: "LOVABLE_API_KEY is not configured" },
        500
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let response: Response;

    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: LOVABLE_MODEL,
          temperature: 0.7,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown upstream error");
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return jsonResponse(
          { error: "Rate limited. Please try again in a moment." },
          429
        );
      }

      if (response.status === 402) {
        return jsonResponse(
          { error: "AI credits exhausted. Please add funds." },
          402
        );
      }

      if (response.status === 401) {
        return jsonResponse(
          { error: "Invalid Lovable API configuration." },
          401
        );
      }

      return jsonResponse(
        {
          error: "AI service error",
          details: errorText,
        },
        500
      );
    }

    const data = await response.json().catch(() => null);
    const content =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I apologize, I couldn't generate a response.";

    return jsonResponse({ response: content }, 200);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return jsonResponse(
        { error: "AI request timed out. Please try again." },
        504
      );
    }

    console.error("jarvis-chat error:", error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});