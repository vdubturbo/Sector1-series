import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { isRulesAdmin } from '@/lib/rules/admin-auth'
import { parseAndChunkPDF } from '@/lib/rules/pdf-parser'
import { cohereEmbeddings } from '@/lib/rules/cohere-embeddings'

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

async function processRulebook(
  rulebookId: string,
  filePath: string,
  adminClient: ReturnType<typeof createAdminClient>
) {
  try {
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('rulebooks')
      .download(filePath)
    if (downloadError) throw downloadError

    const buffer = Buffer.from(await fileData.arrayBuffer())

    const { chunks, page_count } = await parseAndChunkPDF(buffer)

    const texts = chunks.map((c) => c.content)
    const embeddings = await cohereEmbeddings.generateBatchEmbeddings(texts, 'search_document')

    const chunkRows = chunks.map((chunk, i) => ({
      rulebook_id: rulebookId,
      chunk_index: chunk.chunk_index,
      section_label: chunk.section_label,
      heading_path: chunk.heading_path,
      page_number: chunk.page_number,
      content: chunk.content,
      token_count: chunk.token_count,
      embedding: embeddings[i],
    }))

    for (let i = 0; i < chunkRows.length; i += 50) {
      const batch = chunkRows.slice(i, i + 50)
      const { error } = await adminClient.from('rule_chunks').insert(batch)
      if (error) throw error
    }

    await adminClient
      .from('rulebooks')
      .update({
        status: 'ready',
        page_count,
        chunk_count: chunks.length,
      })
      .eq('id', rulebookId)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await adminClient
      .from('rulebooks')
      .update({
        status: 'failed',
        processing_error: message,
      })
      .eq('id', rulebookId)
  }
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAuthenticatedClient(token)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!isRulesAdmin(user?.email ?? undefined)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null
  const versionLabel = formData.get('version_label') as string | null

  if (!file) {
    return NextResponse.json({ error: 'PDF file is required.' }, { status: 400 })
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'File must be a PDF.' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File must be 15MB or smaller.' }, { status: 400 })
  }

  if (!title || title.trim().length === 0) {
    return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const sanitizedName = file.name.replace(/[^a-z0-9.-]/gi, '_')
  const filePath = `rulebooks/${Date.now()}_${sanitizedName}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await adminClient.storage
    .from('rulebooks')
    .upload(filePath, buffer, { contentType: 'application/pdf' })

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    )
  }

  const { data: rulebook, error: insertError } = await adminClient
    .from('rulebooks')
    .insert({
      title: title.trim(),
      version_label: versionLabel?.trim() || null,
      file_path: filePath,
      status: 'processing',
      uploaded_at: new Date().toISOString(),
      created_by: user!.id,
    })
    .select('id')
    .single()

  if (insertError || !rulebook) {
    return NextResponse.json(
      { error: `Failed to create rulebook record: ${insertError?.message}` },
      { status: 500 }
    )
  }

  processRulebook(rulebook.id, filePath, adminClient).catch((err) =>
    console.error('Rulebook processing failed:', err)
  )

  return NextResponse.json({
    success: true,
    rulebook_id: rulebook.id,
    message: 'Upload received. Processing started.',
  })
}
