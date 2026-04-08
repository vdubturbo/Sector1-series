import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { retrieveRelevantChunks } from '@/lib/rules/retrieval'
import { streamAnswer } from '@/lib/rules/answer-generator'

export async function POST(request: NextRequest) {
  let body: { question?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const question = body.question?.trim()
  if (!question || question.length === 0) {
    return NextResponse.json({ error: 'Question is required.' }, { status: 400 })
  }

  if (question.length > 500) {
    return NextResponse.json({ error: 'Question must be 500 characters or fewer.' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  try {
    const { chunks, rulebook } = await retrieveRelevantChunks(question, adminClient)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        await streamAnswer({
          question,
          chunks,
          rulebook,
          onToken: (token) => {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'token', content: token }) + '\n'))
          },
          onComplete: (sources) => {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', sources }) + '\n'))
            controller.close()
          },
          onError: (error) => {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'error', message: error.message }) + '\n')
            )
            controller.close()
          },
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
