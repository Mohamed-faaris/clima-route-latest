import React, { useState, useEffect } from 'react';
import { Card } from '../components/Layout';
import { 
    CloudRain, CloudLightning, AlertTriangle, Bell, Inbox, ShieldAlert, Timer
} from 'lucide-react';
import { apiService, getCurrentUser } from '../services/apiservice';
import { useSos } from '../contexts/SosContext';

// --- Weather & System Alerts Notification Page ---
export function Notifications() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { sosStatus } = useSos();

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        // SECURE: Pass user credentials for backend filtering
        const { email, role } = getCurrentUser();
        const userAlerts = await apiService.getUserAlerts(email, role);
        setAlerts(Array.isArray(userAlerts) ? userAlerts : []);
      } catch (err) {
        console.error("Failed to load alerts", err);
      } finally {
        setLoading(false);
      }
    };
    loadAlerts();
  }, []);

  // Polling: refresh alerts every 60 seconds - with secure user filtering
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const { email, role } = getCurrentUser();
        const userAlerts = await apiService.getUserAlerts(email, role);
        if (Array.isArray(userAlerts)) setAlerts(userAlerts);
      } catch (e) {
        // ignore polling errors
      }
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // Helper: format timestamp to relative time
  function formatTimestamp(ts: string | undefined) {
    if (!ts) return '';
    const d = Date.parse(ts);
    if (isNaN(d)) return ts;
    const diff = Date.now() - d;
    const sec = Math.floor(diff / 1000);
    if (sec < 10) return 'Just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
  }

  const WeatherAlertCard: React.FC<{ alert: any }> = ({ alert }) => {
    const isStorm = alert.severity === 'STORM';
    
    return (
      <div className={`p-4 rounded-lg shadow-sm mb-4 transition-all hover:shadow-md border-l-4 ${
        isStorm 
          ? 'border-purple-500 bg-purple-50' 
          : 'border-blue-500 bg-blue-50'
      } flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2`}>
        <div className="mt-1">
          {isStorm ? (
            <CloudLightning className="text-purple-600" size={24} />
          ) : (
            <CloudRain className="text-blue-600" size={24} />
          )}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-gray-800">{alert.title}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isStorm 
                  ? 'bg-purple-200 text-purple-800' 
                  : 'bg-blue-200 text-blue-800'
              }`}>
                {alert.severity?.replace('_', ' ')}
              </span>
            </div>
            <span className="text-xs text-gray-500 font-medium">{formatTimestamp(alert.timestamp)}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
        </div>
      </div>
    );
  };

  const SystemAlertCard: React.FC<{ alert: any }> = ({ alert }) => {
    const isSOS = alert.severity === 'SOS' || alert.severity === 'EMERGENCY';
    const isIdle = alert.severity === 'IDLE_ALERT';
    
    const getIcon = () => {
      if (isSOS) return <ShieldAlert className="text-red-600" size={24} />;
      if (isIdle) return <Timer className="text-orange-600" size={24} />;
      return <AlertTriangle className="text-red-600" size={24} />;
    };
    
    const getStyle = () => {
      if (isSOS) return 'border-red-500 bg-red-50';
      if (isIdle) return 'border-orange-500 bg-orange-50';
      return 'border-red-400 bg-red-50';
    };
    
    const getBadgeStyle = () => {
      if (isSOS) return 'bg-red-200 text-red-800';
      if (isIdle) return 'bg-orange-200 text-orange-800';
      return 'bg-red-200 text-red-800';
    };
    
    return (
      <div className={`p-4 rounded-lg shadow-sm mb-4 transition-all hover:shadow-md border-l-4 ${getStyle()} flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2`}>
        <div className="mt-1">{getIcon()}</div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-gray-800">{alert.title}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBadgeStyle()}`}>
                {alert.severity?.replace('_', ' ')}
              </span>
            </div>
            <span className="text-xs text-gray-500 font-medium">{formatTimestamp(alert.timestamp)}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
        </div>
      </div>
    );
  };

  // Render appropriate card based on alert type
  const AlertCard: React.FC<{ alert: any }> = ({ alert }) => {
    if (alert.type === 'WEATHER_ALERT') {
      return <WeatherAlertCard alert={alert} />;
    }
    if (alert.type === 'SYSTEM_ALERT') {
      return <SystemAlertCard alert={alert} />;
    }
    // Fallback for legacy notifications
    return <WeatherAlertCard alert={alert} />;
  };

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Inbox className="text-gray-400" size={40} />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">No Active Alerts</h3>
      <p className="text-sm text-gray-500 max-w-sm">
        You're all clear! There are no weather or system alerts at this time. 
        We'll notify you when severe weather is detected or system status changes.
      </p>
    </div>
  );

  // Separate alerts by type
  const weatherAlerts = alerts.filter(a => a.type === 'WEATHER_ALERT');
  const systemAlerts = alerts.filter(a => a.type === 'SYSTEM_ALERT');

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Bell className="text-blue-600" size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-800">Alerts</h2>
            <p className="text-sm text-slate-500">Weather alerts & system status notifications</p>
          </div>
          {sosStatus === 'Abnormal' && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-full">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-bold text-red-700">System Abnormal</span>
            </div>
          )}
        </div>
      </div>
      
      {loading ? (
        <div className="p-8 text-center text-gray-500 animate-pulse">Checking for alerts...</div>
      ) : alerts.length === 0 ? (
        <Card>
          <EmptyState />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* System Alerts Section */}
          {systemAlerts.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-1 mb-4">
                <h3 className="text-sm font-bold uppercase text-red-600 flex items-center gap-2">
                  <ShieldAlert size={14} />
                  System Alerts ({systemAlerts.length})
                </h3>
              </div>
              {systemAlerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
          
          {/* Weather Alerts Section */}
          {weatherAlerts.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-1 mb-4">
                <h3 className="text-sm font-bold uppercase text-blue-600 flex items-center gap-2">
                  <CloudRain size={14} />
                  Weather Alerts ({weatherAlerts.length})
                </h3>
              </div>
              {weatherAlerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}