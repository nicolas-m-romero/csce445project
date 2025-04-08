import OpenAI from "openai"
import { OpenAIStream, StreamingTextResponse } from "ai"
import type { ChatCompletionChunk } from "openai/resources/chat"

// Create an OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const runtime = "nodejs"
export const maxDuration = 60 // Increase the function timeout to 60 seconds

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(req: Request) {
  try {
    // Parse the request body
    const body = await req.json()
    const { messages } = body

    // Verify we have an API key
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key not configured")
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Validate messages input
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid request: 'messages' must be an array." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Optional: limit number of messages to prevent excessive usage
    if (messages.length > 50) {
      return new Response(JSON.stringify({ error: "Too many messages provided. Limit to 50." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Use streaming with Vercel AI SDK-compatible format
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      stream: true,
      messages: messages.map((message: ChatMessage) => ({
        role: message.role,
        content: message.content,
      })),
    })

    const stream = OpenAIStream(response as AsyncIterable<ChatCompletionChunk>)
    return new StreamingTextResponse(stream)
  } catch (error) {
    const err = error as Error & { code?: string }
    console.error("Error in chat API route:", err)

    // Return a more detailed error response
    return new Response(
      JSON.stringify({
        error: err.message || "An error occurred",
        details: err.stack,
        code: err.code || "unknown_error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
}
