import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b px-6 py-4">
        <span className="font-bold text-lg tracking-tight text-zinc-900">Punchlist</span>
        <span className="ml-2 text-sm text-zinc-500">Client Portal</span>
      </header>
      <main className="max-w-3xl mx-auto p-6">
        {children}
      </main>
    </div>
  )
}
