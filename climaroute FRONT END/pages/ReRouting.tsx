import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input } from '../components/Layout';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Navigation, StopCircle, Crosshair, MapPin, MousePointerClick, AlertTriangle, RefreshCw, Pause, Play, RotateCcw } from 'lucide-react';
import { apiService } from '../services/apiservice';
import { useSettings } from '../contexts/SettingsContext';
import { useSos } from '../contexts/SosContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const truckIcon = L.divIcon({
  html: `<div style="background: #3b82f6; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 17h4V5H2v12h3"></path><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle>
    </svg>
  </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

// Live Location Overlay Component - Shows human-readable location name (NEVER raw coordinates)
function LiveLocationOverlay({ lat, lon }: { lat: number; lon: number }) {
  const [locationName, setLocationName] = useState<string>("Resolving location...");
  const cacheRef = useRef<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchLocationName = async () => {
      // Cache key to avoid excessive API calls
      const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
      
      if (cacheRef.current[cacheKey]) {
        setLocationName(cacheRef.current[cacheKey]);
        return;
      }

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=en`
        );
        const data = await response.json();
        const addr = data.address;
        
        const area = addr.suburb || addr.neighbourhood || addr.hamlet;
        const city = addr.city || addr.town || addr.village || addr.county;
        const state = addr.state;
        
        let name = "Location unavailable";
        if (area && city) name = `${area}, ${city}`;
        else if (city && state) name = `${city}, ${state}`;
        else if (city) name = city;
        else if (state) name = state;
        
        cacheRef.current[cacheKey] = name;
        setLocationName(name);
      } catch (e) {
        setLocationName("Location unavailable");
      }
    };

    fetchLocationName();
  }, [lat, lon]);

  return (
    <div className="absolute top-4 left-4 z-[1000] px-4 py-2 rounded-lg shadow-lg border backdrop-blur-md bg-green-50 border-green-300">
      <span className="text-[10px] uppercase font-bold text-gray-600 tracking-wider">Live Location</span>
      <p className="text-sm font-semibold text-gray-700">{locationName}</p>
      <p className="text-[10px] text-green-600 mt-0.5">📍 GPS Active</p>
    </div>
  );
}

