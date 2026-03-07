import ProtectedRoute from '@/components/ProtectedRoute'
import CreateTripForm from '@/components/CreateTripForm'

export default function NewTripPage() {
  return (
    <ProtectedRoute>
      <main className="flex min-h-screen items-center justify-center bg-green-950">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-green-950">New trip</h1>
            <p className="text-sm text-zinc-500">Only the name is required — fill in the rest later.</p>
          </div>
          <CreateTripForm />
        </div>
      </main>
    </ProtectedRoute>
  )
}
