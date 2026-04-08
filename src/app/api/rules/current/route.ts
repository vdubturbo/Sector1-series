import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server-admin'

export async function GET() {
  const adminClient = createAdminClient()

  const { data: rulebook, error } = await adminClient
    .from('rulebooks')
    .select('title, version_label, effective_date')
    .eq('is_active', true)
    .single()

  if (error || !rulebook) {
    return NextResponse.json({ active: false })
  }

  return NextResponse.json({
    active: true,
    title: rulebook.title,
    version_label: rulebook.version_label,
    effective_date: rulebook.effective_date,
  })
}