// Helper: Fit Map Bounds
function FitBounds({ routeData }: { routeData: any }) {
  const map = useMap();
  useEffect(() => {
    if (routeData && routeData.startCoords && routeData.endCoords) {
      const bounds = L.latLngBounds(
        [routeData.startCoords.lat, routeData.startCoords.lon],
        [routeData.endCoords.lat, routeData.endCoords.lon]
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routeData, map]);
  return null;
}

// Haversine distance in km
function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Mock GPS for testing (Chennai location)
export function ReRouting() {
  // Restore from localStorage if available
  const { breakModeActive, setBreakModeActive } = useSos();
  const [origin, setOrigin] = useState(() => localStorage.getItem('climaRoute_origin') || "Chennai, Tamil Nadu");
  const [dest, setDest] = useState(() => localStorage.getItem('climaRoute_dest') || "Bangalore, Karnataka");
  const [originAddress, setOriginAddress] = useState(() => localStorage.getItem('climaRoute_originAddress') || "Chennai, Tamil Nadu");
  const [destAddress, setDestAddress] = useState(() => localStorage.getItem('climaRoute_destAddress') || "Bangalore, Karnataka");
  const [routeData, setRouteData] = useState<any>(() => {
    const saved = localStorage.getItem('climaRoute_data');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isNavigating, setIsNavigating] = useState(() => {
    const navActive = localStorage.getItem('climaRoute_navigation_active');
    return navActive === '1';
  });
  const [userPosition, setUserPosition] = useState<[number, number] | null>(() => {
    const saved = localStorage.getItem('climaRoute_userPosition');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(() => {
    const saved = localStorage.getItem('climaRoute_selectedRoute');
    return saved ? parseInt(saved) : null;
  });
  const watchIdRef = useRef<number | null>(null);
  const mockGpsIndexRef = useRef<number>(0);
  const [useMockGPS, setUseMockGPS] = useState(false); // do not use mock by default (avoid false data)
  
  // Trip tracking
  const [tripStartTime, setTripStartTime] = useState<Date | null>(() => {
    const saved = localStorage.getItem('climaRoute_tripStartTime');
    return saved ? new Date(saved) : null;
  });
  const [currentWeather, setCurrentWeather] = useState<any>(() => {
    const saved = localStorage.getItem('climaRoute_weather');
    return saved ? JSON.parse(saved) : null;
  });
  const [navigationStartCoords, setNavigationStartCoords] = useState<[number, number] | null>(() => {
    const saved = localStorage.getItem('climaRoute_navStartCoords');
    return saved ? JSON.parse(saved) : null;
  });

  // Timer: 10s for Testing (Change to 3600 for real life)
  const TIMER_START = 10; 
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const saved = localStorage.getItem('climaRoute_timeLeft');
    return saved ? parseInt(saved) : TIMER_START;
  });
  const [isAutoRerouting, setIsAutoRerouting] = useState(false);
  const [rerouteMessage, setRerouteMessage] = useState<string | null>(null);
  const [distanceToDestination, setDistanceToDestination] = useState<number | null>(null);
  const [activeTripId, setActiveTripId] = useState<number | null>(() => {
    const saved = localStorage.getItem('climaRoute_tripId');
    return saved ? parseInt(saved) : null;
  });

  // --- CALCULATE DISTANCE TO DESTINATION ---
  useEffect(() => {
    if (isNavigating && userPosition && routeData?.endCoords) {
      const destCoords: [number, number] = [routeData.endCoords.lat, routeData.endCoords.lon];
      const distKm = distanceKm(userPosition, destCoords);
      const distMeters = distKm * 1000;
      setDistanceToDestination(distMeters);
    } else {
      setDistanceToDestination(null);
    }
  }, [userPosition, routeData, isNavigating]);

  // Check if user is near destination (within 100 meters)
  const isNearDestination = distanceToDestination !== null && distanceToDestination <= 100;

  // --- PERSIST STATE TO LOCALSTORAGE ---
  useEffect(() => {
    localStorage.setItem('climaRoute_origin', origin);
    localStorage.setItem('climaRoute_dest', dest);
    localStorage.setItem('climaRoute_originAddress', originAddress);
    localStorage.setItem('climaRoute_destAddress', destAddress);
    if (routeData) localStorage.setItem('climaRoute_data', JSON.stringify(routeData));
    if (userPosition) localStorage.setItem('climaRoute_userPosition', JSON.stringify(userPosition));
    if (selectedRouteIndex !== null) localStorage.setItem('climaRoute_selectedRoute', String(selectedRouteIndex));
    if (tripStartTime) localStorage.setItem('climaRoute_tripStartTime', tripStartTime.toISOString());
    if (currentWeather) localStorage.setItem('climaRoute_weather', JSON.stringify(currentWeather));
    if (navigationStartCoords) localStorage.setItem('climaRoute_navStartCoords', JSON.stringify(navigationStartCoords));
    localStorage.setItem('climaRoute_timeLeft', String(timeLeft));
    if (activeTripId) localStorage.setItem('climaRoute_tripId', String(activeTripId));
    localStorage.setItem('climaRoute_navigation_active', isNavigating ? '1' : '0');
  }, [origin, dest, originAddress, destAddress, routeData, userPosition, selectedRouteIndex, tripStartTime, currentWeather, navigationStartCoords, timeLeft, activeTripId, isNavigating]);
  
  // --- RESUME NAVIGATION ON COMPONENT MOUNT ---
  useEffect(() => {
    // If navigation was active when we left the page, resume GPS tracking
    if (isNavigating && !watchIdRef.current) {
      // Resume GPS watch
      watchIdRef.current = navigator.geolocation?.watchPosition(
        async (pos) => {
          setUserPosition([pos.coords.latitude, pos.coords.longitude]);
          const speedMs = pos.coords.speed;
          if (typeof speedMs === 'number' && !isNaN(speedMs)) {
            const kmh = Math.round(speedMs * 3.6);
            localStorage.setItem('climaRoute_liveSpeed', String(kmh));

            try {
              const tid = activeTripId || (parseInt(localStorage.getItem('climaRoute_tripId') || '0') || null);
              if (tid) await apiService.updateHistory(tid, { 
                currentLat: pos.coords.latitude, 
                currentLon: pos.coords.longitude, 
                speed: Math.round(kmh), 
                eta: localStorage.getItem('climaRoute_eta') || undefined, 
                status: 'InProgress' 
              });
            } catch (err) { console.warn('telemetry update failed', err); }
          }

          try {
            if (routeData && selectedRouteIndex !== null) {
              const route = routeData.alternatives[selectedRouteIndex];
              const totalSec = Math.round(route.duration || 0);
              const elapsedMs = tripStartTime ? (Date.now() - tripStartTime.getTime()) : 0;
              const remainingSec = Math.max(0, totalSec - Math.round(elapsedMs / 1000));
              const mins = Math.floor(remainingSec / 60);
              const timeString = `${mins} min`;
              localStorage.setItem('climaRoute_eta', timeString);

              try {
                const tid = activeTripId || (parseInt(localStorage.getItem('climaRoute_tripId') || '0') || null);
                if (tid) await apiService.updateHistory(tid, { eta: timeString });
              } catch (e) { }
            }
          } catch {}
        },
        (err) => {
          console.warn("GPS Error", err);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      ) as any;
    }
    
    return () => {
      // Don't clear watch on unmount if navigating - keep it running
    };
  }, []); // Run only once on mount

  // --- MAP CLICK HANDLER ---
  const getAddressName = async (lat: number, lon: number): Promise<string> => {
      try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          const data = await response.json();
          const addr = data.address;
          return addr.city || addr.town || addr.village || addr.county || "Location";
      } catch (e) { return `${lat.toFixed(4)}, ${lon.toFixed(4)}`; }
  };

  // Get coordinates from address string
  const getCoordinates = async (address: string): Promise<[number, number] | null> => {
      try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
          const data = await response.json();
          if (data && data.length > 0) {
              return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          }
          return null;
      } catch (e) { 
          console.error("Geocoding failed:", e);
          return null; 
      }
  };

  // Get user current location (GPS or WiFi fallback)
  const getCurrentLocation = (): Promise<[number, number]> => {
      return new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
              // Fallback: Use default Chennai location
              console.log("Geolocation not supported, using default location");
              resolve([13.0827, 80.2707]); // Chennai default
              return;
          }

          navigator.geolocation.getCurrentPosition(
              (pos) => {
                  resolve([pos.coords.latitude, pos.coords.longitude]);
              },
              (error) => {
                  // On error, use default location instead of rejecting
                  console.log("GPS error, using default location");
                  resolve([13.0827, 80.2707]); // Chennai default
              },
              { 
                  timeout: 8000, 
                  enableHighAccuracy: false, // Laptop friendly
                  maximumAge: 60000 // Allow 1-minute cached position
              }
          );
      });
  };

  // Track double-click for destination selection
  const mapDoubleClickRef = useRef<boolean>(false);
  const mapClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function SmartMapClickHandler() {
    useMapEvents({
      async dblclick(e) {
        if (isNavigating) return;
        setDest("Fetching address...");
        const address = await getAddressName(e.latlng.lat, e.latlng.lng);
        setDest(address);
        setDestAddress(address);
      },
      async click(e) {
        if (isNavigating) return;
        // Single click for destination (fallback)
        if (mapClickTimeoutRef.current) clearTimeout(mapClickTimeoutRef.current);
        mapClickTimeoutRef.current = setTimeout(async () => {
          if (!mapDoubleClickRef.current) {
            setDest("Fetching address...");
            const address = await getAddressName(e.latlng.lat, e.latlng.lng);
            setDest(address);
            setDestAddress(address);
          }
          mapDoubleClickRef.current = false;
        }, 250);
      },
    });
    return null;
  }

  // --- TIMER LOGIC ---
  useEffect(() => {
      let interval: NodeJS.Timeout;
      if (isNavigating && timeLeft > 0) {
          interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
      } else if (isNavigating && timeLeft === 0) {
          handleAutoReroute();
      }
      return () => clearInterval(interval);
  }, [isNavigating, timeLeft]);

  // --- AUTO REROUTE (REAL LOGIC) ---
  const handleAutoReroute = async () => {
      if (!userPosition) return; // Need truck location to reroute
      
      setIsAutoRerouting(true);
      setRerouteMessage("Scanning weather conditions...");

      try {
          // 1. New Origin = Current Truck Position
          const currentLat = userPosition[0];
          const currentLon = userPosition[1];
          
          // 2. Call C# Backend (which calls Python AI) for new routes
          // Passing coords directly is faster and more accurate for routing
          const data = await apiService.optimizeRoute(`${currentLat},${currentLon}`, dest);
          
          if (data && data.alternatives) {
              // 3. Auto-select route with Highest Safety Score
              let bestIndex = 0;
              let maxSafety = -1;
              data.alternatives.forEach((r: any, idx: number) => {
                  if (r.safetyScore > maxSafety) {
                      maxSafety = r.safetyScore;
                      bestIndex = idx;
                  }
              });

              // Update route data and select best route BEFORE setting state
              setRouteData(data);
              setSelectedRouteIndex(bestIndex);
              
              // Create new segments for the selected route
              const selectedRoute = data.alternatives[bestIndex];
              const totalDistanceKm = selectedRoute.distance / 1000;
              const segments = await createRouteSegments(selectedRoute.geometry, totalDistanceKm);
              
              // Update sessionStorage with new route segments
              sessionStorage.setItem('climaRoute_routeSegments', JSON.stringify({
                  segments: segments,
                  totalDistance: totalDistanceKm,
                  origin: `${currentLat.toFixed(4)}, ${currentLon.toFixed(4)}`,
                  destination: destAddress || dest,
                  routeGeometry: selectedRoute.geometry,
                  safetyScore: selectedRoute.safetyScore,
                  duration: selectedRoute.duration
              }));
              
              setRerouteMessage(`Route Updated! Switched to Safer Path (Score: ${Math.round(maxSafety)}/100)`);
              
              // Notify Backend
              try {
                  await apiService.createNotification(
                      "Auto Reroute", 
                      `Path updated due to weather. New Safety Score: ${Math.round(maxSafety)}/100`, 
                      "Critical"
                  );
              } catch (err) {
                  console.log("Failed to send notification", err);
              }
          }
      } catch (e) { 
          console.error("Reroute failed", e);
          setRerouteMessage("Auto-reroute failed. Continuing on current path.");
      }
      finally {
          setIsAutoRerouting(false);
          setTimeLeft(TIMER_START); // Restart loop
          setTimeout(() => setRerouteMessage(null), 8000);
      }
  };

  const formatTime = (seconds: number) => {
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- MANUAL ROUTE FINDING ---
  const handleFindRoutes = async () => {
    setError(null);
    setLoading(true);
    setRouteData(null); 
    setSelectedRouteIndex(null);

    try {
      // Validate inputs
      if (!origin.trim() || !dest.trim()) {
        setError("Please enter both origin and destination");
        setLoading(false);
        return;
      }

      // Call backend with human-readable addresses; server will geocode
      const data = await apiService.optimizeRoute(origin, dest);
      
      if (!data || !data.alternatives) {
        setError("No routes found. Try different locations.");
        setLoading(false);
        return;
      }

      // Update address strings from geocoded coordinates for accuracy
      if (data.startCoords) {
        const startAddr = await getReverseGeocode(data.startCoords.lat, data.startCoords.lon);
        setOriginAddress(startAddr);
        // If user typed a short name, update it to the full address
        if (origin.length < startAddr.length) setOrigin(startAddr);
      }
      if (data.endCoords) {
        const endAddr = await getReverseGeocode(data.endCoords.lat, data.endCoords.lon);
        setDestAddress(endAddr);
        // If user typed a short name, update it to the full address
        if (dest.length < endAddr.length) setDest(endAddr);
      }

      // VALIDATION: Ensure routes are valid and unique (no fake routes)
      if (data.alternatives && data.alternatives.length > 0) {
          // Filter out duplicate routes by comparing geometry hash
          const uniqueRoutes: any[] = [];
          const seenGeometries = new Set<string>();
          
          for (const route of data.alternatives) {
              if (!route.geometry || route.geometry.length < 2) {
                  console.warn('Skipping invalid route with insufficient geometry');
                  continue;
              }
              
              // Create a simple hash of the route geometry
              const geoHash = route.geometry.slice(0, 5).map((p: number[]) => 
                  `${p[0].toFixed(3)},${p[1].toFixed(3)}`
              ).join('|');
              
              if (!seenGeometries.has(geoHash)) {
                  seenGeometries.add(geoHash);
                  uniqueRoutes.push(route);
              } else {
                  console.warn('Skipping duplicate route');
              }
          }
          
          if (uniqueRoutes.length === 0) {
              setError("No valid route available between source and destination. Please try different locations.");
              setLoading(false);
              return;
          }
          
          data.alternatives = uniqueRoutes;
      } else {
          setError("No valid route available between source and destination. Please try different locations.");
          setLoading(false);
          return;
      }

      setRouteData(data);
      if(data.startCoords) setUserPosition([data.startCoords.lat, data.startCoords.lon]);

      // Auto-select safest route
      let bestIndex = 0;
      let maxSafety = -1;
      data.alternatives.forEach((r: any, idx: number) => {
          if (r.safetyScore > maxSafety) {
              maxSafety = r.safetyScore;
              bestIndex = idx;
          }
      });
      setSelectedRouteIndex(bestIndex);

    } catch (error: any) {
      console.error("Route calculation error:", error);
      setError(`Error: ${error.message || "Could not calculate route. Check backend is running on port 5000."}`);
    } 
    finally { 
      setLoading(false); 
    }
  };

  // Helper: Get location name from coordinates
  const getReverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await response.json();
      const addr = data.address;
      return addr.city || addr.town || addr.village || addr.county || addr.road || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    } catch (e) {
      return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    }
  };

  // Helper: Create 5 equal segments from route geometry
  const createRouteSegments = async (routeGeometry: number[][], totalDistance: number) => {
    if (!routeGeometry || routeGeometry.length === 0) return [];
    
    // Calculate segment distance (divide total into 5 equal parts)
    const segmentDistance = totalDistance / 5;
    const segments: any[] = [];
    
    let accumulatedDistance = 0;
    let currentSegmentTarget = segmentDistance;
    let segmentIndex = 0;
    
    segments.push({
      index: 0,
      coords: routeGeometry[0],
      distance: 0
    });
    
    // Walk through geometry and pick points at equal distance intervals
    for (let i = 1; i < routeGeometry.length && segments.length < 5; i++) {
      const prevPoint: [number, number] = [routeGeometry[i-1][0], routeGeometry[i-1][1]];
      const currPoint: [number, number] = [routeGeometry[i][0], routeGeometry[i][1]];
      const stepDist = distanceKm(prevPoint, currPoint);
      
      accumulatedDistance += stepDist;
      
      if (accumulatedDistance >= currentSegmentTarget && segments.length < 5) {
        segments.push({
          index: segments.length,
          coords: routeGeometry[i],
          distance: accumulatedDistance
        });
        currentSegmentTarget += segmentDistance;
      }
    }
    
    // Ensure we have exactly 5 segments (add endpoint if needed)
    if (segments.length < 5) {
      segments.push({
        index: segments.length,
        coords: routeGeometry[routeGeometry.length - 1],
        distance: totalDistance
      });
    }
    
    // Fetch location names for each segment
    const segmentsWithNames = await Promise.all(
      segments.slice(0, 5).map(async (seg) => {
        const locationName = await getReverseGeocode(seg.coords[0], seg.coords[1]);
        return {
          ...seg,
          name: locationName,
          lat: seg.coords[0],
          lon: seg.coords[1]
        };
      })
    );
    
    return segmentsWithNames;
  };

  // --- Start navigation: create in-progress history and begin GPS watch ---
  const startNavigation = async () => {
      setIsNavigating(true);
      setTimeLeft(TIMER_START);
      setTripStartTime(new Date());
      // initial ETA set from selected route
      try {
        if (routeData && selectedRouteIndex !== null) {
          const route = routeData.alternatives[selectedRouteIndex];
          const mins = Math.round((route.duration || 0) / 60);
          localStorage.setItem('climaRoute_eta', `${mins} min`);
          
          // Create 5-segment route data for AdaptiveSpeed page
          const totalDistanceKm = route.distance / 1000;
          const segments = await createRouteSegments(route.geometry, totalDistanceKm);
          
          // Store segments in sessionStorage for AdaptiveSpeed page
          sessionStorage.setItem('climaRoute_routeSegments', JSON.stringify({
            segments: segments,
            totalDistance: totalDistanceKm,
            origin: origin,
            destination: dest,
            routeGeometry: route.geometry,
            safetyScore: route.safetyScore,
            duration: route.duration
          }));
        }
      } catch {}
      
      // Get current weather data
      try {
        const weatherData = await apiService.getWeatherForecast();
        setCurrentWeather(weatherData?.current || weatherData);
      } catch (err) {
        console.log("Failed to fetch current weather");
      }
      
      // Mark navigation active (used by Dashboard to show live ETA/speed)
      sessionStorage.setItem('climaRoute_navigation_active', '1');

      // Capture initial GPS coordinates
      setError(null);
      const initialCoords = await getCurrentLocation();
      setNavigationStartCoords(initialCoords);
      setUserPosition(initialCoords);

      // Create an in-progress history entry so fleet monitor can pick it up
      try {
        if (routeData && selectedRouteIndex !== null) {
          const selectedRoute = routeData.alternatives[selectedRouteIndex];
          const tripData: any = {
            routeId: `TRIP-${Date.now()}`,
            date: (new Date()).toISOString().split('T')[0],
            startTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            endTime: "",
            origin: origin,
            destination: dest,
            originLat: initialCoords[0],
            originLon: initialCoords[1],
            destinationLat: selectedRoute?.geometry?.slice(-1)[0]?.[0] || null,
            destinationLon: selectedRoute?.geometry?.slice(-1)[0]?.[1] || null,
            weather: (selectedRoute?.condition || currentWeather?.condition || "Unknown"),
            weatherCondition: (selectedRoute?.condition || currentWeather?.condition || "Unknown"),
            temperature: currentWeather?.temperature,
            humidity: currentWeather?.humidity,
            windSpeed: currentWeather?.wind_speed,
            rainProbability: selectedRoute?.rainProbability ?? currentWeather?.rain_prob,
            distance: `${(selectedRoute?.distance / 1000).toFixed(2)}`,
            status: "InProgress",
            driverEmail: localStorage.getItem('userEmail') || 'user@gami.com',
            currentLat: initialCoords[0],
            currentLon: initialCoords[1],
            eta: localStorage.getItem('climaRoute_eta') || undefined
          };

          const resp = await apiService.saveDeliveryTrip(tripData);
          if (resp && resp.tripId) {
            setActiveTripId(resp.tripId);
            localStorage.setItem('climaRoute_tripId', String(resp.tripId));
          }
        }
      } catch (err) { console.warn('Failed to create in-progress trip', err); }
      
      // GPS Watch (no mock fallback)
      watchIdRef.current = navigator.geolocation?.watchPosition(
        async (pos) => {
          setUserPosition([pos.coords.latitude, pos.coords.longitude]);
          // Update live speed (if available) and ETA in sessionStorage so Dashboard can read
          const speedMs = pos.coords.speed; // meters/sec
          if (typeof speedMs === 'number' && !isNaN(speedMs)) {
            const kmh = Math.round(speedMs * 3.6);
            localStorage.setItem('climaRoute_liveSpeed', String(kmh));

            // push telemetry to backend if we have an active trip
            try {
              const tid = activeTripId || (parseInt(localStorage.getItem('climaRoute_tripId') || '0') || null);
              if (tid) await apiService.updateHistory(tid, { currentLat: pos.coords.latitude, currentLon: pos.coords.longitude, speed: Math.round(kmh), eta: localStorage.getItem('climaRoute_eta') || undefined, status: 'InProgress' });
            } catch (err) { console.warn('telemetry update failed', err); }
          }

          // Compute remaining ETA from selected route if available
          try {
            if (routeData && selectedRouteIndex !== null) {
              const route = routeData.alternatives[selectedRouteIndex];
              const totalSec = Math.round(route.duration || 0);
              const elapsedMs = tripStartTime ? (Date.now() - tripStartTime.getTime()) : 0;
              const remainingSec = Math.max(0, totalSec - Math.round(elapsedMs / 1000));
              const mins = Math.floor(remainingSec / 60);
              const timeString = `${mins} min`;
              localStorage.setItem('climaRoute_eta', timeString);

              // also update backend ETA
              try {
                const tid = activeTripId || (parseInt(localStorage.getItem('climaRoute_tripId') || '0') || null);
                if (tid) await apiService.updateHistory(tid, { eta: timeString });
              } catch (e) { }
            }
          } catch {}
        },
        (err) => {
          // Suppress GPS error spam in console
          if (err.code === 1) {
            setError("Location permission denied. Please enable GPS.");
          } else if (err.code === 2) {
            setError("GPS unavailable. Using last known position.");
          }
          // Don't spam console with GPS errors on laptops
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      ) as any;
  };

  // Stop navigation but keep route visible
  const stopNavigation = async () => {
      setIsNavigating(false);
      setTimeLeft(TIMER_START);
      setTripStartTime(null);
      setActiveTripId(null);
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      
      // Clear only navigation-related values, keep route data
      localStorage.removeItem('climaRoute_navigation_active');
      localStorage.removeItem('climaRoute_liveSpeed');
      localStorage.removeItem('climaRoute_eta');
      localStorage.removeItem('climaRoute_tripId');
      localStorage.removeItem('climaRoute_tripStartTime');
      localStorage.removeItem('climaRoute_timeLeft');
      localStorage.removeItem('climaRoute_navStartCoords');
  };

  const handleTogglePause = async () => {
    const newMode = !breakModeActive;
    setBreakModeActive(newMode);
    
    // Update backend status
    try {
      const tid = activeTripId || (parseInt(localStorage.getItem('climaRoute_tripId') || '0') || null);
      if (tid) {
        await apiService.updateHistory(tid, { 
          status: newMode ? 'Paused' : 'InProgress' 
        });
      }
    } catch (err) {
      console.error("Failed to update pause status", err);
    }
  };

  const handleResetNavigation = async () => {
    if (!window.confirm("Are you sure you want to reset? This will cancel the current navigation.")) return;
    
    try {
      const tid = activeTripId || (parseInt(localStorage.getItem('climaRoute_tripId') || '0') || null);
      if (tid) {
        await apiService.updateHistory(tid, { status: 'Cancelled' });
      }
    } catch (err) {
      console.error("Failed to cancel trip", err);
    }
    
    await stopNavigation();
    
    // Also clear route data to return to "Plan Your Journey" state
    setRouteData(null);
    setSelectedRouteIndex(null);
    localStorage.removeItem('climaRoute_data');
    localStorage.removeItem('climaRoute_selectedRoute');
  };

  // Complete trip, save to database, and clear everything
  const completeAndSave = async () => {
      // Confirmation dialog
      if (!window.confirm("Are you sure you want to complete and save this journey?")) {
        return;
      }

      const endTime = new Date();
      const tid = activeTripId || parseInt(localStorage.getItem('climaRoute_tripId') || '0') || null;
      const driverEmail = localStorage.getItem('userEmail') || 'user@gami.com';

      console.log('[CompleteAndSave] Starting completion for tripId:', tid, 'driverEmail:', driverEmail);

      // STEP 1: Call backend API to update database (MANDATORY)
      let completionSuccess = false;
      let completionError = '';

      try {
        const completionResult = await apiService.completeNavigation({
          tripId: tid || undefined,
          driverEmail: driverEmail,
          endTime: endTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          currentLat: userPosition?.[0] || routeData?.endCoords?.lat,
          currentLon: userPosition?.[1] || routeData?.endCoords?.lon
        });
        
        console.log('[CompleteAndSave] API Response:', completionResult);
        
        if (completionResult && completionResult.success) {
          completionSuccess = true;
          console.log('[CompleteAndSave] ✅ Trip completed successfully! Status:', completionResult.status);
        } else {
          completionError = completionResult?.error || 'Unknown error';
          console.error('[CompleteAndSave] ❌ API returned failure:', completionResult);
        }
      } catch (err: any) {
        console.error('[CompleteAndSave] ❌ API Error:', err);
        completionError = err.message || 'Network error';
        
        // Fallback: Try updateHistory if completeNavigation fails
        if (tid) {
          try {
            console.log('[CompleteAndSave] Trying fallback updateHistory for tripId:', tid);
            const fallbackResult = await apiService.updateHistory(tid, { 
              status: 'Completed', 
              tripStatus: 'Completed',
              endTime: endTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
              speed: 0
            });
            
            // updateHistory returns { success: true, ... } on success
            if (fallbackResult && (fallbackResult.success || fallbackResult.status === 'Completed')) {
              completionSuccess = true;
              completionError = '';
              console.log('[CompleteAndSave] ✅ Fallback succeeded:', fallbackResult);
            }
          } catch (fallbackErr) {
            console.error('[CompleteAndSave] ❌ Fallback also failed:', fallbackErr);
          }
        }
      }

      // STEP 2: Only proceed with UI cleanup if DB update succeeded
      if (!completionSuccess) {
        alert(`Failed to complete journey: ${completionError}\n\nPlease try again or check your connection.`);
        return; // DO NOT clear state if DB update failed
      }

      // STEP 3: DB update confirmed - now safe to clear UI state
      console.log('[CompleteAndSave] ✅ DB confirmed - clearing local state');
      
      setIsNavigating(false);
      setTimeLeft(TIMER_START);
      setTripStartTime(null);
      setNavigationStartCoords(null);
      setActiveTripId(null);
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      
      // Clear all route data and reset to initial state
      setRouteData(null);
      setSelectedRouteIndex(null);
      setUserPosition(null);
      setCurrentWeather(null);
      setDistanceToDestination(null);
      
      // Clear navigation values and route data from localStorage
      localStorage.removeItem('climaRoute_navigation_active');
      localStorage.removeItem('climaRoute_liveSpeed');
      localStorage.removeItem('climaRoute_eta');
      localStorage.removeItem('climaRoute_tripId');
      localStorage.removeItem('climaRoute_tripStartTime');
      localStorage.removeItem('climaRoute_timeLeft');
      localStorage.removeItem('climaRoute_navStartCoords');
      localStorage.removeItem('climaRoute_data');
      localStorage.removeItem('climaRoute_userPosition');
      localStorage.removeItem('climaRoute_selectedRoute');
      localStorage.removeItem('climaRoute_weather');
      
      // Clear session storage navigation flag
      sessionStorage.removeItem('climaRoute_navigation_active');
      sessionStorage.removeItem('climaRoute_liveSpeed');
      sessionStorage.removeItem('climaRoute_eta');
      sessionStorage.removeItem('climaRoute_routeSegments');

      // Show success message
      alert('✅ Journey completed and saved successfully!');
  };

    const handleUseCurrentLoc = async () => {
      setOrigin("Fetching location...");
      setError(null);
      try {
        const coords = await getCurrentLocation();
        const addr = await getAddressName(coords[0], coords[1]);
        setOrigin(addr);
        setOriginAddress(addr);
      } catch (err) {
        setError("Could not get location");
        setOrigin("");
      }
    };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
       <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Dynamic Re-Routing</h2>
        <p className="text-sm text-slate-500 mt-1">AI-Powered Weather Navigation</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        <div className="lg:col-span-2 bg-gray-200 rounded-xl overflow-hidden relative shadow-inner min-h-[400px] border border-gray-300">
           
           {/* LIVE LOCATION DISPLAY (Top-Left) - Shows human-readable location name */}
           {userPosition && (
               <LiveLocationOverlay lat={userPosition[0]} lon={userPosition[1]} />
           )}

           {/* GPS OFF RED BLINK (if navigating but no GPS) */}
           {isNavigating && !userPosition && (
               <div className="absolute top-4 left-4 z-[1000] px-4 py-2 rounded-lg shadow-lg border border-red-500 bg-red-50 animate-pulse">
                   <span className="text-[10px] uppercase font-bold text-red-600 tracking-wider">🔴 GPS Offline</span>
               </div>
           )}

           {/* TIMER OVERLAY */}
           {isNavigating && (
               <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-lg border border-blue-200 flex flex-col items-center animate-in fade-in zoom-in">
                   <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Auto-Check In</span>
                   <div className={`text-2xl font-mono font-bold ${timeLeft <= 3 ? 'text-red-500 animate-ping' : 'text-blue-600'}`}>00:{formatTime(timeLeft)}</div>
                   {isAutoRerouting && <span className="text-xs text-green-600 font-bold mt-1 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> Optimizing...</span>}
               </div>
           )}

           {/* TOAST MESSAGE */}
           {rerouteMessage && (
               <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl text-center font-bold text-sm animate-in slide-in-from-top-4 fade-in flex items-center gap-2">
                   <AlertTriangle className="text-yellow-400" size={18} /> {rerouteMessage}
               </div>
           )}

           <MapContainer key={routeData ? `map-loaded` : 'map-init'} center={[13.0827, 80.2707]} zoom={7} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <SmartMapClickHandler />
                  {routeData && (
                <>
                  {!isNavigating && <FitBounds routeData={routeData} />}
                  <Marker position={[routeData.startCoords.lat, routeData.startCoords.lon]} icon={startIcon}><Popup>Start: {origin}</Popup></Marker>
                  <Marker position={[routeData.endCoords.lat, routeData.endCoords.lon]} icon={endIcon}><Popup>Dest: {dest}</Popup></Marker>
                  {userPosition && <Marker position={userPosition} icon={truckIcon} zIndexOffset={1000}><Popup>Your Truck</Popup></Marker>}
                  
                  {routeData.alternatives?.map((route: any, index: number) => {
                      const isSelected = selectedRouteIndex === index;
                      // Color Logic: Green if navigating & selected. Blue if planning & selected. Gray otherwise.
                      const lineColor = isSelected ? (isNavigating ? "#16a34a" : "#2563eb") : "#9ca3af";
                      
                      // Calculate risk color based on safety score
                      const getRiskColor = (score: number) => {
                        if (score >= 70) return '#22c55e'; // Green
                        if (score >= 50) return '#f59e0b'; // Orange
                        return '#ef4444'; // Red
                      };

                      return (
                        <Polyline 
                          key={index} positions={route.geometry} 
                          eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); if(!isNavigating) setSelectedRouteIndex(index); }}}
                          pathOptions={{ color: lineColor, weight: isSelected ? 8 : 6, opacity: isSelected ? 1 : 0.5, zIndex: isSelected ? 1000 : 1 }}
                        >
                           <Popup>
                             <div className="text-center p-3 min-w-[200px]">
                               <strong className="text-lg block mb-2 text-gray-800">{isSelected ? "✅ Active Path" : `Route ${index + 1}`}</strong>
                               <div className="text-sm space-y-2 mb-3 bg-gray-50 p-3 rounded">
                                 <div className="flex justify-between">
                                   <span className="text-gray-600">Safety Score:</span>
                                   <b style={{ color: getRiskColor(route.safetyScore) }}>{route.safetyScore}/100</b>
                                 </div>
                                 <div className="flex justify-between">
                                   <span className="text-gray-600">Distance:</span>
                                   <b>{(route.distance / 1000).toFixed(1)} km</b>
                                 </div>
                                 <div className="flex justify-between">
                                   <span className="text-gray-600">Duration:</span>
                                   <b>{Math.round(route.duration / 60)} min</b>
                                 </div>
                                 <div className="flex justify-between">
                                   <span className="text-gray-600">Rain Prob:</span>
                                   <b className="text-blue-600">{(route.rainProbability || 0).toFixed(1)}%</b>
                                 </div>
                               </div>
                               {!isSelected && !isNavigating && <button onClick={() => setSelectedRouteIndex(index)} className="bg-blue-600 text-white text-xs px-3 py-2 rounded-full w-full font-bold hover:bg-blue-700 transition-colors">Select This Path</button>}
                             </div>
                           </Popup>
                        </Polyline>
                      );
                    })}
                </>
              )}
           </MapContainer>
        </div>

        <Card title="Plan Your Journey" className="h-fit">
          <div className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 items-start">
                <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
            <div className="space-y-3">
              <div><label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Origin</label><div className="flex gap-2"><Input className="text-sm py-2" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Type address..." /><button onClick={handleUseCurrentLoc} className="p-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 transition-colors" title="Get current location"><Crosshair size={18} /></button></div><small className="text-[11px] text-gray-400 block mt-1">{originAddress}</small></div>
              <div><label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Destination</label><div className="relative"><Input className="text-sm py-2" value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Click map or type address..." /><MapPin size={14} className="absolute right-3 top-3 text-gray-400" /></div><small className="text-[11px] text-gray-400 block mt-1">{destAddress}</small></div>
              {/* Mock GPS toggle removed from UI per request; mock remains enabled when no sensor. */}
            </div>
            
            {!isNavigating ? (
                <div className="space-y-3">
                    <Button className="w-full justify-center py-2 text-sm" onClick={handleFindRoutes} disabled={loading}>{loading ? "Analyzing Routes..." : "1. Find Routes"}</Button>
                    
                    {routeData && selectedRouteIndex === null && (
                        <div className="text-center p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-200 flex items-center justify-center gap-2 animate-pulse">
                            <MousePointerClick size={16}/> Please select a route (Gray Line) on the map.
                        </div>
                    )}

                    {selectedRouteIndex !== null && routeData && (
                        <div className="animate-fade-in space-y-3">
                            <div className="bg-blue-50 p-2 rounded-lg border border-blue-200 shadow-sm text-sm">
                              <p className="text-[11px] text-blue-600 font-bold uppercase mb-2">Selected Path Details</p>
                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 mb-2">
                                    <div>
                                  <span className="text-gray-500 text-[11px]">Safety</span>
                                  <p className="text-base font-bold text-green-600">{Math.round(routeData.alternatives[selectedRouteIndex].safetyScore)}/100</p>
                                    </div>
                                    <div>
                                  <span className="text-gray-500 text-[11px]">Distance</span>
                                  <p className="text-base font-bold text-blue-600">{(routeData.alternatives[selectedRouteIndex].distance / 1000).toFixed(1)} km</p>
                                    </div>
                                    <div>
                                  <span className="text-gray-500 text-[11px]">Duration</span>
                                  <p className="text-base font-bold text-orange-600">{Math.round(routeData.alternatives[selectedRouteIndex].duration / 60)} min</p>
                                    </div>
                                    <div>
                                  <span className="text-gray-500 text-[11px]">Rain Prob</span>
                                  <p className="text-base font-bold text-purple-600">{(routeData.alternatives[selectedRouteIndex].rainProbability || 0).toFixed(1)}%</p>
                                    </div>
                                </div>
                            </div>
                            <Button className="w-full justify-center py-2 text-sm bg-green-600 hover:bg-green-700 shadow-md shadow-green-200" onClick={startNavigation}>
                              <Navigation className="mr-2" size={16}/> 2. Start Live Navigation
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="p-3 bg-green-50 rounded-lg text-center border border-green-200">
                        <p className="text-green-800 font-bold text-xs uppercase mb-1">Live Tracking Active</p>
                        <p className="text-[11px] text-green-700 mb-1">Auto-reroute active (Test: 10s)</p>
                        {distanceToDestination !== null && (
                          <p className="text-[10px] text-gray-500 mt-1">Distance to destination: {distanceToDestination < 1000 ? `${Math.round(distanceToDestination)}m` : `${(distanceToDestination/1000).toFixed(1)}km`}</p>
                        )}
                    </div>
                    
                    {/* 1. Complete & Save - Only visible when within 100m of destination */}
                    {isNearDestination && (
                      <div className="space-y-2">
                        <div 
                          className="p-3 bg-green-100 rounded-lg text-center border border-green-300"
                          style={{
                            animation: 'pulseGlow 2s ease-in-out infinite'
                          }}
                        >
                          <style>{`
                            @keyframes pulseGlow {
                              0%, 100% { opacity: 1; background-color: rgb(220 252 231); }
                              50% { opacity: 0.7; background-color: rgb(187 247 208); }
                            }
                          `}</style>
                          <p className="text-green-700 font-semibold text-sm flex items-center justify-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            You are near the destination.
                          </p>
                          <p className="text-green-600 text-xs mt-1">Do you want to complete your journey?</p>
                        </div>
                        <Button className="w-full justify-center py-2 text-sm bg-emerald-600 hover:bg-emerald-700 shadow-md" onClick={completeAndSave}>
                            <Navigation className="mr-2" size={16}/> Complete & Save
                        </Button>
                      </div>
                    )}
                    
                    {/* 2. Pause/Resume */}
                    <Button 
                        className={`w-full justify-center py-2 text-sm shadow-md ${breakModeActive ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-500 hover:bg-amber-600'}`} 
                        onClick={handleTogglePause}
                    >
                        {breakModeActive ? <><Play className="mr-2" size={16}/> Resume Navigation</> : <><Pause className="mr-2" size={16}/> Pause / Break</>}
                    </Button>
                    
                    {/* 3. Reset */}
                    <Button className="w-full justify-center py-2 text-sm bg-red-600 hover:bg-red-700 shadow-md" onClick={handleResetNavigation}>
                        <RotateCcw className="mr-2" size={16}/> Reset Navigation
                    </Button>
                </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}