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
  role: "user" | "assistant" | "system"
  content: string
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

    // Check if this is the first message in a conversation
    const isFirstMessage = messages.length === 1 && messages[0].role === "user"
    let title = null

    // Generate a title if this is the first message
    if (isFirstMessage) {
      try {
        const titleCompletion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that generates short, concise titles (3-5 words) for conversations based on the user's initial message. The title should capture the main topic or intent.",
            },
            { role: "user", content: messages[0].content },
          ],
          max_tokens: 25,
          temperature: 0.7,
        })

        title = titleCompletion.choices[0].message.content?.trim() || null
        console.log("Generated title:", title)
      } catch (titleError) {
        console.error("Error generating title:", titleError)
        // Continue with the main request even if title generation fails
      }
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

    // Create a stream with the title included in the metadata
    const stream = OpenAIStream(response as AsyncIterable<ChatCompletionChunk>, {
      onStart: async () => {
        // This function runs at the start of the stream
        return { title }
      },
    })

    // Return the streaming response with the metadata
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
