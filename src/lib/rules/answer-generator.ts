import OpenAI from 'openai'
import type { RetrievedChunk, RetrievalResult } from './retrieval'

export interface SourceCitation {
  chunk_id: string
  section_label: string | null
  page_number: number | null
  excerpt: string
}

export interface AnswerStreamOptions {
  question: string
  chunks: RetrievedChunk[]
  rulebook: RetrievalResult['rulebook']
  onToken: (token: string) => void
  onComplete: (sources: SourceCitation[]) => void
  onError: (error: Error) => void
}

const SYSTEM_PROMPT = `You are the Sector1 Rules Assistant, an AI that answers questions about series rules using the provided rulebook excerpts.

IMPORTANT: The excerpts below were extracted from a PDF and may have formatting artifacts (extra spaces, broken tables, partial sentences at chunk boundaries). Look past formatting issues and focus on the actual rule content. If the information is present — even in a table, list, or modifier section — use it to answer.

Guidelines:
- Answer based on the provided excerpts. You may use general motorsports knowledge to INTERPRET the excerpts, but do not invent rules that aren't supported by the text.
- If the excerpts contain relevant information, synthesize a clear answer and cite the section. Be helpful — explain what the rule means in practical terms.
- If a question is about whether something is "allowed," look for modifier tables, restrictions, and class-specific rules.
- If the excerpts are partially relevant but don't fully answer the question, share what you found and note what's unclear.
- Only say you couldn't find an answer if the excerpts truly contain nothing relevant to the topic.
- Format citations like: (Section 4.2, Page 12)
- Keep answers concise and plain-English.
- Never fabricate specific rules, numbers, or penalties that aren't in the excerpts.`

function cleanChunkContent(content: string): string {
  return content
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n +/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk) => {
      const source = chunk.section_label || `Section ${chunk.chunk_index}`
      const page = chunk.page_number || 'unknown'
      return `[SOURCE: ${source}, Page ${page}]\n${cleanChunkContent(chunk.content)}`
    })
    .join('\n\n---\n\n')
}

function buildCitations(chunks: RetrievedChunk[]): SourceCitation[] {
  const sorted = [...chunks].sort((a, b) => b.similarity - a.similarity)
  return sorted.slice(0, 4).map((chunk) => ({
    chunk_id: chunk.id,
    section_label: chunk.section_label,
    page_number: chunk.page_number,
    excerpt: chunk.content.slice(0, 200),
  }))
}

export async function streamAnswer(options: AnswerStreamOptions): Promise<void> {
  const { question, chunks, rulebook, onToken, onComplete, onError } = options

  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }

    const openai = new OpenAI({ apiKey })

    const contextBlock = buildContextBlock(chunks)

    const userMessage = `Question: ${question}

Rulebook: ${rulebook.title}${rulebook.version_label ? ` (${rulebook.version_label})` : ''}

--- RULEBOOK EXCERPTS ---
${contextBlock}
--- END EXCERPTS ---`

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      temperature: 0,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        onToken(delta)
      }
    }

    const sources = buildCitations(chunks)
    onComplete(sources)
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)))
  }
}
