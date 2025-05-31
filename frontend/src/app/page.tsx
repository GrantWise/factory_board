import Dashboard from "@/dashboard"
import { ProtectedRoute } from "@/components/auth/protected-route"

export default function Page() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  )
}
