import { CohereClient } from 'cohere-ai'

const MODEL = 'embed-english-v3.0'
const DIMENSION = 1024
const BATCH_SIZE = 96

class CohereEmbeddingService {
  private client: CohereClient | null = null

  private getClient(): CohereClient {
    if (!this.client) {
      const apiKey = process.env.COHERE_API_KEY
      if (!apiKey) {
        throw new Error('COHERE_API_KEY environment variable is not set')
      }
      this.client = new CohereClient({ token: apiKey })
    }
    return this.client
  }

  get dimension(): number {
    return DIMENSION
  }

  async generateEmbedding(
    text: string,
    inputType: 'search_document' | 'search_query' = 'search_document'
  ): Promise<number[]> {
    const response = await this.getClient().embed({
      texts: [text],
      model: MODEL,
      inputType,
    })

    const embeddings = response.embeddings as number[][]
    if (!embeddings || embeddings.length === 0) {
      throw new Error('Cohere returned empty embeddings response')
    }

    return embeddings[0]
  }

  async generateBatchEmbeddings(
    texts: string[],
    inputType: 'search_document' | 'search_query' = 'search_document'
  ): Promise<number[][]> {
    if (texts.length === 0) return []

    const results: number[][] = []

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE)

      const response = await this.getClient().embed({
        texts: batch,
        model: MODEL,
        inputType,
      })

      const embeddings = response.embeddings as number[][]
      if (!embeddings || embeddings.length !== batch.length) {
        throw new Error(
          `Cohere returned ${embeddings?.length ?? 0} embeddings for batch of ${batch.length} texts`
        )
      }

      results.push(...embeddings)
    }

    return results
  }
}

export const cohereEmbeddings = new CohereEmbeddingService()
