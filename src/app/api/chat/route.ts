import { OpenAI } from 'openai'
//import { StreamingTextResponse, OpenAIStream } from 'ai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const FDC_API_KEY = process.env.FDC_API_KEY

export const runtime = 'edge'
export const maxDuration = 60

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// 🥦 Helper: Fetch nutrition info from FDA API
async function fetchFDAInfo(foodItems: string[]) {
  const results = []

  for (const item of foodItems) {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(
        item
      )}&api_key=${FDC_API_KEY}`
    )
    const data = await res.json()

    if (data.foods?.length > 0) {
      results.push({
        item,
        nutrients: data.foods[0].foodNutrients?.slice(0, 5) || [],
      })
    }
  }

  return results
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messages } = body

    if (!process.env.OPENAI_API_KEY || !FDC_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing API keys' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "'messages' must be an array." }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    if (messages.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Too many messages provided. Limit to 50.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // 🧠 Generate a short title if it's the first user message
    let title = null
    if (messages.length === 1 && messages[0].role === 'user') {
      try {
        const titleCompletion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'Generate a short, 3-5 word title based on this user message.',
            },
            { role: 'user', content: messages[0].content },
          ],
          max_tokens: 25,
        })

        title = titleCompletion.choices[0].message.content?.trim() || null
      } catch (err) {
        console.warn('Could not generate title:', err)
      }
    }

    // 🍽 Step 1: Extract food items from the latest user message
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'Extract individual food items from the user\'s message. Only return a comma-separated list.',
        },
        messages[messages.length - 1],
      ],
    })

    const foodList = extraction.choices[0].message.content ?? ''
    const foodItems = foodList
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    // 🍏 Step 2: Fetch nutrition info
    const nutritionData = await fetchFDAInfo(foodItems)

    const nutritionSummary = nutritionData
      .map((entry) => {
        const nutrients = entry.nutrients
        .map((n: { nutrientName: string; value: number; unitName: string }) => 
          `${n.nutrientName}: ${n.value} ${n.unitName}`
        )
        .join(', ')

        return `${entry.item} → ${nutrients}`
      })
      .join('\n')

    // 💬 Step 3: Inject system message with FDA data
    const enhancedMessages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You are a helpful nutritionist. Use the FDA-backed nutritional data below to inform your response. If data is missing, explain that and offer general advice.',
      },
      {
        role: 'system',
        content: `FDA Nutrition Data:\n${nutritionSummary || 'No data found for input foods.'}`,
      },
      ...messages,
    ]

    // 🔄 Step 4: Stream GPT response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: enhancedMessages,
    })


    return new Response(JSON.stringify({
      title,
      message: completion.choices[0].message.content,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
    
  } catch (error) {
    const err = error as Error & { code?: string }
    console.error('Error in chat route:', err)
    return new Response(
      JSON.stringify({
        error: err.message || 'Unexpected error',
        stack: err.stack,
        code: err.code || 'unknown_error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
