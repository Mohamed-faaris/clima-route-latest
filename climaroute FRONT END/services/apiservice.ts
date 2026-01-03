// <reference types="vite/client" />

import logger from '../src/utils/logger';

// Determine API URL - prioritize relative path for Docker/Nginx deployment
const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;

  logger.debug('[getApiUrl] entry', { envUrl });

  // If running in browser and VITE_API_URL is a full external URL with different host,
  // use it as-is. Otherwise, use relative path for Nginx proxy.
  if (envUrl) {
    try {
      const envUrlObj = new URL(envUrl);
      const currentHost = window.location.hostname;
      logger.debug('[getApiUrl] parsed env URL', { href: envUrlObj.href, hostname: envUrlObj.hostname, currentHost });

      // If the API URL hostname is different from current host, use full URL
      if (envUrlObj.hostname !== currentHost && envUrlObj.hostname !== 'localhost' && envUrlObj.hostname !== '127.0.0.1') {
        logger.info('[getApiUrl] using external API URL', { apiUrl: envUrl });
        return envUrl;
      }

      logger.debug('[getApiUrl] env URL hostname matches current host or is localhost; will use relative path');
    } catch (e) {
      // If it's not a valid URL, it might be a relative path
      logger.warn('[getApiUrl] VITE_API_URL is not an absolute URL; treating as relative', { envUrl, error: (e as Error).message });
      if (envUrl.startsWith('/')) {
        logger.info('[getApiUrl] using relative VITE_API_URL', { apiPath: envUrl });
        return envUrl;
      }
    }
  } else {
    logger.debug('[getApiUrl] VITE_API_URL not provided; falling back to default');
  }

  // Default: use relative path for Nginx proxy
  logger.info('[getApiUrl] defaulting to /api (Nginx proxy)');
  return '/api';
};

const API_URL = getApiUrl();

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

const BASE_URL = API_URL;

