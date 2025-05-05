import { OpenAI } from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { diff, description } = await request.json();

    if (!diff || !description) {
      return NextResponse.json(
        { error: "Missing required fields: diff and description" },
        { status: 400 }
      );
    }

    //create streaming response
    const stream = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert software developer and technical writer who specializes in creating dual tone release notes from Git diffs.
                    For each code change (diff), generate TWO distinct types of release notes:
                    
                    1. DEVELOPER NOTES: 
                    - Technical and concise
                    - Focus on WHAT changed and WHY it matters to developers
                    - Use precise technical terminology
                    - Include specific functions, methods, or components affected
                    - Highlight architectural improvements or patterns applied
                    - Example: "Refactored \`useFetchDiffs\` hook to use \`useSWR\` for improved caching and reduced re-renders."
                   

                    2. MARKETING NOTES:
                    - Format as 2-5 concise paragraphs separated by line breaks
                    - Each paragraph should focus on a distinct aspect or benefit
                    - Begin with the most exciting or impactful features
                    - Use accessible, engaging language that highlights user benefits
                    - Avoid technical jargon and focus on what users can do with the changes
                    - Use a friendly, enthusiastic tone
                    - Example: "Loading pull requests is now faster and smoother thanks to improved data fetching!"
            

                    FORMAT REQUIREMENTS:
                    - Use proper line breaks and paragraphs for readability
                    - Include bullet points (•) for developer notes
                    - Include spacing between paragraphs
                    - Always use the exact JSON structure shown below
                    - Do NOT use markdown formatting in your response
                    - Be comprehensive but organized, categorizing related changes together

                    
                    
                    Format your response as JSON with the following structure:
                    {
                    "developer": "Your technical developer notes here",
                    "marketing": "Your user-friendly marketing notes here"
                    }`,
        },
        {
          role: "user",
          content: `PR Title: ${description}\n\nDiff:\n${diff}`,
        },
      ],
      stream: true,
      response_format: { type: "json_object" },
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      },
    });

    return new NextResponse(readable, {
      headers: {
        "Content-type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache", 
      },
    });
  } catch (error) {
    let errorMessage = "Unknown error generating release notes";
    let errorStatus = 500;
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    if (typeof error === "object" && error !== null && "status" in error) {
      errorStatus = error.status as number;
    }

    console.error("OpenAI API Error:", errorMessage);

    // Handle specific error cases
    if (errorStatus === 401) {
      return NextResponse.json(
        {
          error: "Authentication error. Please check your OpenAI API key.",
          details: errorMessage,
        },
        { status: 401 }
      );
    }
    if (errorStatus === 429) {
      return NextResponse.json(
        {
          error: "OpenAI API rate limit exceeded. Please try again later.",
          details: errorMessage,
        },
        { status: 429 }
      );
    }
    if (errorStatus === 400) {
      return NextResponse.json(
        {
          error: "Invalid request to OpenAI API.",
          details: errorMessage,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: "Failed to generate release notes from OpenAI.",
        details: errorMessage,
      },
      { status: errorStatus }
    );
  }
}
