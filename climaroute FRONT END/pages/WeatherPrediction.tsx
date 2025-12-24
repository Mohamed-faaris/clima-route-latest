import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/Layout';
import { 
    Cloud, Sun, CloudRain, Wind, Droplets, 
    Calendar, Loader, AlertTriangle, Bell
} from 'lucide-react';
import { apiService, getCurrentUser } from '../services/apiservice';
import { useSettings, convertTemp, formatTime } from '../contexts/SettingsContext';

// Background images (placed in components/)
import skyImg from '../components/sky.jpg';
import cloudyImg from '../components/cloudy sky.jpg';
import rainyImg from '../components/rainy sky.jpg';

// --- EMOJI MAPPING FOR WEATHER CONDITIONS ---
const getWeatherEmoji = (condition: string) => {
    const lower = condition?.toLowerCase() || '';
    if (lower.includes('clear') || lower.includes('sunny')) return '☀️';
    if (lower.includes('cloudy') || lower.includes('cloud')) return '☁️';
    if (lower.includes('rain')) return '🌧️';
    if (lower.includes('storm')) return '⛈️';
    if (lower.includes('fog')) return '🌫️';
    return '🌤️';
};

// --- RISK COLOR & TEXT BASED ON RAIN PROBABILITY ---
const getRiskDetails = (rainProb: number) => {
    if (rainProb <= 30) {
        return { 
            color: 'bg-green-50 border-green-300', 
            textColor: 'text-green-700',
            icon: '✅',
            status: 'Safe',
            risk: 'Low Risk'
        };
    }
    if (rainProb <= 70) {
        return { 
            color: 'bg-orange-50 border-orange-300', 
            textColor: 'text-orange-700',
            icon: '⚠️',
            status: 'Caution',
            risk: 'Medium Risk'
        };
    }
    return { 
        color: 'bg-red-50 border-red-300', 
        textColor: 'text-red-700',
        icon: '🛑',
        status: 'Danger',
        risk: 'High Risk'
    };
};

