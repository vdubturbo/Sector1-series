import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server-admin'
import { isRulesAdmin } from '@/lib/rules/admin-auth'

export async function GET(request: NextRequest) {
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

  const adminClient = createAdminClient()

  const { data: rulebooks, error } = await adminClient
    .from('rulebooks')
    .select(
      'id, title, version_label, status, is_active, effective_date, uploaded_at, page_count, chunk_count, processing_error'
    )
    .order('uploaded_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: `Failed to fetch rulebooks: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ rulebooks: rulebooks || [] })
}
