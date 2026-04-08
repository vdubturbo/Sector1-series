export function isRulesAdmin(email: string | undefined): boolean {
  if (!email) return false

  const adminEmails = process.env.RULES_ADMIN_EMAILS
  if (!adminEmails) return false

  const allowed = adminEmails.split(',').map((e) => e.trim().toLowerCase())
  return allowed.includes(email.toLowerCase())
}
