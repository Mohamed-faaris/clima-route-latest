import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/apiservice';
import { useAuth } from './AuthContext';

type SosStatus = 'Normal' | 'Abnormal';
type VehicleStatus = 'NavigationInactive' | 'Moving' | 'Stopped';

interface ActiveAlert {
  id: number;
  vehicleId: string;
  driverEmail: string;
  driverName: string;
  type: string;
  location: string;
  isActive: boolean;
  createdAt: string;
}

interface SosContextType {
  // Status
  sosStatus: SosStatus;
  activeAlert: ActiveAlert | null;
  navigationActive: boolean;
  vehicleStatus: VehicleStatus;
  
  // Idle tracking
  idleTimeSeconds: number;
  idleAlertSent: boolean;
  
  // Break mode
  breakModeActive: boolean;
  setBreakModeActive: (active: boolean) => void;
  
  // Actions
  triggerSos: (type: string, location: string, vehicleId?: string) => Promise<boolean>;
  resetIdleTimer: () => void;
  resolveActiveAlert: () => Promise<boolean>;
  refreshSosStatus: () => Promise<void>;
}

const SosContext = createContext<SosContextType | undefined>(undefined);

const IDLE_THRESHOLD = 15 * 60; // 15 minutes in seconds
const POLL_INTERVAL = 3000; // Poll every 3 seconds
const DISTANCE_THRESHOLD = 10; // Meters - if moved <10m, consider stopped

