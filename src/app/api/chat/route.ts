import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

//* Connect to FDA Database
const FDC_API_KEY = process.env.FDC_API_KEY

export const runtime = 'edge'
export const maxDuration = 60

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

//* Helper: Fetch nutrition info from FDA API
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

    //* Step 1: Extract food items from the latest user message
    const extraction = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
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

    //* Step 2: Fetch nutrition info
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

    //* Step 3: Inject system message with FDA data
    const enhancedMessages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `You are a helpful nutritionist. Use the FDA-backed nutritional data below to inform your response.
          Make sure you complete the following requirements: 
          - If the user asks about the nutritional value of a food item, provide the data from the FDA API. 
          - If the user asks for a recipe or meal plan, use the nutritional data to suggest healthy options. 
          - If the user asks about dietary restrictions, use the nutritional data to inform your response. 
          - If the user asks for general nutrition advice, use the FDA data to support your recommendations.
          - If data is missing, explain that and offer general advice.
          Ensure that your response is clear, concise, and informative.
          Use the data to support your recommendations and provide actionable advice.
          Make sure to not use quotes in your response. Please only make use of periods, commas, dashes, and new lines.
          When using new lines make sure that at least two are used in a row to separate paragraphs.
          Make sure to not use any markdown or code blocks in your response.
          `,
      },
      {
        role: 'system',
        content: `FDA Nutrition Data:\n${nutritionSummary || 'No data found for input foods.'}`,
      },
      ...messages,
    ]

    // 🔄 Step 4: Stream GPT response
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: enhancedMessages,
    })

    const response = completion.choices[0].message.content
    console.log('ChatGPT response:', response)
    return new Response(JSON.stringify(response), {
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
