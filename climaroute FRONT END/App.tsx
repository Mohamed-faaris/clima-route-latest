
import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminLayout } from './components/AdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { BackgroundProvider } from './contexts/BackgroundContext';
import { SosProvider } from './contexts/SosContext';
import Login from './pages/Auth';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import { ReRouting} from './pages/ReRouting';
import { History } from './pages/History';
import  AdaptiveSpeed from './pages/AdaptiveSpeed';
import { Weather } from './pages/WeatherPrediction';
import { Notifications } from './pages/Notifications';
import { ETACalculator } from './pages/ETAcalc';
import { RestPoint } from './pages/RestPoint';
import { SOS } from './pages/Sos';    
import Settings from './pages/Settings';
import Health from './pages/Health';


import AdminDashboard from './pages/admin/AdminDashboard';
import ManageUsers from './pages/admin/ManageUsers';
import FleetLiveMonitor from './pages/admin/FleetLiveMonitor';
import RouteLogs from './pages/admin/RouteLogs';
import EmergencyAlerts from './pages/admin/EmergencyAlerts';

// Simple wrapper to render outlet content within the main Layout
const OutletWrapper = () => <Outlet />;

import { NotificationProvider } from './contexts/NotificationContext';

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BackgroundProvider>
          <SosProvider>
            <NotificationProvider>
              <HashRouter>
                <Routes>
          {/* Public / Auth Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/health" element={<Health />} />
          
          {/* Driver App Routes */}
          <Route element={<Layout><OutletWrapper /></Layout>}>
            <Route path="/dashboard" element={<ProtectedRoute roleRequired="user"><Dashboard /></ProtectedRoute>} />
            <Route path="/re-routing" element={<ProtectedRoute roleRequired="user"><ReRouting /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute roleRequired="user"><History /></ProtectedRoute>} />
            <Route path="/adaptive-speed" element={<ProtectedRoute roleRequired="user"><AdaptiveSpeed /></ProtectedRoute>} />
            <Route path="/weather" element={<ProtectedRoute roleRequired="user"><Weather /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute roleRequired="user"><Notifications /></ProtectedRoute>} />
            <Route path="/eta" element={<ProtectedRoute roleRequired="user"><ETACalculator /></ProtectedRoute>} />
            <Route path="/rest-point" element={<ProtectedRoute roleRequired="user"><RestPoint /></ProtectedRoute>} />
            <Route path="/sos" element={<ProtectedRoute roleRequired="user"><SOS /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute roleRequired="user"><Settings /></ProtectedRoute>} />
          </Route>

           {/* Admin Protected Routes */}
           <Route path="/admin" element={<ProtectedRoute roleRequired="admin"><AdminLayout /></ProtectedRoute>}>
             <Route index element={<Navigate to="/admin/dashboard" replace />} />
             <Route path="dashboard" element={<AdminDashboard />} />
             <Route path="users" element={<ManageUsers />} />
             <Route path="fleet" element={<FleetLiveMonitor />} />
             <Route path="logs" element={<RouteLogs />} />
             <Route path="alerts" element={<EmergencyAlerts />} />
           </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
              </HashRouter>
            </NotificationProvider>
          </SosProvider>
        </BackgroundProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
