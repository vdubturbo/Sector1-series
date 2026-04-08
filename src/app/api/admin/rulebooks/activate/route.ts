import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { isRulesAdmin } from '@/lib/rules/admin-auth'

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

  let body: { rulebook_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const rulebookId = body.rulebook_id
  if (!rulebookId || typeof rulebookId !== 'string' || rulebookId.trim().length === 0) {
    return NextResponse.json({ error: 'rulebook_id is required.' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: target, error: fetchError } = await adminClient
    .from('rulebooks')
    .select('id, status')
    .eq('id', rulebookId)
    .single()

  if (fetchError || !target) {
    return NextResponse.json({ error: 'Rulebook not found.' }, { status: 404 })
  }

  if (target.status !== 'ready') {
    return NextResponse.json(
      { error: `Rulebook status is "${target.status}". Only "ready" rulebooks can be activated.` },
      { status: 400 }
    )
  }

  await adminClient.from('rulebooks').update({ is_active: false }).neq('id', 'none')
  await adminClient.from('rulebooks').update({ is_active: true }).eq('id', rulebookId)

  return NextResponse.json({ success: true })
}
