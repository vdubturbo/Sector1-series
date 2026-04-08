import type { SupabaseClient } from '@supabase/supabase-js'
import { cohereEmbeddings } from './cohere-embeddings'

export interface RetrievedChunk {
  id: string
  rulebook_id: string
  chunk_index: number
  section_label: string | null
  heading_path: string | null
  page_number: number | null
  content: string
  similarity: number
}

export interface RetrievalResult {
  chunks: RetrievedChunk[]
  rulebook: {
    id: string
    title: string
    version_label: string | null
    effective_date: string | null
  }
}

function stemWord(word: string): string {
  const chargerMatch = word.match(/^(.+?)(charger|chargers|charged)$/i)
  if (chargerMatch && chargerMatch[1].length > 2) return chargerMatch[1]

  const stripped = word.replace(/(ation|ment|ness|ting|ing|ers|er|ed|es|ly|s)$/i, '')
  return stripped.length > 2 ? stripped : word
}

function extractKeywords(question: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'between',
    'through', 'during', 'before', 'after', 'and', 'but', 'or', 'not',
    'no', 'if', 'then', 'than', 'that', 'this', 'what', 'which', 'who',
    'how', 'when', 'where', 'why', 'all', 'each', 'any', 'some', 'i',
    'me', 'my', 'we', 'you', 'your', 'it', 'its', 'they', 'them',
    'allowed', 'required', 'need', 'use', 'run', 'get',
  ])

  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))

  const all = new Set<string>()
  for (const w of words) {
    all.add(w)
    const stem = stemWord(w)
    if (stem.length > 2) all.add(stem)
  }
  return [...all]
}

export async function retrieveRelevantChunks(
  question: string,
  supabaseAdminClient: SupabaseClient
): Promise<RetrievalResult> {
  const { data: rulebook, error: rulebookError } = await supabaseAdminClient
    .from('rulebooks')
    .select('id, title, version_label, effective_date')
    .eq('is_active', true)
    .single()

  if (rulebookError || !rulebook) {
    throw new Error(
      'No active rulebook found. An admin must upload and activate a rulebook before the Rules Assistant can answer questions.'
    )
  }

  const embedding = await cohereEmbeddings.generateEmbedding(question, 'search_query')

  const [semanticResult, keywordResult] = await Promise.all([
    supabaseAdminClient.rpc('match_rule_chunks', {
      query_embedding: embedding,
      rulebook_id_filter: rulebook.id,
      match_count: 12,
      similarity_threshold: 0.2,
    }),
    (async () => {
      const keywords = extractKeywords(question)
      if (keywords.length === 0) return { data: [], error: null }

      const patterns = keywords.map((kw) => `%${kw}%`)
      let query = supabaseAdminClient
        .from('rule_chunks')
        .select('id, rulebook_id, chunk_index, section_label, heading_path, page_number, content, token_count')
        .eq('rulebook_id', rulebook.id)

      const orFilter = patterns.map((p) => `content.ilike.${p}`).join(',')
      query = query.or(orFilter)

      return query.limit(10)
    })(),
  ])

  if (semanticResult.error) {
    throw new Error(`Semantic search failed: ${semanticResult.error.message}`)
  }

  const seenIds = new Set<string>()
  const merged: RetrievedChunk[] = []

  for (const chunk of (semanticResult.data || []) as RetrievedChunk[]) {
    seenIds.add(chunk.id)
    merged.push(chunk)
  }

  if (keywordResult.data) {
    for (const chunk of keywordResult.data) {
      if (!seenIds.has(chunk.id)) {
        seenIds.add(chunk.id)
        merged.push({
          id: chunk.id,
          rulebook_id: chunk.rulebook_id,
          chunk_index: chunk.chunk_index,
          section_label: chunk.section_label,
          heading_path: chunk.heading_path,
          page_number: chunk.page_number,
          content: chunk.content,
          similarity: 0.30,
        })
      }
    }
  }

  const boostKeywords = extractKeywords(question)
  for (const chunk of merged) {
    const contentLower = chunk.content.toLowerCase()
    const matchCount = boostKeywords.filter((kw) => contentLower.includes(kw)).length
    if (matchCount > 0) {
      chunk.similarity = Math.min(chunk.similarity + matchCount * 0.1, 1.0)
    }
  }

  merged.sort((a, b) => b.similarity - a.similarity)
  const finalChunks = merged.slice(0, 8)

  return {
    chunks: finalChunks,
    rulebook: {
      id: rulebook.id,
      title: rulebook.title,
      version_label: rulebook.version_label,
      effective_date: rulebook.effective_date,
    },
  }
}
