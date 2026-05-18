import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { Splash } from './components/Splash';
import { Login } from './pages/Login';

import { Roster } from './pages/Roster';
import { AdminHub } from './pages/AdminHub';
import { EmployeeSchedule } from './pages/EmployeeSchedule';
import Swaps from './pages/Swaps';

const AppContent = () => {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <Splash onComplete={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-deep flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      {user ? (
        <Route element={<Layout />}>
          <Route
            path="/"
            element={
              user.role === 'admin' ? (
                <Navigate to="/admin" replace />
              ) : (
                <Navigate to="/my-schedule" replace />
              )
            }
          />
          <Route path="/roster" element={<Roster />} />
          <Route path="/admin" element={<AdminHub />} />
          <Route path="/my-schedule" element={<EmployeeSchedule />} />
          <Route path="/swaps" element={<Swaps />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
