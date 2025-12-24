import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Layout';
import { CloudRain, AlertTriangle, Clock, Activity, Navigation, Crosshair } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { apiService, getCurrentUser } from '../services/apiservice'; // Ensure filename matches case
import { useSettings, convertTemp } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useSos } from '../contexts/SosContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- LEAFLET ICON FIX ---
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

// --- HELPER TO MOVE MAP ---
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13); 
  }, [center, map]);
  return null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { user } = useAuth();
  const { sosStatus, resolveActiveAlert } = useSos();
  
  // --- STATE MANAGEMENT ---
  const [notifications, setNotifications] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Data States (Initialize with "--" to show waiting state)
  const [liveSpeed, setLiveSpeed] = useState<string>("--");
  const [currentEta, setCurrentEta] = useState<string>("--");
  const [currentTemp, setCurrentTemp] = useState<string | number>("--");

  // Location States
  const [currentLocation, setCurrentLocation] = useState<[number, number]>([13.0827, 80.2707]);
  const [gpsFound, setGpsFound] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // --- 1. FIND LOCATION (Laptop Friendly) ---
  const findLocation = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); 
    setLocationError(null);

    if (!navigator.geolocation) {
        alert("GPS is not supported by your browser");
        return;
    }

    // Try High Accuracy first, fallback automatically handled by browser usually
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation([latitude, longitude]);
        setGpsFound(true);
        setLocationError(null);
      },
      (error) => {
        // Suppress console error spam, just show user-friendly message
        if(error.code === 1) {
          setLocationError("Location Denied");
        } else if (error.code === 2) {
          setLocationError("GPS Unavailable");
        } else {
          setLocationError("Location Timeout");
        }
        // Use default Chennai location as fallback
        setCurrentLocation([13.0827, 80.2707]);
        setGpsFound(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  // --- 2. LOAD DATA (Database + Session) ---
  useEffect(() => {
    findLocation(); 

    // A. READ FROM SESSION STORAGE (Data passed from other pages)
    const savedSpeed = sessionStorage.getItem('climaRoute_liveSpeed');
    if (savedSpeed) setLiveSpeed(savedSpeed);

    // *IMPORTANT*: Ensure ETACalculator page does: sessionStorage.setItem('climaRoute_eta', etaValue)
    const savedEta = sessionStorage.getItem('climaRoute_eta');
    if (savedEta) setCurrentEta(savedEta);

    // B. FETCH FROM BACKEND (Database) - with user-specific filtering
    const loadData = async () => {
      try {
        // Get current user for filtered data
        const { email, role } = getCurrentUser();
        
        const [notifsData, weatherData] = await Promise.all([
            apiService.getUserAlerts(email, role), // User-specific notifications
            apiService.getWeatherForecast()
        ]);

        // 1. Set Notifications (Take top 3) - already filtered by backend
        setNotifications(Array.isArray(notifsData) ? notifsData.slice(0, 3) : []);
        
        // 2. Set Weather
        setWeather(weatherData);
        if (weatherData && weatherData.current) {
            // Convert temp according to user settings
            const valC = Number(weatherData.current.temperature || 0);
            const display = convertTemp(valC, settings.temperatureUnit);
            setCurrentTemp(display);
        }

        // Show live values only if navigation flag present
        const navActive = sessionStorage.getItem('climaRoute_navigation_active');
        if (navActive) {
          const savedSpeed = sessionStorage.getItem('climaRoute_liveSpeed');
          const savedEta = sessionStorage.getItem('climaRoute_eta');
          setLiveSpeed(savedSpeed ?? "--");
          setCurrentEta(savedEta ?? "--");
        } else {
          setLiveSpeed("--");
          setCurrentEta("--");
        }

      } catch (err) {
        console.error("Dashboard data load failed", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Update temperature display when settings change
  useEffect(() => {
    if (weather && weather.current) {
      const valC = Number(weather.current.temperature || 0);
      const display = convertTemp(valC, settings.temperatureUnit);
      setCurrentTemp(display);
    }
  }, [settings.temperatureUnit, weather]);

  // Poll for live session changes (update every 2s while nav active)
  useEffect(() => {
    const t = setInterval(() => {
      const navActive = sessionStorage.getItem('climaRoute_navigation_active');
      if (navActive) {
        const s = sessionStorage.getItem('climaRoute_liveSpeed') || "--";
        const e = sessionStorage.getItem('climaRoute_eta') || "--";
        setLiveSpeed(s);
        setCurrentEta(e);
      } else {
        setLiveSpeed("--");
        setCurrentEta("--");
      }
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const mapKey = `${currentLocation[0]}-${currentLocation[1]}`; 

  return (
    <>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">Welcome back, {user?.name || 'Driver'}.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* MAP CARD */}
        <div className="md:col-span-8 space-y-6">
          <Card 
            className="h-[450px] relative overflow-hidden p-0 flex flex-col border-2 border-transparent hover:border-blue-400 cursor-pointer shadow-lg transition-all group"
            onClick={() => navigate('/re-routing')}
          >
            <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-sm flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${gpsFound ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
              <span className="text-sm font-bold text-gray-700">
                  {locationError ? <span className="text-red-500">{locationError}</span> : (gpsFound ? "Current Location" : "Locating...")}
              </span>
            </div>
            
            <button 
                onClick={findLocation}
                className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded-lg shadow-md text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Refresh Location"
            >
                <Crosshair size={24} className={!gpsFound && !locationError ? "animate-spin" : ""} />
            </button>

            <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 z-[500] pointer-events-none transition-colors" />

            <MapContainer 
                key={mapKey}
                center={currentLocation} 
                zoom={13} 
                style={{ height: "100%", width: "100%" }} 
                dragging={false} 
                scrollWheelZoom={false}
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <RecenterMap center={currentLocation} />
                <Marker position={currentLocation}>
                  <Popup>
                      <div className="text-center">
                          <b>You are here</b><br/>
                          {gpsFound ? "(GPS Active)" : "(Estimated)"}
                      </div>
                  </Popup>
                </Marker>
            </MapContainer>

            <div className="absolute bottom-4 right-4 z-[1000]">
               <button className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 font-bold hover:bg-blue-700 transition-colors">
                  <Navigation size={18} /> Plan Route
               </button>
            </div>
          </Card>

          {/* SOS Status */}
          <Card 
            onClick={(e) => { e.stopPropagation(); navigate('/sos'); }} 
            className={`${sosStatus === 'Normal' ? 'bg-green-50 border-green-500 hover:bg-green-100' : 'bg-red-50 border-red-500 hover:bg-red-100'} border-l-4 cursor-pointer transition-colors relative group/sos`}
          >
             <div className="flex items-start gap-4">
                <div className={`${sosStatus === 'Normal' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} p-3 rounded-full`}>
                   <AlertTriangle size={24} />
                </div>
                <div className="flex-1">
                   <div className="flex justify-between items-start">
                      <h3 className={`text-lg font-bold ${sosStatus === 'Normal' ? 'text-green-700' : 'text-red-700'}`}>
                        System Status: {sosStatus}
                      </h3>
                      {sosStatus === 'Abnormal' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if(window.confirm("Are you sure you want to resolve this alert and return to Normal status?")) {
                              resolveActiveAlert();
                            }
                          }}
                          className="bg-white text-red-600 border border-red-200 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm"
                        >
                          Resolve Now
                        </button>
                      )}
                   </div>
                   <p className={`${sosStatus === 'Normal' ? 'text-green-600/80' : 'text-red-600/80'} text-sm mt-1`}>
                     {sosStatus === 'Normal' ? 'Tap here to report an emergency or SOS.' : 'Emergency detected! Tap for details.'}
                   </p>
                </div>
             </div>
          </Card>
        </div>

        {/* Right Side Widgets */}
        <div className="md:col-span-4 space-y-6">
          
          {/* 1. RECENT ALERTS (From Database) */}
          <Card 
            title="Recent Alerts" 
            onClick={() => navigate('/notifications')} 
            className="cursor-pointer hover:bg-blue-50/50 transition-colors"
          >
             <div className="space-y-4">
               {loading ? <p className="text-sm text-gray-400">Loading alerts...</p> : notifications.length === 0 ? (
                 <p className="text-sm text-gray-400">-- No alerts --</p>
               ) : (
                 notifications.map((notif) => (
                   <div key={notif.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                      <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${notif.category === 'Critical' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                      <div>
                          <p className="text-sm font-medium text-gray-800 line-clamp-1">{notif.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{notif.timestamp}</p>
                      </div>
                   </div>
                 ))
               )}
             </div>
          </Card>

          {/* 2. ADAPTIVE SPEED (From Session) */}
          <Card 
            onClick={() => navigate('/adaptive-speed')} 
            className="cursor-pointer hover:bg-blue-50/50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
               <Activity className="text-purple-500" size={20} />
               <h3 className="font-semibold text-gray-700">Adaptive Speed</h3>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {liveSpeed}
              <span className="text-base font-normal text-gray-500"> {settings.distanceUnit === 'mi' ? 'mph' : 'km/h'}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
                {liveSpeed === "--" ? "Not Active" : "Optimization Active"}
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-4">
             
             {/* 3. ETA (From Session) */}
             <Card 
               onClick={() => navigate('/eta')} 
               className="!p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:scale-105 active:scale-95 transition-transform"
             >
                <Clock className="text-blue-500 mb-2" size={24} />
                <span className="text-xs text-gray-400 uppercase font-bold">ETA</span>
                <span className="font-bold text-gray-800">{currentEta}</span>
             </Card>

             {/* 4. TEMPERATURE (From Database) */}
             <Card 
               onClick={() => navigate('/weather')} 
               className="!p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:scale-105 active:scale-95 transition-transform"
             >
                <CloudRain className="text-blue-500 mb-2" size={24} />
                <span className="text-xs text-gray-400 uppercase font-bold">Temp</span>
                <span className="font-bold text-gray-800">{currentTemp}°{settings.temperatureUnit}</span>
             </Card>
          </div>
        </div>
      </div>
    </>
  );
}