export const apiService = {
  get: async (url: string) => {
    try {
      const fullUrl = `${BASE_URL}${url.startsWith('/') ? url : '/' + url}`;
      logger.apiRequest('GET', fullUrl);
      const response = await fetch(fullUrl);
      if (!response.ok) {
        logger.apiError('GET', fullUrl, { status: response.status });
        throw new Error('Network response was not ok');
      }
      const result = await response.json();
      logger.apiSuccess('GET', fullUrl);
      return result;
    } catch (err) {
      logger.apiError('GET', fullUrl, err);
      throw err;
    }
  },

  // LOGIN
  login: async (email: string, password: string) => {
    try {
      logger.info('[API] login: Starting request', { email, url: `${API_URL}/login` });
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Email: email, Password: password })
      });
      if (!response.ok) {
        logger.error('[API] login: Failed', { status: response.status, statusText: response.statusText });
        throw new Error('Invalid credentials');
      }
      const result = await response.json();
      logger.info('[API] login: Success', { email });
      return result; // { token, user }
    } catch (err) {
      logger.error('[API] login: Error', err);
      throw err;
    }
  },

  // SIGNUP
  signup: async (email: string, name: string, password?: string) => {
    try {
      logger.info('[API] signup: Starting request', { email, name, url: `${API_URL}/signup` });
      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Email: email, Name: name, Password: password })
      });
      if (!response.ok) {
        const txt = await response.text();
        logger.error('[API] signup: Failed', { status: response.status, error: txt });
        throw new Error(txt || 'Signup failed');
      }
      const result = await response.json();
      logger.info('[API] signup: Success', { email });
      return result; // { token, user }
    } catch (err) {
      logger.error('[API] signup: Error', err);
      throw err;
    }
  },

  // GET USERS (Admin)
  getUsers: async () => {
    try {
      logger.info('[API] getUsers: Starting request', { url: `${API_URL}/users` });
      const response = await fetch(`${API_URL}/users`);
      if (!response.ok) {
        logger.error('[API] getUsers: Failed', { status: response.status });
        throw new Error('Failed to fetch users');
      }
      const result = await response.json();
      logger.info('[API] getUsers: Success', { count: result.length });
      return result;
    } catch (err) {
      logger.error('[API] getUsers: Error', err);
      throw err;
    }
  },

  // DELETE USER (Admin) - FULL CLEANUP
  deleteUser: async (id: number, email?: string) => {
    try {
      // Always call cleanup endpoint to remove all user data
      if (!email) throw new Error('User email required for full cleanup');
      logger.info('[API] deleteUser: Starting request', { id, email, url: `${API_URL}/users/cleanup/${encodeURIComponent(email)}` });
      const response = await fetch(`${API_URL}/users/cleanup/${encodeURIComponent(email)}`, { method: 'DELETE' });
      if (!response.ok) {
        logger.error('[API] deleteUser: Failed', { status: response.status });
        throw new Error('Failed to delete user and all data');
      }
      const result = await response.json();
      logger.info('[API] deleteUser: Success', { id, email });
      return result;
    } catch (err) {
      logger.error('[API] deleteUser: Error', err);
      throw err;
    }
  }
  ,

  // UPDATE USER (Admin)
  updateUser: async (id: number, data: { name?: string; email?: string; phone?: string; password?: string; role?: string; status?: string; vehicleId?: string }) => {
    try {
      logger.info('[API] updateUser: Starting request', { id, data, url: `${API_URL}/users/${id}/update` });
      // Use POST /users/{id}/update as a reliable fallback for environments where PUT may be blocked
      const response = await fetch(`${API_URL}/users/${id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const txt = await response.text();
        logger.error('[API] updateUser: Failed', { status: response.status, error: txt });
        throw new Error(txt || 'Failed to update user');
      }
      const result = await response.json();
      logger.info('[API] updateUser: Success', { id });
      return result;
    } catch (err) {
      logger.error('[API] updateUser: Error', err);
      throw err;
    }
  },

  // DASHBOARD STATS (Admin)
  getDashboardStats: async () => {
    try {
      logger.info('[API] getDashboardStats: Starting request', { url: `${API_URL}/admin/stats` });
      const response = await fetch(`${API_URL}/admin/stats`);
      if (!response.ok) {
        logger.error('[API] getDashboardStats: Failed', { status: response.status });
        throw new Error('Failed to load dashboard stats');
      }
      const result = await response.json();
      logger.info('[API] getDashboardStats: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] getDashboardStats: Error', err);
      throw err;
    }
  },

  // GET ALERTS (SOS)
  getAlerts: async () => {
    try {
      logger.info('[API] getAlerts: Starting request', { url: `${API_URL}/alerts` });
      const response = await fetch(`${API_URL}/alerts`);
      if (!response.ok) {
        logger.error('[API] getAlerts: Failed', { status: response.status });
        throw new Error('Failed to fetch alerts');
      }
      const result = await response.json();
      logger.info('[API] getAlerts: Success', { count: result.length });
      return result;
    } catch (err) {
      logger.error('[API] getAlerts: Error', err);
      throw err;
    }
  },

  // RESOLVE ALERT
  resolveAlert: async (alertId: number) => {
    try {
      logger.info('[API] resolveAlert: Starting request', { alertId, url: `${API_URL}/alerts/${alertId}` });
      const response = await fetch(`${API_URL}/alerts/${alertId}`, { method: 'PUT' });
      if (!response.ok) {
        logger.error('[API] resolveAlert: Failed', { status: response.status, alertId });
        throw new Error('Failed to resolve alert');
      }
      const result = await response.json();
      logger.info('[API] resolveAlert: Success', { alertId });
      return result;
    } catch (err) {
      logger.error('[API] resolveAlert: Error', err);
      throw err;
    }
  },

  // === NEW DB-DRIVEN SOS SYSTEM ===

  // Create SOS Alert (DB-driven)
  createSosAlert: async (data: { driverEmail: string; vehicleId?: string; type: string; location: string }) => {
    try {
      logger.info('[API] createSosAlert: Starting request', { data, url: `${API_URL}/sos/create` });
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
        logger.error('[API] createSosAlert: Failed', { status: response.status, error: txt });
        throw new Error(txt || 'Failed to create SOS alert');
      }
      const result = await response.json();
      logger.info('[API] createSosAlert: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] createSosAlert: Error', err);
      throw err;
    }
  },

  // Get active SOS for a driver
  getActiveSos: async (driverEmail: string) => {
    try {
      logger.info('[API] getActiveSos: Starting request', { driverEmail, url: `${API_URL}/sos/active/${encodeURIComponent(driverEmail)}` });
      const response = await fetch(`${API_URL}/sos/active/${encodeURIComponent(driverEmail)}`);
      if (!response.ok) {
        logger.error('[API] getActiveSos: Failed', { status: response.status });
        throw new Error('Failed to fetch active SOS');
      }
      const result = await response.json();
      logger.info('[API] getActiveSos: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] getActiveSos: Error', err);
      return { hasActive: false, alert: null };
    }
  },

  // Resolve SOS alert by ID
  resolveSosAlert: async (sosId: number) => {
    try {
      logger.info('[API] resolveSosAlert: Starting request', { sosId, url: `${API_URL}/sos/resolve/${sosId}` });
      const response = await fetch(`${API_URL}/sos/resolve/${sosId}`, { method: 'POST' });
      if (!response.ok) {
        logger.error('[API] resolveSosAlert: Failed', { status: response.status, sosId });
        throw new Error('Failed to resolve SOS alert');
      }
      const result = await response.json();
      logger.info('[API] resolveSosAlert: Success', { sosId });
      return result;
    } catch (err) {
      logger.error('[API] resolveSosAlert: Error', err);
      throw err;
    }
  },

  // Get all SOS alerts (admin)
  getAllSosAlerts: async () => {
    try {
      logger.info('[API] getAllSosAlerts: Starting request', { url: `${API_URL}/sos/all` });
      const response = await fetch(`${API_URL}/sos/all`);
      if (!response.ok) {
        logger.error('[API] getAllSosAlerts: Failed', { status: response.status });
        throw new Error('Failed to fetch all SOS alerts');
      }
      const result = await response.json();
      logger.info('[API] getAllSosAlerts: Success', { count: result.length });
      return result;
    } catch (err) {
      logger.error('[API] getAllSosAlerts: Error', err);
      return [];
    }
  },

  // CREATE SOS ALERT (Legacy - kept for backward compatibility)
  createAlert: async (alertData: { vehicleId?: string; driverEmail?: string; type: string; location: string }) => {
    try {
      const payload = {
        VehicleId: alertData.vehicleId || 'VEHICLE-001',
        DriverEmail: alertData.driverEmail || localStorage.getItem('userEmail') || 'unknown',
        Type: alertData.type,
        Location: alertData.location
      };
      logger.info('[API] createAlert: Starting request', { payload, url: `${API_URL}/alerts` });
      const response = await fetch(`${API_URL}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        logger.error('[API] createAlert: Failed', { status: response.status });
        throw new Error('Failed to create alert');
      }
      const result = await response.json();
      logger.info('[API] createAlert: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] createAlert: Error', err);
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

      logger.info('[API] getFleetLocations: Starting request', { url, userEmail, userRole });
      const response = await fetch(url);
      if (!response.ok) {
        logger.error('[API] getFleetLocations: Failed', { status: response.status });
        throw new Error('Failed to fetch fleet locations');
      }
      const result = await response.json();
      logger.info('[API] getFleetLocations: Success', { count: result.length });
      return result;
    } catch (err) {
      logger.error('[API] getFleetLocations: Error', err);
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

      logger.info('[API] getFleetRealtime: Starting request', { url, userEmail, userRole });
      const response = await fetch(url);
      if (!response.ok) {
        logger.error('[API] getFleetRealtime: Failed', { status: response.status });
        throw new Error('Failed to fetch real-time fleet data');
      }
      const result = await response.json();
      logger.info('[API] getFleetRealtime: Success', { count: result.length });
      return result;
    } catch (err) {
      logger.error('[API] getFleetRealtime: Error', err);
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

      logger.info('[API] getActiveFleet: Starting request', { url, userEmail, userRole });
      const response = await fetch(url);
      if (!response.ok) {
        logger.error('[API] getActiveFleet: Failed', { status: response.status });
        throw new Error('Failed to fetch active fleet data');
      }
      const result = await response.json();
      logger.info('[API] getActiveFleet: Success', { count: result.length });
      return result;
    } catch (err) {
      logger.error('[API] getActiveFleet: Error', err);
      return []; // Return empty array if offline
    }
  },

  // UPDATE VEHICLE LOCATION
  updateVehicleLocation: async (tripId: number, latitude: number, longitude: number, speed: number, eta?: string) => {
    try {
      const payload = { TripId: tripId, Latitude: latitude, Longitude: longitude, Speed: speed, Eta: eta };
      logger.info('[API] updateVehicleLocation: Starting request', { payload, url: `${API_URL}/fleet/update-location` });
      const response = await fetch(`${API_URL}/fleet/update-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        logger.error('[API] updateVehicleLocation: Failed', { status: response.status });
        throw new Error('Failed to update vehicle location');
      }
      const result = await response.json();
      logger.info('[API] updateVehicleLocation: Success', { tripId });
      return result;
    } catch (err) {
      logger.error('[API] updateVehicleLocation: Error', err);
      return null;
    }
  },

  getFleetRoute: async (routeId: number) => {
    try {
      logger.info('[API] getFleetRoute: Starting request', { routeId, url: `${API_URL}/fleet/route/${routeId}` });
      const response = await fetch(`${API_URL}/fleet/route/${routeId}`);
      if (!response.ok) {
        logger.error('[API] getFleetRoute: Failed', { status: response.status, routeId });
        throw new Error('Failed to fetch route');
      }
      const result = await response.json();
      logger.info('[API] getFleetRoute: Success', { routeId });
      return result;
    } catch (err) {
      logger.error('[API] getFleetRoute: Error', err);
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

      logger.info('[API] getHistory: Starting request', { url, userEmail, userRole });
      const response = await fetch(url);
      if (!response.ok) {
        logger.error('[API] getHistory: Failed', { status: response.status });
        throw new Error('Failed to fetch history');
      }
      const result = await response.json();
      logger.info('[API] getHistory: Success', { count: result.length });
      return result;
    } catch (err) {
      logger.error('[API] getHistory: Error', err);
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

      logger.info('[API] getDeliveryHistory: Starting request', { url, userEmail, userRole });
      const response = await fetch(url);
      if (!response.ok) {
        logger.error('[API] getDeliveryHistory: Failed', { status: response.status });
        throw new Error('Failed to fetch history');
      }
      const result = await response.json();
      logger.info('[API] getDeliveryHistory: Success', { count: result.length });
      return result;
    } catch (err) {
      logger.error('[API] getDeliveryHistory: Error', err);
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
      logger.info('[API] saveDeliveryTrip: Starting request', { tripData, url: `${API_URL}/history` });
      const response = await fetch(`${API_URL}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData)
      });
      if (!response.ok) {
        logger.error('[API] saveDeliveryTrip: Failed', { status: response.status });
        throw new Error('Failed to save delivery trip');
      }
      const result = await response.json();
      logger.info('[API] saveDeliveryTrip: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] saveDeliveryTrip: Error', err);
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
      logger.info('[API] updateHistory: Starting request', { id, data, userEmail, userRole });
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
        logger.error('[API] updateHistory: Failed', { status: response.status, error: errorText, id });
        throw new Error('Failed to update history');
      }
      const result = await response.json();
      logger.info('[API] updateHistory: Success', { id });
      return result;
    } catch (err) {
      logger.error('[API] updateHistory: Error', err);
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
      logger.info('[API] completeNavigation: Starting request', { data, url: `${API_URL}/navigation/complete` });
      const response = await fetch(`${API_URL}/navigation/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        logger.error('[API] completeNavigation: Failed', { status: response.status, error: result });
        throw new Error(result.error || 'Failed to complete navigation');
      }

      logger.info('[API] completeNavigation: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] completeNavigation: Error', err);
      throw err;
    }
  },

  // WEATHER: GET CURRENT FORECAST
  getWeatherForecast: async (lat?: number, lon?: number) => {
    try {
      let url = `${API_URL}/weather`;
      if (typeof lat === 'number' && typeof lon === 'number') url = `${url}?lat=${lat}&lon=${lon}`;
      logger.info('[API] getWeatherForecast: Starting request', { url, lat, lon });
      const response = await fetch(url);
      if (!response.ok) {
        logger.error('[API] getWeatherForecast: Failed', { status: response.status });
        throw new Error('Failed to fetch weather');
      }
      const result = await response.json();
      logger.info('[API] getWeatherForecast: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] getWeatherForecast: Error', err);
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
      logger.info('[API] saveWeather: Starting request', { weatherData, url: `${API_URL}/weather/save` });
      const response = await fetch(`${API_URL}/weather/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weatherData)
      });
      if (!response.ok) {
        logger.error('[API] saveWeather: Failed', { status: response.status });
        throw new Error('Failed to save weather');
      }
      const result = await response.json();
      logger.info('[API] saveWeather: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] saveWeather: Error', err);
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

      logger.info('[API] getWeatherHistory: Starting request', { url, userEmail, userRole });
      const response = await fetch(url);
      if (!response.ok) {
        logger.error('[API] getWeatherHistory: Failed', { status: response.status });
        throw new Error('Failed to fetch weather history');
      }
      const result = await response.json();
      logger.info('[API] getWeatherHistory: Success', { count: result.length });
      return result;
    } catch (err) {
      logger.error('[API] getWeatherHistory: Error', err);
      return [];
    }
  },

  // Helper: Get actual road geometry from OSRM (with CORS proxy)
  getOSRMRoute: async (startLat: number, startLon: number, endLat: number, endLon: number) => {
    try {
      // Use CORS proxy to avoid browser blocking
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(osrmUrl)}`;

      logger.info('[API] getOSRMRoute: Starting request', { startLat, startLon, endLat, endLon, proxyUrl });
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        logger.error('[API] getOSRMRoute: Failed', { status: response.status });
        throw new Error('OSRM routing failed');
      }
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        // Convert GeoJSON coordinates [lon, lat] to Leaflet format [lat, lon]
        const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        logger.info('[API] getOSRMRoute: Success', { coordinateCount: coords.length });
        return {
          geometry: coords,
          distance: data.routes[0].distance,
          duration: data.routes[0].duration
        };
      }
      logger.warn('[API] getOSRMRoute: No routes found');
      return null;
    } catch (err) {
      logger.error('[API] getOSRMRoute: Error', err);
      return null;
    }
  },

  // ROUTE OPTIMIZATION: Find multiple shortest paths with weather & safety
  optimizeRoute: async (origin: string, destination: string) => {
    try {
      logger.info('[API] optimizeRoute: Starting request', { origin, destination, url: `${API_URL}/optimize` });
      const response = await fetch(`${API_URL}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Origin: origin, Destination: destination })
      });
      if (!response.ok) {
        logger.error('[API] optimizeRoute: Failed', { status: response.status });
        throw new Error('Failed to optimize route');
      }
      const data = await response.json();

      logger.info('[API] optimizeRoute: Backend response received', data);

      // Enhance routes with real road geometry from OSRM
      if (data && data.startCoords && data.endCoords) {
        logger.info('[API] optimizeRoute: Fetching OSRM route...');
        const osrmRoute = await apiService.getOSRMRoute(
          data.startCoords.lat,
          data.startCoords.lon,
          data.endCoords.lat,
          data.endCoords.lon
        );

        logger.info('[API] optimizeRoute: OSRM route result', osrmRoute);

        if (osrmRoute && osrmRoute.geometry) {
          logger.info('[API] optimizeRoute: Applying OSRM geometry to routes');
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
          logger.info('[API] optimizeRoute: Using backend route data (OSRM failed)');
        }
      }

      logger.info('[API] optimizeRoute: Success', { alternativesCount: data.alternatives?.length });
      return data;
    } catch (err) {
      logger.error('[API] optimizeRoute: Error', err);
      throw err;
    }
  },

  // NOTIFICATIONS: Create a notification (generic - for admin/system use)
  createNotification: async (title: string, description: string, category: string = 'Info') => {
    try {
      const payload = { title, description, category, timestamp: new Date().toISOString() };
      logger.info('[API] createNotification: Starting request', { payload, url: `${API_URL}/notifications` });
      const response = await fetch(`${API_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        logger.error('[API] createNotification: Failed', { status: response.status });
        throw new Error('Failed to create notification');
      }
      const result = await response.json();
      logger.info('[API] createNotification: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] createNotification: Error', err);
      return null;
    }
  },

  // WEATHER ALERT: Create weather-specific notification (only for HEAVY_RAIN or STORM)
  createWeatherAlert: async (severity: 'HEAVY_RAIN' | 'STORM', message: string, userEmail?: string) => {
    try {
      const payload = { severity, message, userEmail };
      logger.info('[API] createWeatherAlert: Starting request', { payload, url: `${API_URL}/notifications/weather` });
      const response = await fetch(`${API_URL}/notifications/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const err = await response.json();
        logger.error('[API] createWeatherAlert: Failed', { status: response.status, error: err });
        throw new Error(err.error || 'Failed to create weather alert');
      }
      const result = await response.json();
      logger.info('[API] createWeatherAlert: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] createWeatherAlert: Error', err);
      return null;
    }
  },

  // NOTIFICATIONS: Get all notifications (admin view)
  getNotifications: async () => {
    try {
      logger.info('[API] getNotifications: Starting request', { url: `${API_URL}/notifications` });
      const response = await fetch(`${API_URL}/notifications`);
      if (!response.ok) {
        logger.error('[API] getNotifications: Failed', { status: response.status });
        throw new Error('Failed to fetch notifications');
      }
      const result = await response.json();
      logger.info('[API] getNotifications: Success', { count: result.length });
      return result;
    } catch (err) {
      logger.error('[API] getNotifications: Error', err);
      return [];
    }
  },

  // WEATHER ALERTS: Get weather alerts only (user view)
  getWeatherAlerts: async () => {
    try {
      logger.info('[API] getWeatherAlerts: Starting request', { url: `${API_URL}/notifications/weather` });
      const response = await fetch(`${API_URL}/notifications/weather`);
      if (!response.ok) {
        logger.error('[API] getWeatherAlerts: Failed', { status: response.status });
        throw new Error('Failed to fetch weather alerts');
      }
      const result = await response.json();
      logger.info('[API] getWeatherAlerts: Success', { count: result.length });
      return result;
    } catch (err) {
      logger.error('[API] getWeatherAlerts: Error', err);
      return [];
    }
  },

  // SYSTEM ALERT: Create system status notification (for abnormal status)
  createSystemAlert: async (severity: 'ABNORMAL' | 'SOS' | 'IDLE_ALERT' | 'EMERGENCY', message: string, userEmail?: string) => {
    try {
      const payload = { severity, message, userEmail };
      logger.info('[API] createSystemAlert: Starting request', { payload, url: `${API_URL}/notifications/system` });
      const response = await fetch(`${API_URL}/notifications/system`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const err = await response.json();
        logger.error('[API] createSystemAlert: Failed', { status: response.status, error: err });
        throw new Error(err.error || 'Failed to create system alert');
      }
      const result = await response.json();
      logger.info('[API] createSystemAlert: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] createSystemAlert: Error', err);
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

      logger.info('[API] getUserAlerts: Starting request', { url, userEmail, userRole });
      const response = await fetch(url);
      if (!response.ok) {
        logger.error('[API] getUserAlerts: Failed', { status: response.status });
        throw new Error('Failed to fetch user alerts');
      }
      const result = await response.json();
      logger.info('[API] getUserAlerts: Success', { count: result.length });
      return result;
    } catch (err) {
      logger.error('[API] getUserAlerts: Error', err);
      return [];
    }
  },

  // USER SETTINGS: get and update by email (no-auth demo)
  getUserSettings: async (email: string) => {
    try {
      logger.info('[API] getUserSettings: Starting request', { email, url: `${API_URL}/settings?email=${encodeURIComponent(email)}` });
      const response = await fetch(`${API_URL}/settings?email=${encodeURIComponent(email)}`);
      if (!response.ok) {
        logger.error('[API] getUserSettings: Failed', { status: response.status });
        throw new Error('Failed to fetch settings');
      }
      const result = await response.json();
      logger.info('[API] getUserSettings: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] getUserSettings: Error', err);
      return null;
    }
  },

  updateUserSettings: async (email: string, settings: { TemperatureUnit?: string; DistanceUnit?: string; TimeFormat?: string; Language?: string }) => {
    try {
      logger.info('[API] updateUserSettings: Starting request', { email, settings, url: `${API_URL}/settings?email=${encodeURIComponent(email)}` });
      const response = await fetch(`${API_URL}/settings?email=${encodeURIComponent(email)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!response.ok) {
        logger.error('[API] updateUserSettings: Failed', { status: response.status });
        throw new Error('Failed to update settings');
      }
      const result = await response.json();
      logger.info('[API] updateUserSettings: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] updateUserSettings: Error', err);
      return null;
    }
  },

  // SOS: Update vehicle break mode and status
  updateSosStatus: async (data: { breakModeActive: boolean; location: string; timestamp: string }) => {
    try {
      logger.info('[API] updateSosStatus: Starting request', { data, url: `${API_URL}/sos/update-status` });
      const response = await fetch(`${API_URL}/sos/update-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        logger.error('[API] updateSosStatus: Failed', { status: response.status });
        throw new Error('Failed to update SOS status');
      }
      const result = await response.json();
      logger.info('[API] updateSosStatus: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] updateSosStatus: Error', err);
      return null;
    }
  },

  // SOS: Track vehicle movement for idle detection
  trackVehicleMovement: async (data: { location: string; timestamp: string; isMoving: boolean }) => {
    try {
      logger.info('[API] trackVehicleMovement: Starting request', { data, url: `${API_URL}/sos/track-movement` });
      const response = await fetch(`${API_URL}/sos/track-movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        logger.error('[API] trackVehicleMovement: Failed', { status: response.status });
        throw new Error('Failed to track movement');
      }
      const result = await response.json();
      logger.info('[API] trackVehicleMovement: Success', result);
      return result;
    } catch (err) {
      logger.error('[API] trackVehicleMovement: Error', err);
      return null;
    }
  },

  // REST POINTS: Find nearby rest points (coffee shops, gas stations, toll plazas)
  getRestPoints: async (latitude: number, longitude: number) => {
    try {
      const payload = { Latitude: latitude, Longitude: longitude };
      logger.info('[API] getRestPoints: Starting request', { payload, url: `${API_URL}/rest-points` });
      const response = await fetch(`${API_URL}/rest-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        logger.error('[API] getRestPoints: Failed', { status: response.status });
        throw new Error('Failed to fetch rest points');
      }
      const result = await response.json();
      logger.info('[API] getRestPoints: Success', { restPointsCount: result.restPoints?.length });
      return result;
    } catch (err) {
      logger.error('[API] getRestPoints: Error', err);
      return { restPoints: [] };
    }
  },
};