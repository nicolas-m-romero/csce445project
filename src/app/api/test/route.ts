import OpenAI from "openai"

export const runtime = "nodejs"

export async function GET() {
  // Check for API key explicitly
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "OpenAI API key is not configured",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ 
        role: "user", 
        content: "Perform a simple test of API connectivity. Respond with exactly: 'API Test Successful'" 
      }],
    })

    const responseMessage = completion.choices[0].message.content

    return new Response(
      JSON.stringify({
        success: true,
        response: responseMessage === "API Test Successful" 
          ? "Connectivity verified" 
          : "Unexpected API response",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    // More specific error logging could be added here
    console.error("OpenAI API Test Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error 
          ? error.message 
          : "Unknown error occurred during API test",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}