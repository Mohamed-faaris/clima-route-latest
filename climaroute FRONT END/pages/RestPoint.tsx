import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Select } from '../components/Layout';
import { 
    MapPin, Coffee, Fuel, Navigation, Loader, 
    AlertTriangle, Phone, Info, Truck
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from 'react-leaflet';
import { apiService } from '../services/apiservice';
import { useSettings } from '../contexts/SettingsContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet Icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
});

const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const restPointIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// Navigation vehicle icon - truck design
const navigationVehicleIcon = L.divIcon({
    html: `<div style="background: #3b82f6; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
        </svg>
    </div>`,
    className: 'custom-vehicle-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

function FitBounds({ coords }: { coords: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (coords) {
            map.setView(coords, 12);
        }
    }, [coords, map]);
    return null;
}

export function RestPoint() {
    const { settings } = useSettings();
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [userLocationName, setUserLocationName] = useState<string>("Fetching location...");
    const [isLocationLoading, setIsLocationLoading] = useState(true);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedRestPoint, setSelectedRestPoint] = useState<any>(null);
    const [navigatingTo, setNavigatingTo] = useState<any>(null);
    const [navigationRoute, setNavigationRoute] = useState<any>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const gpsWatchIdRef = useRef<number | null>(null);
    const locationCacheRef = useRef<{ [key: string]: string }>({});

    // Helper: Get location name from coordinates with caching
    const getLocationName = async (lat: number, lon: number): Promise<string> => {
        // Create cache key (rounded to 3 decimal places to avoid excessive API calls)
        const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
        
        // Return cached result if available
        if (locationCacheRef.current[cacheKey]) {
            return locationCacheRef.current[cacheKey];
        }

        try {
            // Request in English and fallback to English names
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=en&namedetails=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data || !data.address) {
                return "Location unavailable";
            }
            
            const addr = data.address;
            
            // Extract location components - prioritize area/neighborhood for specificity
            const area = addr.suburb || addr.neighbourhood || addr.hamlet;
            const city = addr.city || addr.town || addr.village || addr.county || addr.municipality;
            const state = addr.state || addr.province;
            const country = addr.country;
            
            // Build a friendly location name with area if available
            let locationName: string;
            if (area && city && state) {
                locationName = `${area}, ${city}, ${state}`;
            } else if (city && state) {
                locationName = `${city}, ${state}`;
            } else if (city && country) {
                locationName = `${city}, ${country}`;
            } else if (city) {
                locationName = city;
            } else if (state && country) {
                locationName = `${state}, ${country}`;
            } else if (state) {
                locationName = state;
            } else if (country) {
                locationName = country;
            } else {
                locationName = "Location unavailable";
            }
            
            // Cache the result
            locationCacheRef.current[cacheKey] = locationName;
            return locationName;
        } catch (e) {
            console.error("Reverse geocoding failed:", e);
            return "Unable to resolve location";
        }
    };

    // Get user's current location
    useEffect(() => {
        const fetchLocation = async () => {
            setIsLocationLoading(true);
            setUserLocationName("Fetching location...");

            if (!navigator.geolocation) {
                setUserLocationName("GPS not supported - Using default location");
                const defaultCoords: [number, number] = [13.0827, 80.2707];
                setUserLocation(defaultCoords);
                const name = await getLocationName(defaultCoords[0], defaultCoords[1]);
                setUserLocationName(name || "Chennai, Tamil Nadu");
                setIsLocationLoading(false);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                    setUserLocation(coords);
                    
                    // Get human-readable location name
                    setUserLocationName("Resolving place name...");
                    const locationName = await getLocationName(coords[0], coords[1]);
                    setUserLocationName(locationName);
                    setIsLocationLoading(false);
                },
                async (err) => {
                    console.warn("GPS Error:", err.message);
                    
                    // Fallback to Chennai default location
                    const defaultCoords: [number, number] = [13.0827, 80.2707];
                    setUserLocation(defaultCoords);
                    
                    // Show error briefly, then resolve fallback location name
                    if (err.code === 1) {
                        setUserLocationName("Location permission denied");
                    } else if (err.code === 2) {
                        setUserLocationName("GPS unavailable");
                    } else {
                        setUserLocationName("Location timeout");
                    }
                    
                    // After short delay, show fallback location name
                    setTimeout(async () => {
                        const fallbackName = await getLocationName(defaultCoords[0], defaultCoords[1]);
                        setUserLocationName(`${fallbackName} (Default)`);
                        setIsLocationLoading(false);
                    }, 1500);
                },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
            );
        };

        fetchLocation();
    }, []);

    // Search for rest points based on current location
    const handleSearch = async () => {
        if (!userLocation) {
            alert("Please enable GPS to find nearby rest points");
            return;
        }

        setLoading(true);
        setHasSearched(true);
        try {
            // Call backend to find real rest points
            const data = await apiService.getRestPoints(userLocation[0], userLocation[1]);
            if (data && data.restPoints) {
                // Sort by distance
                const sorted = data.restPoints.sort((a: any, b: any) => a.distance - b.distance);
                setResults(sorted);
            } else {
                setResults([]);
            }
        } catch (err) {
            console.error("Failed to load rest points", err);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    // Start real-time navigation to a rest point
    const handleNavigate = async (restPoint: any) => {
        if (!userLocation) return;

        setNavigatingTo(restPoint);
        setIsNavigating(true);

        try {
            // Get route from user location to rest point
            const data = await apiService.optimizeRoute(
                `${userLocation[0]},${userLocation[1]}`,
                `${restPoint.lat},${restPoint.lon}`
            );

            if (data?.alternatives && data.alternatives.length > 0) {
                setNavigationRoute(data.alternatives[0]); // Use first route
            }

            // Start GPS tracking for live navigation
            if (navigator.geolocation) {
                gpsWatchIdRef.current = navigator.geolocation.watchPosition(
                    (pos) => {
                        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
                    },
                    (err) => console.log("GPS Error:", err),
                    { enableHighAccuracy: true, maximumAge: 0 }
                );
            }
        } catch (err) {
            console.error("Navigation failed:", err);
            setIsNavigating(false);
        }
    };

    // Stop navigation
    const handleStopNavigation = () => {
        setIsNavigating(false);
        setNavigatingTo(null);
        setNavigationRoute(null);
        if (gpsWatchIdRef.current) {
            navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        }
    };

    return (
        <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Weather-Aware Rest Points</h2>
                <p className="text-sm text-slate-500 mt-1">Smart rest stop suggestions based on real-time weather conditions</p>
            </div>

            {/* TOP: Map Section */}
            <div className="h-1/2 bg-gray-200 rounded-xl relative overflow-hidden shadow-inner border border-gray-300">
                {userLocation ? (
                    <MapContainer center={userLocation} zoom={12} style={{ height: "100%", width: "100%" }}>
                        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <FitBounds coords={userLocation} />
                        
                        {/* User Location Marker */}
                        {isNavigating ? (
                            <Marker position={userLocation} icon={navigationVehicleIcon}>
                                <Popup>Your Current Location</Popup>
                            </Marker>
                        ) : (
                            <Marker position={userLocation} icon={userIcon}>
                                <Popup>Your Location</Popup>
                            </Marker>
                        )}

                        {/* Rest Points on Map */}
                        {results.map((point: any, idx: number) => (
                            (!isNavigating || navigatingTo?.id === point.id) && (
                            <Marker 
                                key={idx} 
                                position={[point.lat, point.lon]} 
                                icon={restPointIcon}
                                eventHandlers={{
                                    click: () => setSelectedRestPoint(point),
                                }}
                            >
                                <Popup>
                                    <div className="text-center">
                                        <h4 className="font-bold text-gray-800">{point.name}</h4>
                                        <p className="text-sm text-gray-600">{point.type}</p>
                                        <p className="text-xs text-blue-600 mt-1">{settings.distanceUnit === 'km' ? point.distance.toFixed(1) : (point.distance * 0.621371).toFixed(1)} {settings.distanceUnit === 'km' ? 'km' : 'mi'} away</p>
                                    </div>
                                </Popup>
                            </Marker>
                            )
                        ))}

                        {/* Navigation Route */}
                        {navigationRoute && navigationRoute.geometry && (
                            <Polyline 
                                positions={navigationRoute.geometry} 
                                pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.8 }}
                            />
                        )}
                    </MapContainer>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <Loader size={48} className="animate-spin opacity-40" />
                    </div>
                )}
            </div>

            {/* BOTTOM: Controls & Results */}
            <div className="h-1/2 flex flex-col gap-4 min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                    {/* LEFT: Search Controls */}
                    <Card className="lg:col-span-1 h-fit">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
                                    <MapPin size={12} className="inline mr-1" /> Your Location
                                </label>
                                <div className={`p-3 rounded-lg border text-sm ${isLocationLoading ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
                                    <div className="flex items-center gap-2">
                                        {isLocationLoading && (
                                            <Loader size={14} className="animate-spin text-blue-500 flex-shrink-0" />
                                        )}
                                        <span className={`font-semibold ${isLocationLoading ? 'text-gray-500' : 'text-gray-700'}`}>
                                            {userLocationName}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {!isNavigating ? (
                                <Button 
                                    className="w-full" 
                                    onClick={handleSearch} 
                                    disabled={loading || !userLocation}
                                >
                                    {loading ? 'Searching...' : 'Find Rest Points'}
                                </Button>
                            ) : (
                                <Button 
                                    className="w-full bg-red-600 hover:bg-red-700" 
                                    onClick={handleStopNavigation}
                                >
                                    Stop Navigation
                                </Button>
                            )}
                        </div>
                    </Card>

                    {/* RIGHT: Results List */}
                    <div className="lg:col-span-2 overflow-y-auto">
                        {!hasSearched ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                <Coffee size={48} className="mb-4 opacity-50" />
                                <p className="font-bold">Click "Find Rest Points" to search</p>
                            </div>
                        ) : loading ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader size={32} className="animate-spin text-blue-600" />
                            </div>
                        ) : results.length > 0 ? (
                            <div className="space-y-3">
                                {results.map((spot: any, idx: number) => (
                                    (!isNavigating || navigatingTo?.id === spot.id) && (
                                    <div 
                                        key={idx} 
                                        className={`p-4 cursor-pointer transition-all border-2 rounded-lg ${selectedRestPoint?.id === spot.id ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:border-blue-300'}`}
                                        onClick={() => setSelectedRestPoint(spot)}
                                    >
                                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                                                        {spot.type?.includes('Coffee') ? <Coffee size={20} /> : <Fuel size={20} />}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-800">{spot.name}</h4>
                                                        <p className="text-xs text-gray-500">{spot.type}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                                                    <span>📍 {settings.distanceUnit === 'km' ? spot.distance.toFixed(1) : (spot.distance * 0.621371).toFixed(1)} {settings.distanceUnit === 'km' ? 'km' : 'mi'} away</span>
                                                    <span>⏱️ {spot.duration ? `${(spot.duration/60).toFixed(0)} min` : 'N/A'}</span>
                                                </div>
                                            </div>
                                            <Button 
                                                className="min-w-[140px]"
                                                onClick={() => {
                                                    handleNavigate(spot);
                                                }}
                                                disabled={isNavigating}
                                            >
                                                <Navigation size={16} className="mr-2" />
                                                {isNavigating && navigatingTo?.id === spot.id ? 'Navigating...' : 'Navigate'}
                                            </Button>
                                        </div>
                                    </div>
                                    )
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                <AlertTriangle size={48} className="mb-4 opacity-50" />
                                <p>No rest points found nearby</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Live Navigation Status */}
            {isNavigating && navigatingTo && (
                <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-pulse">
                    <Navigation size={20} />
                    <span className="font-bold">Live Navigation to {navigatingTo.name}</span>
                </div>
            )}
        </div>
    );
}