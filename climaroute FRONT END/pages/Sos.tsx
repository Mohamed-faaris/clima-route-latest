import React, { useState, useEffect } from 'react';
import { Card, Button } from '../components/Layout';
import { 
    AlertTriangle, Activity, ShieldAlert, Wrench, Truck,
    Clock, Pause, Play, MapPin, Bell, RotateCcw, Navigation
} from 'lucide-react';
import { apiService } from '../services/apiservice';
import { useSos } from '../contexts/SosContext';
import { useAuth } from '../contexts/AuthContext';

export function SOS() {
  const { 
    sosStatus, 
    idleTimeSeconds, 
    breakModeActive, 
    setBreakModeActive,
    navigationActive,
    vehicleStatus,
    triggerSos: triggerGlobalSos,
    resetIdleTimer,
    resolveActiveAlert
  } = useSos();
  const { user } = useAuth();

  const [currentGpsLocation, setCurrentGpsLocation] = useState<[number, number] | null>(null);
  const [currentLocationName, setCurrentLocationName] = useState<string>("GPS Inactive");
  const [loading, setLoading] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [userVehicleId, setUserVehicleId] = useState<string>('');

  const IDLE_THRESHOLD = 15 * 60; // 15 minutes in seconds

  // Helper: Get location name from coordinates (NEVER returns raw coordinates)
  const getLocationName = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=en`);
      const data = await response.json();
      const addr = data.address;
      const area = addr.suburb || addr.neighbourhood || addr.hamlet;
      const city = addr.city || addr.town || addr.village || addr.county;
      const state = addr.state;
      if (area && city) return `${area}, ${city}`;
      if (city && state) return `${city}, ${state}`;
      if (city) return city;
      if (state) return state;
      return "Location unavailable";
    } catch (e) {
      return "Location unavailable";
    }
  };

  // Sync GPS location from localStorage (set by ReRouting page)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const userPosStr = localStorage.getItem('climaRoute_userPosition');
      if (userPosStr) {
        try {
          const pos = JSON.parse(userPosStr);
          const newPos: [number, number] = [pos[0], pos[1]];
          setCurrentGpsLocation(newPos);
          getLocationName(newPos[0], newPos[1]).then(name => setCurrentLocationName(name));
        } catch (e) {
          console.error('Error parsing user position', e);
        }
      } else if (!navigationActive) {
        setCurrentLocationName("GPS Inactive");
      }
    }, 2000);

    return () => clearInterval(syncInterval);
  }, [navigationActive]);

  // Toggle break mode - ONLY when navigation is active
  const toggleBreakMode = async () => {
    if (!navigationActive) return; // Block if navigation not active
    
    const newBreakMode = !breakModeActive;
    setBreakModeActive(newBreakMode);

    try {
      await apiService.updateSosStatus({
        breakModeActive: newBreakMode,
        location: currentGpsLocation ? `${currentGpsLocation[0]},${currentGpsLocation[1]}` : "Unknown",
        timestamp: new Date().toISOString()
      });

      await apiService.createNotification(
        newBreakMode ? "Break Mode Started" : "Break Mode Ended",
        `Driver ${newBreakMode ? 'started' : 'ended'} break. Idle timer ${newBreakMode ? 'paused' : 'resumed'}.`,
        "Info"
      );
    } catch (err) {
      console.error("Break mode toggle failed:", err);
    }
  };

  // Resume navigation - reset timer
  const handleResume = () => {
    resolveActiveAlert();
    resetIdleTimer();
  };

  // Load user's vehicleId from database
  useEffect(() => {
    const loadUserVehicleId = async () => {
      if (!user?.email) return;
      try {
        const users: any = await apiService.getUsers();
        const currentUser = users?.find((u: any) => u.email === user.email);
        if (currentUser?.vehicleId) {
          setUserVehicleId(currentUser.vehicleId);
        }
      } catch (e) {
        console.error('Failed to load user vehicleId', e);
      }
    };
    loadUserVehicleId();
  }, [user?.email]);

  // Trigger SOS alert - Now uses DB-driven system via context
  // ONLY allowed when navigation is active
  const handleTriggerSOS = async (type: string) => {
    if (!navigationActive) {
      alert("SOS is disabled. Please start navigation first from the Dynamic Re-Route page.");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to trigger a ${type} alert?`)) return;

    setLoading(true);
    try {
      // Use the context's triggerSos which creates alert in DB
      const success = await triggerGlobalSos(type, currentLocationName, userVehicleId || undefined);
      
      if (success) {
        // Also create notification for admin
        const userName = user?.name || 'Driver';
        const userEmail = user?.email || 'unknown';
        const timestamp = new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        
        await apiService.createNotification(
          `🚨 SOS Alert: ${type}`,
          `${userName} (${userEmail}) - Vehicle: ${userVehicleId || 'Unknown'} triggered ${type} emergency at ${currentLocationName}. Time: ${timestamp}`,
          "Emergency"
        );

        setSosActive(true);
        setTimeout(() => setSosActive(false), 5000);
        alert("SOS Signal Sent! Help is on the way.");
      } else {
        alert("Failed to send SOS signal. You may already have an active alert.");
      }
    } catch (err) {
      console.error("SOS Error:", err);
      alert("Failed to send SOS signal.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const SOSButton = ({ icon: Icon, label, desc }: any) => (
    <button
      onClick={() => handleTriggerSOS(label)}
      disabled={loading || !navigationActive}
      className={`flex flex-col items-center justify-center p-6 border rounded-xl shadow-sm transition-all group h-full ${
        !navigationActive 
          ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed' 
          : 'bg-white border-gray-200 hover:shadow-md hover:border-red-300 hover:bg-red-50'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
        !navigationActive 
          ? 'bg-gray-200 text-gray-400' 
          : 'bg-red-100 text-red-600 group-hover:bg-red-200'
      }`}>
        <Icon size={32} />
      </div>
      <h3 className={`text-lg font-bold mb-1 ${!navigationActive ? 'text-gray-400' : 'text-gray-800'}`}>{label}</h3>
      <p className="text-xs text-gray-500 text-center">{desc}</p>
      {!navigationActive && <p className="text-xs text-orange-500 mt-2">Start navigation first</p>}
    </button>
  );

  // Get display text for vehicle status
  const getVehicleStatusDisplay = () => {
    switch (vehicleStatus) {
      case 'NavigationInactive': return 'Nav. Inactive';
      case 'Moving': return 'Moving';
      case 'Stopped': return 'Stopped';
      default: return 'Unknown';
    }
  };

  const getVehicleStatusColor = () => {
    switch (vehicleStatus) {
      case 'NavigationInactive': return 'bg-gray-100 text-gray-600';
      case 'Moving': return 'bg-green-100 text-green-800';
      case 'Stopped': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getVehicleDotColor = () => {
    switch (vehicleStatus) {
      case 'NavigationInactive': return 'bg-gray-500';
      case 'Moving': return 'bg-green-600 animate-pulse';
      case 'Stopped': return 'bg-orange-600';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex-shrink-0">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="text-red-600"/> SOS & Vehicle Monitoring
        </h2>
        <p className="text-sm text-slate-500 mt-1">Emergency alerts and real-time vehicle diagnostics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-auto">
        
        {/* LEFT SIDE: Idle Tracking & Break Mode */}
        <Card className="lg:col-span-1 space-y-4 border-l-4 border-red-500 h-fit max-h-full overflow-auto">
          
          {/* Navigation Status Banner - Shows when navigation is INACTIVE */}
          {!navigationActive && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2">
              <Navigation size={16} className="text-orange-600" />
              <span className="text-sm font-bold text-orange-700">Start navigation to enable SOS monitoring</span>
            </div>
          )}
          
          {/* Navigation & Vehicle Status - Combined Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Navigation</label>
              <div className={`p-2 rounded-lg flex items-center gap-2 ${navigationActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${navigationActive ? 'bg-green-600 animate-pulse' : 'bg-gray-600'}`}></span>
                <span className="font-bold text-xs">{navigationActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Vehicle</label>
              <div className={`p-2 rounded-lg flex items-center gap-2 ${getVehicleStatusColor()}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${getVehicleDotColor()}`}></span>
                <span className="font-bold text-xs">{getVehicleStatusDisplay()}</span>
              </div>
            </div>
          </div>

          {/* GPS Location */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
              <MapPin size={12} className="inline mr-1" /> Current Location
            </label>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm font-bold text-gray-800">{currentLocationName || "Fetching location..."}</div>
              <div className="text-xs text-blue-600 mt-1">
                {currentGpsLocation 
                  ? "📍 GPS Active"
                  : "GPS Inactive"
                }
              </div>
            </div>
          </div>

          {/* Idle Time Display */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
              <Clock size={12} className="inline mr-1" /> Idle Duration
            </label>
            <div className={`p-3 rounded-lg text-center font-mono text-2xl font-bold ${
              !navigationActive
                ? 'bg-gray-50 text-gray-400'
                : idleTimeSeconds >= IDLE_THRESHOLD 
                  ? 'bg-red-50 text-red-600' 
                  : idleTimeSeconds > 0 
                    ? 'bg-orange-50 text-orange-600' 
                    : 'bg-gray-50 text-gray-800'
            }`}>
              {!navigationActive ? '--:--' : formatTime(idleTimeSeconds)}
            </div>
            {!navigationActive && (
              <p className="text-xs text-gray-500 mt-1 text-center">
                Timer starts when navigation active & vehicle stopped
              </p>
            )}
            {navigationActive && idleTimeSeconds >= IDLE_THRESHOLD && (
              <p className="text-xs text-red-600 font-bold mt-1 text-center animate-pulse">
                ⚠️ Idle timeout exceeded
              </p>
            )}
          </div>

          {/* Resume Button - shows when idle timer is counting and there's time */}
          {navigationActive && vehicleStatus === 'Stopped' && idleTimeSeconds > 0 && (
            <button
              onClick={handleResume}
              className="w-full p-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2 bg-green-100 text-green-800 border border-green-300 hover:bg-green-200 text-sm"
            >
              <RotateCcw size={14} /> Resume / Reset Timer
            </button>
          )}

          {/* Break Mode Toggle */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
              <Pause size={12} className="inline mr-1" /> Break Mode
            </label>
            <button
              onClick={toggleBreakMode}
              disabled={!navigationActive}
              className={`w-full p-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-sm ${
                !navigationActive
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : breakModeActive
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                    : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-yellow-50'
              }`}
            >
              {!navigationActive ? (
                <>
                  <Pause size={14} /> Break Disabled
                </>
              ) : breakModeActive ? (
                <>
                  <Pause size={14} /> Break Active
                </>
              ) : (
                <>
                  <Play size={14} /> Start Break
                </>
              )}
            </button>
            {!navigationActive && (
              <p className="text-xs text-gray-400 mt-1 text-center">Start navigation to enable</p>
            )}
          </div>
        </Card>

        {/* RIGHT SIDE: SOS Buttons */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4 h-fit">
          <SOSButton
            icon={Activity}
            label="Health Issue"
            desc="Driver incapacitated or medical emergency."
          />
          <SOSButton
            icon={ShieldAlert}
            label="Theft/Security"
            desc="Cargo theft or security breach."
          />
          <SOSButton
            icon={Wrench}
            label="Breakdown"
            desc="Engine failure, flat tire, or mechanical issue."
          />
          <SOSButton
            icon={Truck}
            label="Road Accident"
            desc="Collision or vehicle damage."
          />
        </div>
      </div>

      {/* SOS Active Indicator */}
      {sosActive && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-pulse z-50">
          <Bell size={20} />
          <span className="font-bold">SOS Signal Sent!</span>
        </div>
      )}
    </div>
  );
}