import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context.tsx';
import { Layout } from './components/Layout.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { ServicesCatalogPage } from './pages/ServicesCatalogPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { NewRequestPage } from './pages/NewRequestPage.tsx';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage.tsx';
import { RequestDetailPage } from './pages/RequestDetailPage.tsx';
import { ResponderDashboardPage } from './pages/ResponderDashboardPage.tsx';
import { SupportCenterPage } from './pages/SupportCenterPage.tsx';
import { OperatorPanelPage } from './pages/OperatorPanelPage.tsx';
import { AdminPanelPage } from './pages/AdminPanelPage.tsx';
import { PublicTrackAndLegalPage } from './pages/PublicTrackAndLegalPage.tsx';

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm text-slate-600 font-bold">
        در حال بررسی نشست امنیتی کاربر...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <div className="bg-rose-50 border border-rose-200 text-rose-950 p-6 rounded-2xl">
          <h1 className="font-extrabold text-base mb-1">عدم مجوز دسترسی (۴۰۳)</h1>
          <p className="text-xs leading-relaxed">
            نقش کاربری شما ({user.role}) مجوز دسترسی به این بخش را ندارد. کنترل دسترسی در
            سمت سرور نیز اعمال شده است.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/services" element={<ServicesCatalogPage />} />
            <Route path="/track" element={<PublicTrackAndLegalPage />} />
            <Route path="/legal" element={<PublicTrackAndLegalPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/support" element={<SupportCenterPage />} />
            <Route path="/request/new" element={<NewRequestPage />} />

            <Route
              path="/customer"
              element={
                <ProtectedRoute allowedRoles={['customer', 'admin']}>
                  <CustomerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/:id"
              element={
                <ProtectedRoute>
                  <RequestDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/missions/:id/track"
              element={
                <ProtectedRoute>
                  <RequestDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/responder/*"
              element={
                <ProtectedRoute allowedRoles={['responder', 'admin']}>
                  <ResponderDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator"
              element={
                <ProtectedRoute allowedRoles={['operator', 'admin']}>
                  <OperatorPanelPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPanelPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/:section"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPanelPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}