export const SosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // Core state
  const [sosStatus, setSosStatus] = useState<SosStatus>('Normal');
  const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
  const [navigationActive, setNavigationActive] = useState(false);
  const [vehicleStatus, setVehicleStatus] = useState<VehicleStatus>('NavigationInactive');
  
  // Idle tracking
  const [idleTimeSeconds, setIdleTimeSeconds] = useState(0);
  const [idleAlertSent, setIdleAlertSent] = useState(false);
  
  // Break mode
  const [breakModeActive, setBreakModeActive] = useState(false);
  
  // Position tracking refs
  const lastPositionRef = useRef<[number, number] | null>(null);
  const stoppedCountRef = useRef(0);

  // === Load break mode from localStorage on mount ===
  useEffect(() => {
    const savedBreakMode = localStorage.getItem('climaRoute_breakMode') === 'true';
    setBreakModeActive(savedBreakMode);
  }, []);

  // === Poll backend for active SOS status ===
  const refreshSosStatus = useCallback(async () => {
    if (!user?.email) return;
    
    try {
      const result = await apiService.getActiveSos(user.email);
      
      if (result.hasActive && result.alert) {
        setActiveAlert(result.alert);
        setSosStatus('Abnormal');
      } else {
        setActiveAlert(null);
        // Only set Normal if no idle threshold exceeded
        if (idleTimeSeconds < IDLE_THRESHOLD || !navigationActive) {
          setSosStatus('Normal');
        }
      }
    } catch (err) {
      console.error('Failed to refresh SOS status:', err);
    }
  }, [user?.email, idleTimeSeconds, navigationActive]);

  // Poll backend continuously for SOS status
  useEffect(() => {
    if (!user?.email) return;
    
    refreshSosStatus();
    const interval = setInterval(refreshSosStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [user?.email, refreshSosStatus]);

  // === MASTER LOGIC: Navigation state controls everything ===
  useEffect(() => {
    const checkNavigationAndMovement = () => {
      // Check navigation status from ReRouting page
      const navActive = localStorage.getItem('climaRoute_navigation_active') === '1';
      setNavigationActive(navActive);
      
      // If navigation is NOT active, reset everything
      if (!navActive) {
        setVehicleStatus('NavigationInactive');
        setIdleTimeSeconds(0);
        setIdleAlertSent(false);
        stoppedCountRef.current = 0;
        lastPositionRef.current = null;
        return;
      }
      
      // Navigation IS active - check vehicle movement
      const userPosStr = localStorage.getItem('climaRoute_userPosition');
      if (!userPosStr) {
        // No GPS data yet
        setVehicleStatus('Stopped');
        return;
      }
      
      try {
        const pos = JSON.parse(userPosStr);
        const currentPos: [number, number] = [pos[0], pos[1]];
        
        if (lastPositionRef.current) {
          const distance = calculateDistance(
            lastPositionRef.current[0],
            lastPositionRef.current[1],
            currentPos[0],
            currentPos[1]
          );
          
          if (distance < DISTANCE_THRESHOLD) {
            // Vehicle hasn't moved significantly
            stoppedCountRef.current += 1;
            if (stoppedCountRef.current >= 3) { // 3 seconds of being stopped
              setVehicleStatus('Stopped');
            }
          } else {
            // Vehicle is moving
            stoppedCountRef.current = 0;
            setVehicleStatus('Moving');
            // Reset idle timer when moving
            setIdleTimeSeconds(0);
            setIdleAlertSent(false);
          }
        } else {
          // First position reading - assume moving
          setVehicleStatus('Moving');
        }
        
        lastPositionRef.current = currentPos;
      } catch (e) {
        console.error('Error parsing position:', e);
      }
    };

    const interval = setInterval(checkNavigationAndMovement, 1000);
    return () => clearInterval(interval);
  }, []);

  // === IDLE TIMER LOGIC ===
  useEffect(() => {
    const idleInterval = setInterval(() => {
      // ONLY count idle if:
      // 1. Navigation is ACTIVE
      // 2. Vehicle is STOPPED
      // 3. Break mode is NOT active
      if (navigationActive && vehicleStatus === 'Stopped' && !breakModeActive) {
        setIdleTimeSeconds(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(idleInterval);
  }, [navigationActive, vehicleStatus, breakModeActive]);

  // === IDLE ALERT: Send notification when threshold exceeded ===
  useEffect(() => {
    const sendIdleAlert = async () => {
      if (
        idleTimeSeconds >= IDLE_THRESHOLD && 
        !idleAlertSent && 
        navigationActive && 
        vehicleStatus === 'Stopped' &&
        !breakModeActive &&
        user?.email
      ) {
        setIdleAlertSent(true);
        setSosStatus('Abnormal');
        
        try {
          // Get current location for alert
          const userPosStr = localStorage.getItem('climaRoute_userPosition');
          let locationStr = 'Unknown location';
          if (userPosStr) {
            const pos = JSON.parse(userPosStr);
            locationStr = `${pos[0].toFixed(4)}, ${pos[1].toFixed(4)}`;
          }
          
          // Create SYSTEM alert for idle detection
          await apiService.createSystemAlert(
            'IDLE_ALERT',
            `Vehicle has been stationary for ${Math.round(idleTimeSeconds / 60)} minutes at ${locationStr}. Driver: ${user.name || user.email}`,
            user.email
          );
          
          console.log('Idle system alert sent');
        } catch (err) {
          console.error('Failed to send idle alert:', err);
        }
      }
    };

    sendIdleAlert();
  }, [idleTimeSeconds, idleAlertSent, navigationActive, vehicleStatus, breakModeActive, user]);

  // === Update SOS status based on idle threshold ===
  useEffect(() => {
    if (!activeAlert && idleTimeSeconds >= IDLE_THRESHOLD && navigationActive) {
      setSosStatus('Abnormal');
    } else if (!activeAlert && (idleTimeSeconds < IDLE_THRESHOLD || !navigationActive)) {
      setSosStatus('Normal');
    }
  }, [activeAlert, idleTimeSeconds, navigationActive]);

  // Helper: Calculate distance between two coordinates (Haversine)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // === TRIGGER SOS: Creates alert in DB ===
  const triggerSos = async (type: string, location: string, vehicleId?: string): Promise<boolean> => {
    // ONLY allow SOS if navigation is active
    if (!user?.email || !navigationActive) return false;
    
    try {
      const result = await apiService.createSosAlert({
        driverEmail: user.email,
        vehicleId: vehicleId,
        type: type,
        location: location
      });
      
      if (result.success) {
        // Also create a system alert for the SOS
        await apiService.createSystemAlert(
          'SOS',
          `🚨 SOS Alert triggered! Type: ${type}. Location: ${location}. Driver: ${user.name || user.email}`,
          user.email
        );
        
        await refreshSosStatus();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to trigger SOS:', err);
      return false;
    }
  };

  // === RESOLVE ALERT: Updates DB ===
  const resolveActiveAlert = async (): Promise<boolean> => {
    if (!activeAlert) {
      if (user?.email) {
        try {
          const result = await apiService.getActiveSos(user.email);
          if (result.hasActive && result.alert) {
            await apiService.resolveSosAlert(result.alert.id);
            setActiveAlert(null);
            setSosStatus('Normal');
            setIdleTimeSeconds(0);
            setIdleAlertSent(false);
            return true;
          }
        } catch (err) {
          console.error('Failed to resolve alert:', err);
        }
      }
      return false;
    }
    
    try {
      const result = await apiService.resolveSosAlert(activeAlert.id);
      
      if (result.success) {
        setActiveAlert(null);
        setSosStatus('Normal');
        setIdleTimeSeconds(0);
        setIdleAlertSent(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to resolve alert:', err);
      return false;
    }
  };

  const resetIdleTimer = () => {
    setIdleTimeSeconds(0);
    setIdleAlertSent(false);
    if (!activeAlert) {
      setSosStatus('Normal');
    }
  };

  const handleSetBreakModeActive = (active: boolean) => {
    // ONLY allow break mode if navigation is active
    if (!navigationActive && active) return;
    
    setBreakModeActive(active);
    localStorage.setItem('climaRoute_breakMode', active.toString());
    if (active) {
      // Reset idle timer when break mode starts
      setIdleTimeSeconds(0);
      setIdleAlertSent(false);
    }
  };

  return (
    <SosContext.Provider value={{ 
      sosStatus, 
      activeAlert,
      navigationActive,
      vehicleStatus,
      idleTimeSeconds,
      idleAlertSent,
      breakModeActive, 
      setBreakModeActive: handleSetBreakModeActive,
      triggerSos,
      resetIdleTimer,
      resolveActiveAlert,
      refreshSosStatus
    }}>
      {children}
    </SosContext.Provider>
  );
};

export const useSos = () => {
  const context = useContext(SosContext);
  if (!context) throw new Error('useSos must be used within SosProvider');
  return context;
};