export function Weather() {
    const { settings } = useSettings();
    const [currentWeather, setCurrentWeather] = useState<any>(null);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [lastRainProb, setLastRainProb] = useState<number | null>(null);
    const [stormDetected, setStormDetected] = useState(false);
    const [alertSentForSession, setAlertSentForSession] = useState(false); // Prevent duplicate alerts
    const autoUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const STORM_THRESHOLD = 70; // Rain probability > 70% = storm
    const HEAVY_RAIN_THRESHOLD = 50; // Rain probability > 50% = heavy rain
    const AUTO_UPDATE_INTERVAL = 3600000; // 1 hour in milliseconds

    // Fetch weather data
    const fetchWeatherData = async () => {
        try {
            // Fetch current weather
            const weatherRes = await apiService.getWeatherForecast();
            if (weatherRes?.current) {
                setCurrentWeather(weatherRes);
                
                const currentRainProb = weatherRes.prediction?.probability || 0;
                const condition = weatherRes.current.condition?.toLowerCase() || '';
                
                // Only send alert if not already sent in this session
                if (!alertSentForSession) {
                    // Check for STORM (rain prob > 70% OR condition contains storm/thunder)
                    if (currentRainProb > STORM_THRESHOLD || condition.includes('storm') || condition.includes('thunder')) {
                        setStormDetected(true);
                        setAlertSentForSession(true);
                        
                        // Send STORM weather alert to backend (DB-persisted)
                        await apiService.createWeatherAlert(
                            'STORM',
                            `⚠️ Severe storm detected! Rain probability: ${currentRainProb.toFixed(1)}%. Condition: ${weatherRes.current.condition}. Consider pulling over to a safe location.`,
                            localStorage.getItem('userEmail') || undefined
                        );
                        console.log('STORM alert sent to database');
                    }
                    // Check for HEAVY RAIN (rain prob > 50% but < 70%)
                    else if (currentRainProb > HEAVY_RAIN_THRESHOLD || condition.includes('heavy rain')) {
                        setAlertSentForSession(true);
                        
                        // Send HEAVY_RAIN weather alert to backend (DB-persisted)
                        await apiService.createWeatherAlert(
                            'HEAVY_RAIN',
                            `🌧️ Heavy rain detected! Rain probability: ${currentRainProb.toFixed(1)}%. Reduce speed and increase following distance.`,
                            localStorage.getItem('userEmail') || undefined
                        );
                        console.log('HEAVY_RAIN alert sent to database');
                    }
                }
                
                setLastRainProb(currentRainProb);
                
                // Get current user for saving weather data
                const currentUserEmail = localStorage.getItem('userEmail') || '';
                
                // Save to DB for history - with user email for filtering
                const savePayload = {
                    temperature: weatherRes.current.temperature,
                    condition: weatherRes.current.condition,
                    humidity: weatherRes.current.humidity,
                    windSpeed: weatherRes.current.wind_speed,
                    rainProbability: currentRainProb,
                    safetyScore: weatherRes.prediction?.status || 'Unknown',
                    userEmail: currentUserEmail || undefined
                };
                await apiService.saveWeather(savePayload);
            } else {
                throw new Error("No weather data");
            }

            // Fetch historical data - filtered by user (uses exported getCurrentUser)
            const { email, role } = getCurrentUser();
            const historyRes = await apiService.getWeatherHistory(email, role);
            if (historyRes) {
                setHistoryData(historyRes);
            }

            setError(false);
        } catch (err) {
            console.error("Weather fetch error:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchWeatherData();
    }, []);

    // Auto-update weather every hour
    useEffect(() => {
        autoUpdateIntervalRef.current = setInterval(() => {
            console.log("Auto-updating weather...");
            fetchWeatherData();
        }, AUTO_UPDATE_INTERVAL);

        return () => {
            if (autoUpdateIntervalRef.current) {
                clearInterval(autoUpdateIntervalRef.current);
            }
        };
    }, [lastRainProb]);

    if (loading && !currentWeather) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400 animate-pulse">
                <Loader size={24} className="animate-spin mr-2" />
                Loading Weather Data...
            </div>
        );
    }

    if (error && !currentWeather) {
        return (
            <div className="h-full flex items-center justify-center text-red-400">
                Weather Service Unavailable
            </div>
        );
    }

    const { current, prediction } = currentWeather || {};
    const rainProb = prediction?.probability || 0;
    const riskDetails = getRiskDetails(rainProb);
    const weatherEmoji = getWeatherEmoji(current?.condition);

    // Choose background image based on condition
    let bgUrl = skyImg;
    const cond = (current?.condition || '').toLowerCase();
    if (cond.includes('rain') || cond.includes('storm') || cond.includes('drizzle')) bgUrl = rainyImg;
    else if (cond.includes('cloud') || cond.includes('overcast') || cond.includes('fog')) bgUrl = cloudyImg;

    // Group history by hour and day
    const hourlyData = historyData.slice(0, 24); // Last 24 hours
    const weeklyData = historyData.filter((_, idx) => idx % 24 === 0).slice(0, 7); // Every 24 hrs for 7 days

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col">
            {/* Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-4">
                <h2 className="text-2xl font-bold text-slate-800">AI Weather Prediction</h2>
                <p className="text-sm text-slate-500 mt-1">Real-time forecasts powered by deep learning</p>
            </div>
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    {stormDetected && (
                        <div className="flex items-center gap-2 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-full font-bold animate-pulse">
                            <AlertTriangle size={18} />
                            Storm Detected!
                        </div>
                    )}
                    <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold border border-blue-100 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        Live Model
                    </span>
                </div>
            </div>

            {/* Main Grid: Left (Weather Details) + Right (Forecasts) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 overflow-hidden">
                
                {/* LEFT SIDE: WEATHER DETAILS PANEL */}
                <div className="lg:col-span-1 flex flex-col overflow-hidden">
                    <Card className={`flex flex-col justify-between shadow-lg p-9 overflow-auto ${stormDetected ? 'bg-gradient-to-b from-red-50 to-orange-100 border-red-200' : 'bg-gradient-to-b from-blue-50 to-blue-100 border-blue-200'}`}>
                        
                        {/* Current Temperature & Emoji */}
                        <div className="text-center mb-2">
                            <div className="text-3xl mb-1">{weatherEmoji}</div>
                            <div className="text-2xl font-bold text-gray-800 mb-0.5">
                                {convertTemp(Number(current?.temperature || 0), settings.temperatureUnit)}°{settings.temperatureUnit}
                            </div>
                            <div className={`text-xs font-semibold ${stormDetected ? 'text-red-700' : 'text-blue-700'}`}>
                                {current?.condition}
                            </div>
                        </div>

                        {/* Humidity & Wind Speed */}
                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                            <div className="bg-white/80 p-1.5 rounded-lg border border-blue-200 shadow-sm flex flex-col items-center justify-center">
                                <Droplets size={12} className="text-blue-500 mb-0.5" />
                                <span className="text-[9px] text-gray-600">Humidity</span>
                                <span className="text-sm font-bold text-gray-800">
                                    {current?.humidity}%
                                </span>
                            </div>
                            <div className="bg-white/80 p-1.5 rounded-lg border border-blue-200 shadow-sm flex flex-col items-center justify-center">
                                <Wind size={12} className="text-gray-500 mb-0.5" />
                                <span className="text-[9px] text-gray-600">Wind Speed</span>
                                <span className="text-sm font-bold text-gray-800">
                                    {current?.wind_speed} km/h
                                </span>
                            </div>
                        </div>

                        {/* Predicted Condition */}
                        <div className="mb-2 p-1.5 bg-white/60 rounded-lg border border-blue-200">
                            <span className="text-[9px] font-bold text-gray-600 uppercase">Prediction</span>
                            <p className="text-[10px] font-semibold text-gray-800 mt-0.5">
                                {prediction?.message || 'Analyzing...'}
                            </p>
                        </div>

                        {/* Rain Probability */}
                        <div className="mb-2 p-1.5 bg-white/60 rounded-lg border border-blue-200">
                            <span className="text-[9px] font-bold text-gray-600 uppercase">Rain Probability</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-base font-bold text-blue-600">{rainProb.toFixed(1)}%</span>
                                <div className="flex-1 bg-gray-300 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className={`h-full ${rainProb <= 30 ? 'bg-green-500' : rainProb <= 70 ? 'bg-orange-500' : 'bg-red-500'}`}
                                        style={{ width: `${rainProb}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Risk Assessment Box (Color-coded) */}
                        <div className={`p-1.5 rounded-lg border-2 shadow-md ${riskDetails.color}`}>
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-sm">{riskDetails.icon}</span>
                                <h4 className={`font-bold text-[10px] uppercase ${riskDetails.textColor}`}>
                                    {riskDetails.status}
                                </h4>
                            </div>
                            <p className={`text-[9px] font-semibold ${riskDetails.textColor}`}>
                                {riskDetails.risk} - {prediction?.status || 'Unknown'} driving conditions
                            </p>
                        </div>
                    </Card>
                </div>

                {/* RIGHT SIDE: HOURLY & WEEKLY FORECASTS */}
                <div className="lg:col-span-2 flex flex-col gap-3 overflow-hidden">
                    
                    {/* HOURLY FORECAST */}
                    <Card className="overflow-hidden flex flex-col p-5">
                        <div className="flex items-center gap-2 mb-3 border-b border-gray-200 pb-2">
                            <span className="text-lg">🕐</span>
                            <h3 className="font-bold text-base text-gray-700">Hourly Forecast (Last 24 Hours)</h3>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {hourlyData.length > 0 ? (
                                hourlyData.map((h, i) => {
                                    const date = new Date(h.recordedAt);
                                    const timeStr = formatTime(date, settings.timeFormat);
                                    return (
                                        <div 
                                            key={i} 
                                            className="flex flex-col items-center min-w-[55px] p-2 bg-gradient-to-b from-blue-50 to-blue-100 rounded-lg border border-blue-200 shadow-sm flex-shrink-0"
                                        >
                                            <span className="text-[10px] font-semibold text-gray-600">
                                                {timeStr}
                                            </span>
                                            <span className="text-2xl my-1">{getWeatherEmoji(h.condition)}</span>
                                            <span className="text-xs font-bold text-gray-800">{convertTemp(Number(h.temperature||0), settings.temperatureUnit)}°</span>
                                            <span className="text-[10px] text-blue-600 font-semibold">{h.rainProbability.toFixed(0)}%</span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="w-full flex items-center justify-center text-gray-400">
                                    No hourly data available
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* WEEKLY FORECAST */}
                    <Card className="overflow-hidden flex flex-col p-5">
                        <div className="flex items-center gap-2 mb-3 border-b border-gray-200 pb-2">
                            <Calendar size={18} className="text-blue-600" />
                            <h3 className="font-bold text-base text-gray-700">Weekly Forecast</h3>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {weeklyData.length > 0 ? (
                                weeklyData.map((w, i) => (
                                    <div 
                                        key={i} 
                                        className="flex flex-col items-center w-[70px] p-2 bg-gradient-to-b from-indigo-50 to-indigo-100 rounded-lg border border-indigo-200 shadow-sm"
                                    >
                                        <span className="text-[10px] font-semibold text-gray-600 mb-1">
                                            {new Date(w.recordedAt).toLocaleDateString([], { weekday: 'short' })}
                                        </span>
                                        <span className="text-2xl mb-1">{getWeatherEmoji(w.condition)}</span>
                                        <span className="text-xs font-bold text-gray-800">{convertTemp(Number(w.temperature||0), settings.temperatureUnit)}°</span>
                                        <span className="text-[9px] text-gray-600 truncate w-full text-center">{w.condition}</span>
                                        <span className="text-[10px] text-indigo-600 font-bold">{w.rainProbability.toFixed(0)}%</span>
                                    </div>
                                ))
                            ) : (
                                <div className="w-full flex items-center justify-center text-gray-400">
                                    No weekly data available
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
