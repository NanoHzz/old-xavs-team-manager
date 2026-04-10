import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useTeam } from './contexts/TeamContext'
import { AuthProvider } from './contexts/AuthContext'
import { TeamProvider } from './contexts/TeamContext'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { AppLayout } from './components/layout/AppLayout'

// Auth pages
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import MagicLinkPage from './pages/auth/MagicLinkPage'

// Club pages
import ClubSetupPage from './pages/club/ClubSetupPage'
import JoinTeamPage from './pages/club/JoinTeamPage'

// Player pages
import DashboardPage from './pages/player/DashboardPage'
import AvailabilityPage from './pages/player/AvailabilityPage'
import PreferencesPage from './pages/player/PreferencesPage'
import ProfilePage from './pages/player/ProfilePage'
import TeamSheetPage from './pages/player/TeamSheetPage'
import SquadPage from './pages/player/SquadPage'
import MatchCentrePage from './pages/player/MatchCentrePage'

// Coach pages
import TeamSelectionPage from './pages/coach/TeamSelectionPage'
import PlayerRatingsPage from './pages/coach/PlayerRatingsPage'
import RolesPage from './pages/coach/RolesPage'
import RoundsPage from './pages/coach/RoundsPage'
import SettingsPage from './pages/coach/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { teams, loading: teamLoading } = useTeam()

  if (authLoading || teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  if (teams.length === 0) {
    return <Navigate to="/club/setup" />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      {/* Join route available for both logged-in and logged-out users */}
      <Route path="/join/:code" element={<JoinTeamPage />} />

      {!user ? (
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/magic-link" element={<MagicLinkPage />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </>
      ) : (
        <>
          {/* Club setup */}
          <Route path="/club/setup" element={<ClubSetupPage />} />

          {/* Protected app routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="squad" element={<SquadPage />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="preferences" element={<PreferencesPage />} />
            <Route path="team-sheet" element={<TeamSheetPage />} />
            <Route path="team-sheet/:roundId" element={<TeamSheetPage />} />
            <Route path="match-centre/:roundId" element={<MatchCentrePage />} />
            <Route path="selection" element={<TeamSelectionPage />} />
            <Route path="ratings" element={<PlayerRatingsPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="rounds" element={<RoundsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </>
      )}
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TeamProvider>
          <AppRoutes />
        </TeamProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
