export interface ParsedChunk {
  chunk_index: number
  content: string
  section_label: string | null
  heading_path: string | null
  page_number: number | null
  token_count: number
}

export interface ParseResult {
  chunks: ParsedChunk[]
  page_count: number
  total_chars: number
}

const SECTION_PATTERNS = [
  /^(Article|Section|Rule|Chapter)\s+\d+/i,
  /^\d+\.\d+(\.\d+)?\s+[A-Z]/,
  /^\d+\.\s+[A-Z]/,
]

const MAX_CHUNK_CHARS = 2400 // ~600 tokens
const MIN_CHUNK_CHARS = 100
const OVERLAP_CHARS = 50

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function isSectionHeading(line: string): boolean {
  const trimmed = line.trim()
  return SECTION_PATTERNS.some((pat) => pat.test(trimmed))
}

function extractSectionLabel(text: string): string | null {
  const firstLine = text.trim().split('\n')[0]?.trim()
  if (!firstLine) return null
  if (isSectionHeading(firstLine)) {
    return firstLine.length > 120 ? firstLine.slice(0, 120) + '…' : firstLine
  }
  return null
}

function cleanText(text: string, pageTexts: string[]): string {
  const lineCounts = new Map<string, number>()
  for (const pageText of pageTexts) {
    const lines = pageText.split('\n')
    const candidates = [...lines.slice(0, 3), ...lines.slice(-3)]
    for (const line of candidates) {
      const trimmed = line.trim()
      if (trimmed.length > 0 && trimmed.length < 200) {
        lineCounts.set(trimmed, (lineCounts.get(trimmed) || 0) + 1)
      }
    }
  }
  const repeatedLines = new Set(
    [...lineCounts.entries()]
      .filter(([, count]) => count >= 5)
      .map(([line]) => line)
  )

  const cleaned = text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (repeatedLines.has(trimmed)) return ''
      return trimmed
    })
    .join('\n')

  return cleaned.replace(/\n{3,}/g, '\n\n').trim()
}

function splitOnParagraphs(text: string): string[] {
  const paragraphs = text.split(/\n\n+/)
  const result: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= MAX_CHUNK_CHARS) {
      current = current ? current + '\n\n' + para : para
    } else {
      if (current.length >= MIN_CHUNK_CHARS) {
        result.push(current)
      }
      current = para
      while (current.length > MAX_CHUNK_CHARS) {
        const splitPoint = current.lastIndexOf(' ', MAX_CHUNK_CHARS)
        const breakAt = splitPoint > MIN_CHUNK_CHARS ? splitPoint : MAX_CHUNK_CHARS
        result.push(current.slice(0, breakAt))
        const overlapStart = Math.max(0, breakAt - OVERLAP_CHARS)
        current = current.slice(overlapStart)
      }
    }
  }

  if (current.length >= MIN_CHUNK_CHARS) {
    result.push(current)
  }

  return result
}

function findPageForOffset(offset: number, pageOffsets: number[]): number | null {
  for (let i = pageOffsets.length - 1; i >= 0; i--) {
    if (offset >= pageOffsets[i]) {
      return i + 1
    }
  }
  return null
}

export async function parseAndChunkPDF(buffer: Buffer): Promise<ParseResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse/lib/pdf-parse.js')

  const pageTexts: string[] = []
  const pageOffsets: number[] = []
  let runningOffset = 0

  const result = await pdfParse(buffer, {
    pagerender: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) => {
      return pageData.getTextContent().then((textContent) => {
        const strings = textContent.items.map((item) => item.str)
        const pageText = strings.join(' ')
        pageTexts.push(pageText)
        pageOffsets.push(runningOffset)
        runningOffset += pageText.length + 1
        return pageText
      })
    },
  })

  const fullText = result.text as string
  const pageCount = result.numpages as number
  const totalChars = fullText.length

  const cleaned = cleanText(fullText, pageTexts)

  const lines = cleaned.split('\n')
  const sections: { text: string; startOffset: number }[] = []
  let currentSection = ''
  let currentOffset = 0
  let charPos = 0

  for (const line of lines) {
    if (isSectionHeading(line) && currentSection.trim().length > 0) {
      sections.push({ text: currentSection, startOffset: currentOffset })
      currentSection = line + '\n'
      currentOffset = charPos
    } else {
      if (currentSection.length === 0) {
        currentOffset = charPos
      }
      currentSection += line + '\n'
    }
    charPos += line.length + 1
  }

  if (currentSection.trim().length > 0) {
    sections.push({ text: currentSection, startOffset: currentOffset })
  }

  const chunks: ParsedChunk[] = []
  let chunkIndex = 0

  for (const section of sections) {
    const trimmed = section.text.trim()
    if (trimmed.length < MIN_CHUNK_CHARS) continue

    const sectionLabel = extractSectionLabel(trimmed)

    if (trimmed.length <= MAX_CHUNK_CHARS) {
      chunks.push({
        chunk_index: chunkIndex++,
        content: trimmed,
        section_label: sectionLabel,
        heading_path: sectionLabel,
        page_number: pageOffsets.length > 0
          ? findPageForOffset(section.startOffset, pageOffsets)
          : null,
        token_count: estimateTokens(trimmed),
      })
    } else {
      const subChunks = splitOnParagraphs(trimmed)
      for (let i = 0; i < subChunks.length; i++) {
        const sub = subChunks[i]
        const subLabel = i === 0 ? sectionLabel : sectionLabel ? `${sectionLabel} (cont.)` : null
        chunks.push({
          chunk_index: chunkIndex++,
          content: sub,
          section_label: subLabel,
          heading_path: sectionLabel,
          page_number: pageOffsets.length > 0
            ? findPageForOffset(section.startOffset, pageOffsets)
            : null,
          token_count: estimateTokens(sub),
        })
      }
    }
  }

  return { chunks, page_count: pageCount, total_chars: totalChars }
}
