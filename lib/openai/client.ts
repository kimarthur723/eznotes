import OpenAI from 'openai'

/**
 * OpenAI Client for AI-powered features
 * - Meeting summaries
 * - Action item extraction
 * - Key insights generation
 */

export class OpenAIService {
  private client: OpenAI

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.warn('[Warning] OPENAI_API_KEY not set. AI features will be disabled.')
    }

    this.client = new OpenAI({
      apiKey: apiKey || 'placeholder',
    })
  }

  /**
   * Generate a concise meeting summary from transcripts
   */
  async generateSummary(transcripts: Array<{ speaker: string; text: string; timestamp: number }>): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.')
    }

    if (!transcripts || transcripts.length === 0) {
      throw new Error('No transcripts provided to summarize')
    }

    const formattedTranscript = transcripts
      .map(t => `[${this.formatTimestamp(t.timestamp)}] ${t.speaker}: ${t.text}`)
      .join('\n')

    console.log(`[OpenAI] Generating summary for ${transcripts.length} transcript segments (${formattedTranscript.length} characters)`)

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that creates concise, well-structured meeting summaries.
Focus on:
1. Main topics discussed
2. Key decisions made
3. Important points raised
4. Next steps or action items mentioned

Format the summary in clear sections with bullet points. Keep it concise but comprehensive.`
          },
          {
            role: 'user',
            content: `Please summarize this meeting transcript:\n\n${formattedTranscript}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      })

      const summary = response.choices[0]?.message?.content || 'No summary generated'
      console.log(`[OpenAI] Summary generated successfully (${summary.length} characters)`)
      return summary.trim()
    } catch (error: any) {
      console.error('[OpenAI] API Error:', error)
      const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error'
      throw new Error(`Failed to generate summary: ${errorMessage}`)
    }
  }

  /**
   * Extract action items from meeting transcripts
   */
  async extractActionItems(transcripts: Array<{ speaker: string; text: string; timestamp: number }>): Promise<Array<{
    title: string
    description?: string
    assignedTo?: string
    priority?: 'high' | 'medium' | 'low'
  }>> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    const formattedTranscript = transcripts
      .map(t => `[${this.formatTimestamp(t.timestamp)}] ${t.speaker}: ${t.text}`)
      .join('\n')

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an assistant that extracts action items from meeting transcripts.
Return ONLY a JSON array of action items. Each item should have:
- title: Brief description of the task
- description: More details if available
- assignedTo: Name of the person assigned (if mentioned)
- priority: "high", "medium", or "low"

Example format:
[
  {
    "title": "Send project proposal to client",
    "description": "Include budget breakdown and timeline",
    "assignedTo": "John",
    "priority": "high"
  }
]

If no action items are found, return an empty array: []`
          },
          {
            role: 'user',
            content: `Extract action items from this meeting:\n\n${formattedTranscript}`
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        return []
      }

      const parsed = JSON.parse(content)
      return parsed.actionItems || parsed.items || parsed.actions || []
    } catch (error: any) {
      console.error('[OpenAI] API Error:', error.message)
      return []
    }
  }

  /**
   * Format timestamp in seconds to MM:SS
   */
  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
}

export const openaiService = new OpenAIService()
