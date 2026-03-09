// frontend/src/App.tsx  ← REEMPLAZA COMPLETO
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider }       from './context/AuthContext';
import ProtectedRoute         from './components/ProtectedRoute';
import Login                  from './pages/Login';
import Dashboard              from './pages/Dashboard';
import Tournaments            from './pages/Tournaments';
import TournamentDetail       from './pages/TournamentDetail';
import Rankings               from './pages/Rankings';
import Schedule               from './pages/Schedule';
import Courts                 from './pages/Courts';
import Players                from './pages/Players';
import Matches                from './pages/Matches';
import Doubles                from './pages/Doubles';
import Users                  from './pages/Users';
import LiveMatch              from './pages/LiveMatch';
import MatchScorer            from './pages/MatchScorer';
import MisPagos               from './pages/MisPagos';
import PublicTournament       from './pages/PublicTournament';   // ← NUEVO

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* ── Rutas 100% públicas (sin login) ──────────────────────── */}
            <Route path="/login"              element={<Login />} />
            <Route path="/live/:matchId"      element={<LiveMatch />} />
            <Route path="/scorer/:matchId"    element={<MatchScorer />} />

            {/*
             * /torneo          → selector de torneo público
             * /torneo/:tournamentId → vista directa de ese torneo
             * Cualquiera puede ver los partidos, scores y perfiles sin login
             */}
            <Route path="/torneo"                   element={<PublicTournament />} />
            <Route path="/torneo/:tournamentId"     element={<PublicTournament />} />

            {/* ── Rutas protegidas ─────────────────────────────────────── */}
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/tournaments" element={
              <ProtectedRoute><Tournaments /></ProtectedRoute>
            } />
            <Route path="/tournaments/:id" element={
              <ProtectedRoute><TournamentDetail /></ProtectedRoute>
            } />
            <Route path="/rankings" element={
              <ProtectedRoute><Rankings /></ProtectedRoute>
            } />
            <Route path="/schedule" element={
              <ProtectedRoute><Schedule /></ProtectedRoute>
            } />
            <Route path="/courts" element={
              <ProtectedRoute><Courts /></ProtectedRoute>
            } />
            <Route path="/players" element={
              <ProtectedRoute><Players /></ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute><Users /></ProtectedRoute>
            } />
            <Route path="/matches" element={
              <ProtectedRoute><Matches /></ProtectedRoute>
            } />
            <Route path="/doubles" element={
              <ProtectedRoute><Doubles /></ProtectedRoute>
            } />
            <Route path="/mis-pagos" element={
              <ProtectedRoute><MisPagos /></ProtectedRoute>
            } />

            {/* Raíz → dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
