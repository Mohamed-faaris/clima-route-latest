import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Activity, MapPin, TrendingUp, CloudRain, Sun, Wind, AlertTriangle, Navigation, Crosshair } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useSettings, formatTime } from '../contexts/SettingsContext';

// --- STYLED COMPONENTS ---
const DashboardCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
    {children}
  </div>
);

// Haversine distance calculator
function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function AdaptiveSpeed() {
   const { settings } = useSettings();
   const [segments, setSegments] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   
   const [tripData, setTripData] = useState({ 
       origin: "Not Started", 
       destination: "Not Started", 
       distance: 0 
   });
  
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [currentPlace, setCurrentPlace] = useState<string>("Acquiring...");
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [traveledDistance, setTraveledDistance] = useState<number>(0);
  const [speedHistory, setSpeedHistory] = useState<Array<{ time: string; speed: number; distance: number }>>([]);
  const watchRef = useRef<number | null>(null);
  const prevPositionRef = useRef<[number, number] | null>(null);

  // Helper: Get location name from coordinates
  const getReverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await response.json();
      const addr = data.address;
      return addr.city || addr.town || addr.village || addr.suburb || addr.county || addr.road || "Location unavailable";
    } catch (e) {
      return "Location unavailable";
    }
  };

   // Helper for Weather Icons
   const getWeatherIcon = (condition: string) => {
       if (!condition) return <Wind size={18} className="text-gray-400"/>;
       const cond = condition.toLowerCase();
       if (cond.includes("heavy") || cond.includes("storm")) return <CloudRain size={18} className="text-blue-700"/>;
       if (cond.includes("rain") || cond.includes("drizzle")) return <CloudRain size={18} className="text-blue-400"/>;
       if (cond.includes("cloud")) return <Wind size={18} className="text-gray-400"/>;
       return <Sun size={18} className="text-yellow-500"/>;
   };

   // --- 1. LOAD ROUTE SEGMENT DATA FROM SESSIONSTORAGE ---
   useEffect(() => {
       const loadSegments = async () => {
           setLoading(true);
           setError(null);
           
           // Check if navigation is active
           const isNavigating = localStorage.getItem('climaRoute_navigation_active') === '1';
           
           if (!isNavigating) {
               setError("No active navigation. Please start navigation from Dynamic Re-Routing page.");
               setLoading(false);
               return;
           }
           
           // Load route segments from sessionStorage
           const segmentsData = sessionStorage.getItem('climaRoute_routeSegments');
           
           if (!segmentsData) {
               setError("No route data found. Please select and start a route from Dynamic Re-Routing page.");
               setLoading(false);
               return;
           }
           
           try {
               const routeData = JSON.parse(segmentsData);
               
               setTripData({
                   origin: routeData.origin || "Unknown",
                   destination: routeData.destination || "Unknown",
                   distance: routeData.totalDistance || 0
               });
               
               // Fetch weather predictions from Python model for all segments
               const response = await fetch('http://localhost:5001/segment_weather', {
                   method: 'POST',
                   headers: {
                       'Content-Type': 'application/json',
                   },
                   body: JSON.stringify({
                       segments: routeData.segments.map((seg: any) => ({
                           lat: seg.lat,
                           lon: seg.lon,
                           name: seg.name
                       }))
                   })
               });
               
               if (!response.ok) {
                   throw new Error('Failed to fetch weather predictions from AI model');
               }
               
               const weatherData = await response.json();
               
               // Merge route segments with weather data
               const enhancedSegments = weatherData.segments.map((seg: any, index: number) => {
                   // Determine segment type based on position
                   let type = "Highway";
                   if (index === 0) type = "Start";
                   else if (index === weatherData.segments.length - 1) type = "Destination";
                   else if (index === Math.floor(weatherData.segments.length / 2)) type = "Mid-Point";
                   
                   return {
                       ...seg,
                       type: type,
                       weather: `${seg.condition} (${Math.round(seg.temperature)}°C)`,
                       rawCondition: seg.condition
                   };
               });
               
               setSegments(enhancedSegments);
               setLoading(false);
               
           } catch (err: any) {
               console.error('Error loading segments:', err);
               setError(`Failed to load route data: ${err.message}`);
               setLoading(false);
           }
       };
       
       loadSegments();
       
       // Reload when navigation status changes
       const interval = setInterval(() => {
           const isNavigating = localStorage.getItem('climaRoute_navigation_active') === '1';
           if (!isNavigating && !error) {
               setError("Navigation ended.");
           }
       }, 5000);
       
       return () => clearInterval(interval);
   }, []);

   // --- 2. GPS TRACKING FOR ACTUAL SPEED AND DISTANCE ---
   useEffect(() => {
       if (!('geolocation' in navigator)) return;
       
       watchRef.current = navigator.geolocation.watchPosition(
           (pos) => {
               const currentPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
               setUserPosition(currentPos);
               
               // Calculate actual speed from GPS
               const speed = pos.coords.speed != null && pos.coords.speed >= 0 
                   ? Math.round(pos.coords.speed * 3.6) // m/s -> km/h
                   : currentSpeed; // keep previous if unavailable
               
               setCurrentSpeed(speed);
               
               // Calculate traveled distance
               if (prevPositionRef.current) {
                   const distanceDelta = distanceKm(prevPositionRef.current, currentPos);
                   setTraveledDistance(prev => prev + distanceDelta);
               }
               
               prevPositionRef.current = currentPos;
               
               // Add to speed history for graph
               const now = new Date();
               setSpeedHistory(prev => {
                   const newEntry = { 
                       time: formatTime(now, settings.timeFormat), 
                       speed: speed,
                       distance: traveledDistance
                   };
                   const updated = [...prev, newEntry];
                   // Keep last 100 points
                   if (updated.length > 100) updated.shift();
                   return updated;
               });
           },
           (err) => console.log('GPS watch err', err),
           { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
       );

       return () => { 
           if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); 
       };
   }, [traveledDistance]);

   // Update place name when position changes
   useEffect(() => {
     if (userPosition) {
       const updatePlace = async () => {
         const name = await getReverseGeocode(userPosition[0], userPosition[1]);
         setCurrentPlace(name);
       };
       updatePlace();
     }
   }, [userPosition]);

   if (loading) return (
       <div className="h-screen w-full flex items-center justify-center bg-slate-50">
           <div className="text-center">
               <div className="text-slate-400 font-medium animate-pulse text-lg">Loading Route Segmentation...</div>
               <div className="text-slate-300 text-sm mt-2">Analyzing weather with AI model</div>
           </div>
       </div>
   );
   
   if (error) return (
       <div className="h-screen w-full flex items-center justify-center bg-slate-50">
           <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-red-200">
               <AlertTriangle size={48} className="text-red-500 mx-auto mb-4"/>
               <div className="text-red-600 font-bold text-lg mb-2">No Active Navigation</div>
               <div className="text-slate-600 text-base">{error}</div>
               <div className="mt-4 text-sm text-slate-500">Please go to Dynamic Re-Routing page and start navigation</div>
           </div>
       </div>
   );

   return (
      <div className="h-[calc(100vh-140px)] flex flex-col">
         <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
            
            {/* HEADER */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="text-blue-600" size={20}/> Adaptive Speed Control
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin size={12}/> {tripData.origin} ➔ {tripData.destination}
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Distance</span>
                    <div className="text-lg font-black text-slate-700">
                        {settings.distanceUnit === 'km' ? tripData.distance.toFixed(1) : (tripData.distance * 0.621371).toFixed(1)} {settings.distanceUnit === 'km' ? 'km' : 'mi'}
                    </div>
                    <div className="text-xs text-green-600 font-bold mt-0.5">
                        Traveled: {settings.distanceUnit === 'km' ? traveledDistance.toFixed(2) : (traveledDistance * 0.621371).toFixed(2)} {settings.distanceUnit === 'km' ? 'km' : 'mi'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-hidden">
                
                {/* 1. LEFT: 5-SEGMENT TABLE */}
                <DashboardCard className="lg:col-span-2 flex flex-col overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Route Segmentation</h3>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">AI Weather Model</span>
                    </div>
                    <div className="p-2 overflow-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-slate-400 font-bold uppercase border-b border-slate-100">
                                    <th className="px-3 py-2">Location</th>
                                    <th className="px-3 py-2">Type</th>
                                    <th className="px-3 py-2 text-center text-blue-600">Rec. Speed</th>
                                    <th className="px-3 py-2 text-right">Weather</th>
                                </tr>
                            </thead>
                            <tbody>
                                {segments.map((seg, i) => (
                                    <tr key={i} className="group hover:bg-blue-50/30 transition-colors border-b border-slate-50 last:border-0">
                                        <td className="px-3 py-3">
                                            <div className="font-bold text-slate-700 text-sm">{seg.name}</div>
                                            <div className="text-xs text-slate-400 mt-0.5">📍 Waypoint {i + 1}</div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-medium">
                                                {seg.type}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <span className="text-lg font-bold text-blue-600">
                                                {settings.distanceUnit === 'km' ? seg.recommended_speed : Math.round(seg.recommended_speed * 0.621371)} 
                                                <span className="text-xs text-slate-400 font-normal ml-1">
                                                    {settings.distanceUnit === 'km' ? 'km/h' : 'mph'}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1 text-sm text-slate-600">
                                                {getWeatherIcon(seg.rawCondition)} {seg.weather}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-1">
                                                Rain: {seg.rain_probability?.toFixed(1)}% • Safety: {seg.safety_score}/100
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </DashboardCard>

                {/* 2. RIGHT: CURRENT SPEED */}
                <div className="space-y-4 flex flex-col overflow-hidden">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg p-4 text-white relative overflow-hidden flex-1 flex flex-col justify-center">
                        <div className="z-10 text-center">
                            <h3 className="text-blue-100 text-sm font-bold uppercase tracking-wider mb-4">Current Speed</h3>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-7xl font-black tracking-tighter">
                                    {settings.distanceUnit === 'km' ? currentSpeed : Math.round(currentSpeed * 0.621371)}
                                </span>
                                <div className="flex flex-col items-start">
                                    <span className="text-2xl font-bold">{settings.distanceUnit === 'km' ? 'KM' : 'MI'}</span>
                                    <span className="text-lg opacity-60">/ H</span>
                                </div>
                            </div>
                            <div className="mt-6 p-3 bg-white/10 rounded-lg backdrop-blur-sm inline-block">
                                <div className="text-xs text-blue-100 font-bold uppercase tracking-widest mb-1">Current Location</div>
                                <div className="text-sm font-bold">
                                    {currentPlace}
                                </div>
                            </div>
                        </div>
                        <RotateCcw className="absolute -right-4 -bottom-4 text-white/10" size={120} />
                    </div>
                </div>

                {/* 3. BOTTOM: ACTUAL SPEED PROFILE GRAPH */}
                <DashboardCard className="lg:col-span-3 !p-4 overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-base text-slate-700 flex items-center gap-2">
                            <TrendingUp className="text-blue-500" size={16}/> Speed Profile (Live)
                        </h3>
                        <div className="text-xs text-slate-400">Real-time speed during travel • {speedHistory.length} data points</div>
                    </div>

                    <div className="w-full flex-1 min-h-0">
                        {speedHistory.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                Waiting for GPS data... Start moving to see speed profile.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={speedHistory} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="time" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 10, fill: '#94a3b8'}} 
                                        dy={5}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fontSize: 10, fill: '#94a3b8'}} 
                                        domain={[0, 'auto']} 
                                        unit={settings.distanceUnit === 'km' ? ' km/h' : ' mph'}
                                    />
                                    <Tooltip 
                                        contentStyle={{ 
                                            borderRadius: '8px', 
                                            border: 'none', 
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                                            fontSize: '12px' 
                                        }}
                                        itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                                        formatter={(value: number) => {
                                            const displaySpeed = settings.distanceUnit === 'km' ? value : Math.round(value * 0.621371);
                                            const unit = settings.distanceUnit === 'km' ? 'km/h' : 'mph';
                                            return [`${displaySpeed} ${unit}`, 'Speed'];
                                        }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="speed" 
                                        stroke="#3b82f6" 
                                        strokeWidth={2}
                                        fill="url(#colorSpeed)" 
                                        activeDot={{ r: 4, strokeWidth: 0 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </DashboardCard>

            </div>
         </div>
      </div>
   );
}