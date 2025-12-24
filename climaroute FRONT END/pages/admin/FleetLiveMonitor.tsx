import React, { useEffect, useState, useRef } from 'react';
import { Card } from '../../components/Layout';
import { MapPin, Navigation, Clock, Route as RouteIcon, RefreshCw, Truck } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle } from 'react-leaflet';
import { apiService, getCurrentUser } from '../../services/apiservice';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom truck icon for vehicles
const TruckIcon = L.divIcon({
    html: `<div style="background: #3b82f6; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
        </svg>
    </div>`,
    className: 'custom-truck-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

// Destination marker icon
const DestinationIcon = L.divIcon({
    html: `<div style="background: #ef4444; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#ef4444"/>
        </svg>
    </div>`,
    className: 'custom-dest-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});

// Origin marker icon
const OriginIcon = L.divIcon({
    html: `<div style="background: #22c55e; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
        <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
    </div>`,
    className: 'custom-origin-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
});

// --- Helper Component to Move Map (ONCE per vehicle selection) ---
function FlyToLocation({ center, vehicleId }: { center: [number, number] | null; vehicleId: number | null }) {
  const map = useMap();
  const lastFlyToRef = useRef<number | null>(null);
  
  useEffect(() => {
    // Only fly to location when a NEW vehicle is selected (not on every position update)
    if (center && vehicleId !== null && vehicleId !== lastFlyToRef.current) {
      map.flyTo(center, 14, { duration: 1.2 });
      lastFlyToRef.current = vehicleId;
    }
  }, [vehicleId]); // Only depend on vehicleId, not center
  
  return null;
}

// Vehicle interface for type safety
interface Vehicle {
  id: number;
  driverName: string;
  driverEmail: string;
  vehicleId: string;
  status: string;
  heading: string;
  lat: number;
  lon: number;
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
  origin: string;
  destination: string;
  distance: string;
  eta: string;
  speed: number;
  routeGeometry?: [number, number][];
  currentLocationName?: string;
  lastUpdated?: string;
}

export default function FleetLiveMonitor() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Use ref to track selected vehicle ID for real-time updates
  const selectedVehicleIdRef = useRef<number | null>(null);

  // Fetch ONLY active (InProgress) fleet data - deduplicated per driver
  const loadFleet = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      // Get current user (admin pages should have admin role)
      const { email, role } = getCurrentUser();
      
      // Use the ACTIVE fleet endpoint (STRICT: only InProgress, deduplicated)
      // Admin sees all fleet, regular users see only their own
      const fleetData = await apiService.getActiveFleet(email, role);
      
      if (fleetData && fleetData.length > 0) {
        const formattedVehicles: Vehicle[] = fleetData.map((v: any) => ({
          id: v.id,
          driverName: v.driverName || v.driverEmail || 'Unknown Driver',
          driverEmail: v.driverEmail || '',
          vehicleId: v.vehicleId || `TRIP-${v.id}`,
          status: 'In Progress', // Always InProgress from this endpoint
          heading: v.heading || 'En Route',
          lat: v.lat || 13.0827,
          lon: v.lon || 80.2707,
          originLat: v.originLat || v.lat || 13.0827,
          originLon: v.originLon || v.lon || 80.2707,
          destLat: v.destLat || 13.1,
          destLon: v.destLon || 80.3,
          origin: v.origin || 'Unknown',
          destination: v.destination || 'Unknown',
          distance: v.distance || 'N/A',
          eta: v.eta || 'Calculating...',
          speed: v.speed || 0,
          routeGeometry: v.routeGeometry || null,
          currentLocationName: v.currentLocationName || 'Location unavailable',
          lastUpdated: v.lastUpdated || new Date().toISOString()
        }));
        
        setVehicles(formattedVehicles);
        setLastUpdate(new Date());
        
        // Auto-select the first vehicle if none selected
        if (formattedVehicles.length > 0 && selectedVehicleIdRef.current === null) {
          handleTruckClick(formattedVehicles[0]);
        }
        
        // Update selected vehicle using ref to avoid stale closure
        if (selectedVehicleIdRef.current !== null) {
          const updated = formattedVehicles.find(v => v.id === selectedVehicleIdRef.current);
          if (updated) {
            setSelectedVehicle(updated);
            setSelectedLocation([updated.lat, updated.lon]);
          } else {
            // Selected vehicle no longer active - clear selection
            selectedVehicleIdRef.current = null;
            setSelectedVehicle(null);
            setSelectedLocation(null);
          }
        }
      } else {
        // No active fleets
        setVehicles([]);
        setLastUpdate(new Date());
        
        // Clear selection if no active vehicles
        if (selectedVehicleIdRef.current !== null) {
          selectedVehicleIdRef.current = null;
          setSelectedVehicle(null);
          setSelectedLocation(null);
        }
      }
    } catch (err) {
      console.error("Failed to load fleet data", err);
      setVehicles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFleet();
    const interval = setInterval(() => loadFleet(), 3000); // Real-time update every 3s
    return () => clearInterval(interval);
  }, []);

  // Handle clicking a truck in the list
  const handleTruckClick = (vehicle: Vehicle) => {
    selectedVehicleIdRef.current = vehicle.id; // Update ref
    setSelectedLocation([vehicle.lat, vehicle.lon]);
    setSelectedVehicle(vehicle);
  };

  // Get route color based on vehicle status
  const getRouteColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'moving': return '#3b82f6'; // blue
      case 'idle': return '#f59e0b'; // amber
      case 'sos': return '#ef4444'; // red
      default: return '#3b82f6';
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-bold text-gray-800">Live Fleet Monitor</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </span>
          <button 
            onClick={() => loadFleet(true)}
            className={`flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all ${refreshing ? 'opacity-70' : ''}`}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>
      
      <div className="flex flex-1 gap-6 min-h-0">
        
        {/* LEFT HALF: Active Vehicles List */}
        <Card className="w-1/2 flex flex-col p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-700">Active Vehicles ({vehicles.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? <p className="text-center text-gray-400">Locating fleet...</p> : vehicles.length === 0 ? (
              <p className="text-center text-gray-400">No active vehicles</p>
            ) : vehicles.map((v) => (
               <div 
                 key={v.id} 
                 onClick={() => handleTruckClick(v)}
                 className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                    selectedVehicle?.id === v.id
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-100 bg-white hover:border-blue-200'
                 }`}
               >
                 <div className="flex items-center gap-4 flex-1">
                   <div className="p-3 bg-white rounded-full shadow-sm text-blue-600">
                     <Navigation size={20} className={v.status === 'Moving' ? '' : 'opacity-50'} />
                   </div>
                   <div className="flex-1">
                     <p className="font-bold text-gray-800">{v.driverName}</p>
                     <p className="text-xs text-gray-500 mb-1">
                       <span className="w-2 h-2 rounded-full inline-block mr-1 bg-green-500 animate-pulse"></span>
                       {v.status} • Speed: {v.speed} km/h
                     </p>
                     <p className="text-xs text-gray-600 flex items-center gap-1">
                       <MapPin size={12} /> {v.origin} → {v.destination}
                     </p>
                   </div>
                 </div>
                 <button className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full whitespace-nowrap">
                   View
                 </button>
               </div>
            ))}
          </div>
        </Card>

        {/* RIGHT HALF: Map + Route Details */}
        <div className="w-1/2 flex flex-col gap-2 min-h-0">
          {/* Map - Takes most of the space */}
          <div className="flex-1 bg-gray-100 rounded-2xl overflow-hidden shadow-inner border border-gray-200 relative min-h-[400px]">
             <MapContainer center={[13.0827, 80.2707]} zoom={10} style={{ height: "100%", width: "100%" }}>
                <TileLayer 
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                
                {/* This component handles the camera movement - ONCE per vehicle selection */}
                <FlyToLocation center={selectedLocation} vehicleId={selectedVehicle?.id ?? null} />

                {/* Only show route and markers for selected vehicle */}
                {selectedVehicle && (
                  <React.Fragment>
                    {/* Route polyline */}
                    {selectedVehicle.routeGeometry && selectedVehicle.routeGeometry.length > 0 && (
                      <Polyline
                        positions={selectedVehicle.routeGeometry as [number, number][]}
                        pathOptions={{
                          color: getRouteColor(selectedVehicle.status),
                          weight: 5,
                          opacity: 0.9
                        }}
                      />
                    )}
                    
                    {/* Origin marker (green) */}
                    <Marker 
                      position={[selectedVehicle.originLat, selectedVehicle.originLon]} 
                      icon={OriginIcon}
                    >
                      <Popup>
                        <strong>Start: {selectedVehicle.origin}</strong>
                      </Popup>
                    </Marker>
                    
                    {/* Destination marker (red) */}
                    <Marker 
                      position={[selectedVehicle.destLat, selectedVehicle.destLon]} 
                      icon={DestinationIcon}
                    >
                      <Popup>
                        <strong>Destination: {selectedVehicle.destination}</strong>
                      </Popup>
                    </Marker>
                    
                    {/* Current vehicle position (truck icon) */}
                    <Marker 
                      position={[selectedVehicle.lat, selectedVehicle.lon]} 
                      icon={TruckIcon}
                    >
                      <Popup>
                        <div className="min-w-[200px]">
                          <strong className="text-blue-600">{selectedVehicle.driverName}</strong><br />
                          <span className="text-xs text-gray-500">{selectedVehicle.vehicleId}</span><br />
                          <hr className="my-1" />
                          <span className="text-green-600">●</span> Status: {selectedVehicle.status}<br />
                          <span>🚗 Speed: {selectedVehicle.speed} km/h</span><br />
                          <span>📍 From: {selectedVehicle.origin}</span><br />
                          <span>🎯 To: {selectedVehicle.destination}</span><br />
                          <span>⏱️ ETA: {selectedVehicle.eta}</span>
                        </div>
                      </Popup>
                    </Marker>
                    
                    {/* Animated pulse circle for current location */}
                    <Circle
                      center={[selectedVehicle.lat, selectedVehicle.lon]}
                      radius={200}
                      pathOptions={{
                        color: '#3b82f6',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.2,
                        weight: 2
                      }}
                    />
                  </React.Fragment>
                )}
             </MapContainer>
             
             {/* Prompt to select vehicle */}
             {!selectedVehicle && (
               <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-[999]">
                 <div className="bg-white/95 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg text-center">
                   <Navigation size={32} className="mx-auto text-blue-500 mb-2" />
                   <p className="font-bold text-gray-700">Select a Vehicle</p>
                   <p className="text-sm text-gray-500">Click on a vehicle from the list to view its route</p>
                 </div>
               </div>
             )}
          </div>

          {/* Compact Route Details Panel */}
          {selectedVehicle && (
            <Card className="p-3 bg-gradient-to-br from-blue-50 to-white shrink-0">
              <div className="flex items-center gap-4">
                {/* Driver Info */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-blue-100 rounded-full shrink-0">
                    <Truck size={16} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-800 text-sm truncate">{selectedVehicle.driverName}</h3>
                    <p className="text-[10px] text-gray-500 truncate">{selectedVehicle.vehicleId}</p>
                  </div>
                </div>
                
                {/* Route Info */}
                <div className="flex items-center gap-1 text-xs text-gray-600 min-w-0 flex-1">
                  <MapPin size={12} className="text-green-600 shrink-0" />
                  <span className="truncate">{selectedVehicle.origin}</span>
                  <span className="text-gray-400">→</span>
                  <MapPin size={12} className="text-red-600 shrink-0" />
                  <span className="truncate">{selectedVehicle.destination}</span>
                </div>
                
                {/* Stats */}
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase">Speed</p>
                    <p className="font-bold text-gray-800">{selectedVehicle.speed} km/h</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase">ETA</p>
                    <p className="font-bold text-gray-800">{selectedVehicle.eta}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase">Dist</p>
                    <p className="font-bold text-gray-800">{selectedVehicle.distance}</p>
                  </div>
                </div>
                
                {/* Status Badge */}
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                  selectedVehicle.status.toLowerCase().includes('progress') 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {selectedVehicle.status}
                </span>
              </div>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
}