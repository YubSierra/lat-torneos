// frontend/src/App.tsx  ← REEMPLAZA COMPLETO
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import Rankings from './pages/Rankings';
import Schedule from './pages/Schedule';
import Courts from './pages/Courts';
import Players from './pages/Players';
import Matches from './pages/Matches';
import Doubles from './pages/Doubles';
import Users from './pages/Users';
import LiveMatch from './pages/LiveMatch';
import MatchScorer from './pages/MatchScorer';
import PublicTournament from './pages/PublicTournament';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* ── Rutas PÚBLICAS ──────────────────────────────── */}
            <Route path="/"       element={<Landing />} />
            <Route path="/inicio" element={<Landing />} />
            <Route path="/login"  element={<Login />} />
            <Route path="/torneo" element={<PublicTournament />} />
            <Route path="/torneo/:tournamentId" element={<PublicTournament />} />
            <Route path="/live/:matchId"   element={<LiveMatch />} />
            <Route path="/scorer/:matchId" element={<MatchScorer />} />

            {/* ── Rutas PROTEGIDAS ─────────────────────────────── */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/tournaments" element={<ProtectedRoute><Tournaments /></ProtectedRoute>} />
            <Route path="/tournaments/:id" element={<ProtectedRoute><TournamentDetail /></ProtectedRoute>} />
            <Route path="/rankings" element={<ProtectedRoute><Rankings /></ProtectedRoute>} />
            <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
            <Route path="/courts" element={<ProtectedRoute><Courts /></ProtectedRoute>} />
            <Route path="/players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
            <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
            <Route path="/doubles" element={<ProtectedRoute><Doubles /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}