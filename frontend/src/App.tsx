import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import Rankings from './pages/Rankings';
import Schedule from './pages/Schedule';
import Courts from './pages/Courts';
import Players from './pages/Players';
import Matches from './pages/Matches';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Ruta pública */}
            <Route path="/login" element={<Login />} />

            {/* Rutas protegidas */}
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
            <Route path="/matches" element={
            <ProtectedRoute><Matches /></ProtectedRoute>
            } />

            {/* Redirigir raíz al dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}