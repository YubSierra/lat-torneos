// frontend/src/App.tsx  ← REEMPLAZA COMPLETO
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider }     from './context/AuthContext';
import ProtectedRoute       from './components/ProtectedRoute';
import Login                from './pages/Login';
import Dashboard            from './pages/Dashboard';
import Tournaments          from './pages/Tournaments';
import TournamentDetail     from './pages/TournamentDetail';
import Rankings             from './pages/Rankings';
import Schedule             from './pages/Schedule';
import Courts               from './pages/Courts';
import Players              from './pages/Players';
import Matches              from './pages/Matches';
import Doubles              from './pages/Doubles';
import Users                from './pages/Users';
import LiveMatch            from './pages/LiveMatch';
import MatchScorer          from './pages/MatchScorer';
import MisPagos             from './pages/MisPagos';   // ← NUEVO

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Ruta pública */}
            <Route path="/login" element={<Login />} />

            {/* Dashboard */}
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />

            {/* Torneos */}
            <Route path="/tournaments" element={
              <ProtectedRoute><Tournaments /></ProtectedRoute>
            } />
            <Route path="/tournaments/:id" element={
              <ProtectedRoute><TournamentDetail /></ProtectedRoute>
            } />

            {/* Escalafón */}
            <Route path="/rankings" element={
              <ProtectedRoute><Rankings /></ProtectedRoute>
            } />

            {/* Programación */}
            <Route path="/schedule" element={
              <ProtectedRoute><Schedule /></ProtectedRoute>
            } />

            {/* Canchas */}
            <Route path="/courts" element={
              <ProtectedRoute><Courts /></ProtectedRoute>
            } />

            {/* Jugadores y usuarios */}
            <Route path="/players" element={
              <ProtectedRoute><Players /></ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute><Users /></ProtectedRoute>
            } />

            {/* Partidos */}
            <Route path="/matches" element={
              <ProtectedRoute><Matches /></ProtectedRoute>
            } />

            {/* Dobles */}
            <Route path="/doubles" element={
              <ProtectedRoute><Doubles /></ProtectedRoute>
            } />

            {/* Mis pagos pendientes (jugador) */}
            <Route path="/mis-pagos" element={
              <ProtectedRoute><MisPagos /></ProtectedRoute>
            } />

            {/* Rutas públicas de marcador */}
            <Route path="/live/:matchId"   element={<LiveMatch />}    />
            <Route path="/scorer/:matchId" element={<MatchScorer />}  />

            {/* Redirigir raíz al dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}