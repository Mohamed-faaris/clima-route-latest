const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Helper: Get current logged-in user info from localStorage
export const getCurrentUser = (): { email: string; role: string } => {
  try {
    const stored = localStorage.getItem('clima_user');
    if (stored) {
      const user = JSON.parse(stored);
      return { 
        email: user.email || user.Email || '', 
        role: user.role || user.Role || 'user' 
      };
    }
    const email = localStorage.getItem('userEmail');
    return { email: email || '', role: 'user' };
  } catch {
    return { email: '', role: 'user' };
  }
};

export const apiService = {
  // LOGIN
  login: async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Email: email, Password: password })
      });
      if (!response.ok) throw new Error('Invalid credentials');
      return await response.json(); // { token, user }
    } catch (err) {
      console.error('Login Error:', err);
      throw err;
    }
  },

  // SIGNUP
  signup: async (email: string, name: string, password?: string) => {
    try {
      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Email: email, Name: name, Password: password })
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || 'Signup failed');
      }
      return await response.json(); // { token, user }
    } catch (err) {
      console.error('Signup Error:', err);
      throw err;
    }
  },

  // GET USERS (Admin)
  getUsers: async () => {
    try {
      const response = await fetch(`${API_URL}/users`);
      if (!response.ok) throw new Error('Failed to fetch users');
      return await response.json();
    } catch (err) {
      console.error('GetUsers Error:', err);
      throw err;
    }
  },

  // DELETE USER (Admin)
  deleteUser: async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      return await response.json();
    } catch (err) {
      console.error('DeleteUser Error:', err);
      throw err;
    }
  }
  ,

  // UPDATE USER (Admin)
  updateUser: async (id: number, data: { name?: string; email?: string; phone?: string; password?: string; role?: string; status?: string; vehicleId?: string }) => {
    try {
      // Use POST /users/{id}/update as a reliable fallback for environments where PUT may be blocked
      const response = await fetch(`${API_URL}/users/${id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || 'Failed to update user');
      }
      return await response.json();
    } catch (err) {
      console.error('updateUser Error:', err);
      throw err;
    }
  },

  // DASHBOARD STATS (Admin)
  getDashboardStats: async () => {
    try {
      const response = await fetch(`${API_URL}/admin/stats`);
      if (!response.ok) throw new Error('Failed to load dashboard stats');
      return await response.json();
    } catch (err) {
      console.error('getDashboardStats Error:', err);
      throw err;
    }
  },

  // GET ALERTS (SOS)
  getAlerts: async () => {
    try {
      const response = await fetch(`${API_URL}/alerts`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return await response.json();
    } catch (err) {
      console.error('getAlerts Error:', err);
      throw err;
    }
  },

  // RESOLVE ALERT
  resolveAlert: async (alertId: number) => {
    try {
      const response = await fetch(`${API_URL}/alerts/${alertId}`, { method: 'PUT' });
      if (!response.ok) throw new Error('Failed to resolve alert');
      return await response.json();
    } catch (err) {
      console.error('resolveAlert Error:', err);
      throw err;
    }
  },

  // === NEW DB-DRIVEN SOS SYSTEM ===
  
  // Create SOS Alert (DB-driven)
  createSosAlert: async (data: { driverEmail: string; vehicleId?: string; type: string; location: string }) => {
    try {
      const response = await fetch(`${API_URL}/sos/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          DriverEmail: data.driverEmail,
          VehicleId: data.vehicleId,
          Type: data.type,
          Location: data.location
        })
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || 'Failed to create SOS alert');
      }
      return await response.json();
    } catch (err) {
      console.error('createSosAlert Error:', err);
      throw err;
    }
  },

  // Get active SOS for a driver
  getActiveSos: async (driverEmail: string) => {
    try {
      const response = await fetch(`${API_URL}/sos/active/${encodeURIComponent(driverEmail)}`);
      if (!response.ok) throw new Error('Failed to fetch active SOS');
      return await response.json();
    } catch (err) {
      console.error('getActiveSos Error:', err);
      return { hasActive: false, alert: null };
    }
  },

  // Resolve SOS alert by ID
  resolveSosAlert: async (sosId: number) => {
    try {
      const response = await fetch(`${API_URL}/sos/resolve/${sosId}`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to resolve SOS alert');
      return await response.json();
    } catch (err) {
      console.error('resolveSosAlert Error:', err);
      throw err;
    }
  },

  // Get all SOS alerts (admin)
  getAllSosAlerts: async () => {
    try {
      const response = await fetch(`${API_URL}/sos/all`);
      if (!response.ok) throw new Error('Failed to fetch all SOS alerts');
      return await response.json();
    } catch (err) {
      console.error('getAllSosAlerts Error:', err);
      return [];
    }
  },

  // CREATE SOS ALERT (Legacy - kept for backward compatibility)
  createAlert: async (alertData: { vehicleId?: string; driverEmail?: string; type: string; location: string }) => {
    try {
      const response = await fetch(`${API_URL}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          VehicleId: alertData.vehicleId || 'VEHICLE-001',
          DriverEmail: alertData.driverEmail || localStorage.getItem('userEmail') || 'unknown',
          Type: alertData.type,
          Location: alertData.location
        })
      });
      if (!response.ok) throw new Error('Failed to create alert');
      return await response.json();
    } catch (err) {
      console.error('createAlert Error:', err);
      throw err;
    }
  },

  // FLEET MONITORING - filtered by user
  getFleetLocations: async (userEmail?: string, userRole?: string) => {
    try {
      let url = `${API_URL}/fleet/locations`;
      const params: string[] = [];
      if (userEmail) params.push(`email=${encodeURIComponent(userEmail)}`);
      if (userRole) params.push(`role=${encodeURIComponent(userRole)}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch fleet locations');
      return await response.json();
    } catch (err) {
      console.error('getFleetLocations Error:', err);
      return []; // Return empty array if offline
    }
  },

  // REAL-TIME FLEET WITH ROUTE GEOMETRY - filtered by user
  getFleetRealtime: async (userEmail?: string, userRole?: string) => {
    try {
      let url = `${API_URL}/fleet/realtime`;
      const params: string[] = [];
      if (userEmail) params.push(`email=${encodeURIComponent(userEmail)}`);
      if (userRole) params.push(`role=${encodeURIComponent(userRole)}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch real-time fleet data');
      return await response.json();
    } catch (err) {
      console.error('getFleetRealtime Error:', err);
      return []; // Return empty array if offline
    }
  },

  // ACTIVE FLEET ONLY (InProgress status, deduplicated per driver) - filtered by user
  getActiveFleet: async (userEmail?: string, userRole?: string) => {
    try {
      let url = `${API_URL}/fleet/active`;
      const params: string[] = [];
      if (userEmail) params.push(`email=${encodeURIComponent(userEmail)}`);
      if (userRole) params.push(`role=${encodeURIComponent(userRole)}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch active fleet data');
      return await response.json();
    } catch (err) {
      console.error('getActiveFleet Error:', err);
      return []; // Return empty array if offline
    }
  },

  // UPDATE VEHICLE LOCATION
  updateVehicleLocation: async (tripId: number, latitude: number, longitude: number, speed: number, eta?: string) => {
    try {
      const response = await fetch(`${API_URL}/fleet/update-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ TripId: tripId, Latitude: latitude, Longitude: longitude, Speed: speed, Eta: eta })
      });
      if (!response.ok) throw new Error('Failed to update vehicle location');
      return await response.json();
    } catch (err) {
      console.error('updateVehicleLocation Error:', err);
      return null;
    }
  },

  getFleetRoute: async (routeId: number) => {
    try {
      const response = await fetch(`${API_URL}/fleet/route/${routeId}`);
      if (!response.ok) throw new Error('Failed to fetch route');
      return await response.json();
    } catch (err) {
      console.error('getFleetRoute Error:', err);
      throw err;
    }
  },

  // GET DELIVERY HISTORY - filtered by user
  getHistory: async (userEmail?: string, userRole?: string) => {
    try {
      let url = `${API_URL}/history`;
      const params: string[] = [];
      if (userEmail) params.push(`email=${encodeURIComponent(userEmail)}`);
      if (userRole) params.push(`role=${encodeURIComponent(userRole)}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch history');
      return await response.json();
    } catch (err) {
      console.error('getHistory Error:', err);
      return [];
    }
  },

  // ALIAS: getDeliveryHistory - filtered by user
  getDeliveryHistory: async (userEmail?: string, userRole?: string) => {
    try {
      let url = `${API_URL}/history`;
      const params: string[] = [];
      if (userEmail) params.push(`email=${encodeURIComponent(userEmail)}`);
      if (userRole) params.push(`role=${encodeURIComponent(userRole)}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch history');
      return await response.json();
    } catch (err) {
      console.error('getDeliveryHistory Error:', err);
      return [];
    }
  },

  // SAVE DELIVERY TRIP TO HISTORY
  saveDeliveryTrip: async (tripData: {
    routeId?: string;
    date: string;
    startTime: string;
    endTime: string;
    origin: string;
    destination: string;
    originLat?: number;
    originLon?: number;
    destinationLat?: number;
    destinationLon?: number;
    weather: string;
    weatherCondition: string;
    temperature?: number;
    humidity?: number;
    windSpeed?: number;
    rainProbability?: number;
    safetyScore?: string;
    distance: string;
    duration?: number;
    status: string;
    driverEmail: string;
    notes?: string;
    currentLat?: number;
    currentLon?: number;
    eta?: string;
    speed?: number;
  }) => {
    try {
      const response = await fetch(`${API_URL}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData)
      });
      if (!response.ok) throw new Error('Failed to save delivery trip');
      return await response.json();
    } catch (err) {
      console.error('saveDeliveryTrip Error:', err);
      return null;
    }
  },

  // UPDATE EXISTING HISTORY (real-time telemetry or completion) - with ownership check
  updateHistory: async (id: number, data: { 
    currentLat?: number; 
    currentLon?: number; 
    eta?: string; 
    speed?: number; 
    status?: string;
    tripStatus?: string;
    endTime?: string; 
    completedAt?: string;
    destinationLat?: number; 
    destinationLon?: number;
    weather?: string;
    weatherCondition?: string;
    temperature?: number;
    humidity?: number;
    windSpeed?: number;
    rainProbability?: number;
  }, userEmail?: string, userRole?: string) => {
    try {
      console.log(`Updating history ${id} with:`, data);
      let url = `${API_URL}/history/${id}`;
      const params: string[] = [];
      if (userEmail) params.push(`email=${encodeURIComponent(userEmail)}`);
      if (userRole) params.push(`role=${encodeURIComponent(userRole)}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Update history failed:', response.status, errorText);
        throw new Error('Failed to update history');
      }
      const result = await response.json();
      console.log('Update history result:', result);
      return result;
    } catch (err) {
      console.error('updateHistory Error:', err);
      return null;
    }
  },

  // COMPLETE NAVIGATION - Dedicated endpoint for trip completion (STRICT: InProgress → Completed)
  completeNavigation: async (data: { 
    tripId?: number; 
    navigationId?: number; 
    driverEmail?: string;
    endTime?: string;
    currentLat?: number;
    currentLon?: number;
  }) => {
    try {
      console.log('[API] Completing navigation with:', data);
      const response = await fetch(`${API_URL}/navigation/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('[API] Complete navigation failed:', response.status, result);
        throw new Error(result.error || 'Failed to complete navigation');
      }
      
      console.log('[API] Navigation completed successfully:', result);
      return result;
    } catch (err) {
      console.error('completeNavigation Error:', err);
      throw err;
    }
  },

  // WEATHER: GET CURRENT FORECAST
  getWeatherForecast: async (lat?: number, lon?: number) => {
    try {
      let url = `${API_URL}/weather`;
      if (typeof lat === 'number' && typeof lon === 'number') url = `${url}?lat=${lat}&lon=${lon}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch weather');
      return await response.json();
    } catch (err) {
      console.error('getWeatherForecast Error:', err);
      return null;
    }
  },

  // WEATHER: SAVE WEATHER DATA TO DB
  saveWeather: async (weatherData: {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    rainProbability: number;
    safetyScore: string;
    userEmail?: string;
  }) => {
    try {
      const response = await fetch(`${API_URL}/weather/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weatherData)
      });
      if (!response.ok) throw new Error('Failed to save weather');
      return await response.json();
    } catch (err) {
      console.error('saveWeather Error:', err);
      return null;
    }
  },

  // WEATHER: GET HISTORICAL WEATHER DATA - filtered by user
  getWeatherHistory: async (userEmail?: string, userRole?: string) => {
    try {
      let url = `${API_URL}/weather/history`;
      const params: string[] = [];
      if (userEmail) params.push(`email=${encodeURIComponent(userEmail)}`);
      if (userRole) params.push(`role=${encodeURIComponent(userRole)}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch weather history');
      return await response.json();
    } catch (err) {
      console.error('getWeatherHistory Error:', err);
      return [];
    }
  },

  // Helper: Get actual road geometry from OSRM (with CORS proxy)
  getOSRMRoute: async (startLat: number, startLon: number, endLat: number, endLon: number) => {
    try {
      // Use CORS proxy to avoid browser blocking
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(osrmUrl)}`;
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) throw new Error('OSRM routing failed');
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        // Convert GeoJSON coordinates [lon, lat] to Leaflet format [lat, lon]
        const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        return {
          geometry: coords,
          distance: data.routes[0].distance,
          duration: data.routes[0].duration
        };
      }
      return null;
    } catch (err) {
      console.error('OSRM Error:', err);
      return null;
    }
  },

  // ROUTE OPTIMIZATION: Find multiple shortest paths with weather & safety
  optimizeRoute: async (origin: string, destination: string) => {
    try {
      const response = await fetch(`${API_URL}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Origin: origin, Destination: destination })
      });
      if (!response.ok) throw new Error('Failed to optimize route');
      const data = await response.json();
      
      console.log('Backend response:', data);
      
      // Enhance routes with real road geometry from OSRM
      if (data && data.startCoords && data.endCoords) {
        console.log('Fetching OSRM route...');
        const osrmRoute = await apiService.getOSRMRoute(
          data.startCoords.lat,
          data.startCoords.lon,
          data.endCoords.lat,
          data.endCoords.lon
        );
        
        console.log('OSRM route:', osrmRoute);
        
        if (osrmRoute && osrmRoute.geometry) {
          console.log('Applying OSRM geometry to routes');
          // Apply real geometry to all routes
          if (data.alternatives && data.alternatives.length > 0) {
            data.alternatives = data.alternatives.map((route: any, index: number) => {
              if (index === 0) {
                // Main route uses exact OSRM geometry
                return {
                  ...route,
                  geometry: osrmRoute.geometry,
                  distance: osrmRoute.distance,
                  duration: osrmRoute.duration
                };
              } else {
                // Alternative routes get slight offset
                return {
                  ...route,
                  geometry: osrmRoute.geometry.map((coord: number[]) => [
                    coord[0] + (index * 0.01),
                    coord[1] + (index * 0.01)
                  ]),
                  distance: osrmRoute.distance,
                  duration: osrmRoute.duration
                };
              }
            });
          } else {
            // No alternatives from backend, create one with OSRM data
            data.alternatives = [{
              id: 1,
              safetyScore: data.safetyScore || 75,
              geometry: osrmRoute.geometry,
              distance: osrmRoute.distance,
              duration: osrmRoute.duration,
              condition: data.condition || 'Clear',
              rainProbability: data.rainProbability || 0
            }];
          }
        } else {
          // OSRM route failed, using backend data (this is normal, not an error)
          console.log('Using backend route data');
        }
      }
      
      return data;
    } catch (err) {
      console.error('optimizeRoute Error:', err);
      throw err;
    }
  },

  // NOTIFICATIONS: Create a notification (generic - for admin/system use)
  createNotification: async (title: string, description: string, category: string = 'Info') => {
    try {
      const response = await fetch(`${API_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          description, 
          category,
          timestamp: new Date().toISOString()
        })
      });
      if (!response.ok) throw new Error('Failed to create notification');
      return await response.json();
    } catch (err) {
      console.error('createNotification Error:', err);
      return null;
    }
  },

  // WEATHER ALERT: Create weather-specific notification (only for HEAVY_RAIN or STORM)
  createWeatherAlert: async (severity: 'HEAVY_RAIN' | 'STORM', message: string, userEmail?: string) => {
    try {
      const response = await fetch(`${API_URL}/notifications/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          severity, 
          message,
          userEmail
        })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create weather alert');
      }
      return await response.json();
    } catch (err) {
      console.error('createWeatherAlert Error:', err);
      return null;
    }
  },

  // NOTIFICATIONS: Get all notifications (admin view)
  getNotifications: async () => {
    try {
      const response = await fetch(`${API_URL}/notifications`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return await response.json();
    } catch (err) {
      console.error('getNotifications Error:', err);
      return [];
    }
  },

  // WEATHER ALERTS: Get weather alerts only (user view)
  getWeatherAlerts: async () => {
    try {
      const response = await fetch(`${API_URL}/notifications/weather`);
      if (!response.ok) throw new Error('Failed to fetch weather alerts');
      return await response.json();
    } catch (err) {
      console.error('getWeatherAlerts Error:', err);
      return [];
    }
  },

  // SYSTEM ALERT: Create system status notification (for abnormal status)
  createSystemAlert: async (severity: 'ABNORMAL' | 'SOS' | 'IDLE_ALERT' | 'EMERGENCY', message: string, userEmail?: string) => {
    try {
      const response = await fetch(`${API_URL}/notifications/system`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          severity, 
          message,
          userEmail
        })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create system alert');
      }
      return await response.json();
    } catch (err) {
      console.error('createSystemAlert Error:', err);
      return null;
    }
  },

  // USER ALERTS: Get all user notifications (weather + system) - SECURE: filtered by user
  getUserAlerts: async (userEmail?: string, userRole?: string) => {
    try {
      let url = `${API_URL}/notifications/user`;
      const params: string[] = [];
      if (userEmail) params.push(`email=${encodeURIComponent(userEmail)}`);
      if (userRole) params.push(`role=${encodeURIComponent(userRole)}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch user alerts');
      return await response.json();
    } catch (err) {
      console.error('getUserAlerts Error:', err);
      return [];
    }
  },
  
  // USER SETTINGS: get and update by email (no-auth demo)
  getUserSettings: async (email: string) => {
    try {
      const response = await fetch(`${API_URL}/settings?email=${encodeURIComponent(email)}`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      return await response.json();
    } catch (err) {
      console.error('getUserSettings Error:', err);
      return null;
    }
  },

  updateUserSettings: async (email: string, settings: { TemperatureUnit?: string; DistanceUnit?: string; TimeFormat?: string; Language?: string }) => {
    try {
      const response = await fetch(`${API_URL}/settings?email=${encodeURIComponent(email)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return await response.json();
    } catch (err) {
      console.error('updateUserSettings Error:', err);
      return null;
    }
  },

  // SOS: Update vehicle break mode and status
  updateSosStatus: async (data: { breakModeActive: boolean; location: string; timestamp: string }) => {
    try {
      const response = await fetch(`${API_URL}/sos/update-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update SOS status');
      return await response.json();
    } catch (err) {
      console.error('updateSosStatus Error:', err);
      return null;
    }
  },

  // SOS: Track vehicle movement for idle detection
  trackVehicleMovement: async (data: { location: string; timestamp: string; isMoving: boolean }) => {
    try {
      const response = await fetch(`${API_URL}/sos/track-movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to track movement');
      return await response.json();
    } catch (err) {
      console.error('trackVehicleMovement Error:', err);
      return null;
    }
  },

  // REST POINTS: Find nearby rest points (coffee shops, gas stations, toll plazas)
  getRestPoints: async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(`${API_URL}/rest-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Latitude: latitude, Longitude: longitude })
      });
      if (!response.ok) throw new Error('Failed to fetch rest points');
      return await response.json();
    } catch (err) {
      console.error('getRestPoints Error:', err);
      return { restPoints: [] };
    }
  }
};