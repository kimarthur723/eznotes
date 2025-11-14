import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface StructuredSummary {
  topics: string[]
  decisions: string[]
  actionItems: string[]
}

/**
 * Generate a structured summary from meeting transcripts
 *
 * Returns:
 * - Main topics discussed
 * - Key decisions made
 * - Action items identified
 */
export async function generateLiveSummary(
  transcripts: Array<{ speaker: string; text: string; timestamp: number }>
): Promise<StructuredSummary> {
  if (!transcripts || transcripts.length === 0) {
    return {
      topics: [],
      decisions: [],
      actionItems: [],
    }
  }

  // Format transcripts as conversation
  const conversation = transcripts
    .map(t => `${t.speaker}: ${t.text}`)
    .join('\n')

  const prompt = `You are analyzing a live meeting transcript. Extract and organize the key information into three categories:

1. **Main Topics**: What are the primary subjects being discussed? (bullet points)
2. **Key Decisions**: What decisions have been made? (bullet points)
3. **Action Items**: What tasks or actions were assigned? Include who is responsible if mentioned. (bullet points)

Be concise and focus on the most important points. If a category has no relevant information, return an empty array.

Transcript:
${conversation}

Respond in JSON format:
{
  "topics": ["topic 1", "topic 2", ...],
  "decisions": ["decision 1", "decision 2", ...],
  "actionItems": ["action item 1", "action item 2", ...]
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a meeting assistant that extracts structured information from transcripts. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    const summary = JSON.parse(content) as StructuredSummary

    return {
      topics: summary.topics || [],
      decisions: summary.decisions || [],
      actionItems: summary.actionItems || [],
    }
  } catch (error) {
    console.error('Error generating summary:', error)
    throw error
  }
}
