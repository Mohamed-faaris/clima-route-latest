"""
Production-Ready AI Weather Prediction Service
- Model loads ONCE at startup (not per request)
- Health checks for container orchestration
- Proper error handling and logging
- Thread-safe for multiple concurrent users
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Optional, List
from datetime import datetime

import numpy as np
import pandas as pd
import requests
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from tensorflow.keras.models import load_model

# --- LOGGING SETUP ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.environ.get('MODEL_PATH', os.path.join(BASE_DIR, 'rainfall_model.keras'))
SCALER_PATH = os.environ.get('SCALER_PATH', os.path.join(BASE_DIR, 'scaler.gz'))

FEATURE_COLS = [
    'temperature_2m', 'relative_humidity_2m', 'dew_point_2m',
    'surface_pressure', 'cloud_cover', 'wind_speed_10m',
    'hour', 'month'
]

# --- GLOBAL MODEL STORAGE (Loaded once at startup) ---
class ModelStore:
    model = None
    scaler = None
    is_loaded = False

model_store = ModelStore()

# --- PYDANTIC MODELS ---
class LocationRequest(BaseModel):
    latitude: float
    longitude: float

class SegmentRequest(BaseModel):
    lat: float
    lon: float
    name: str = "Unknown"

class SegmentsRequest(BaseModel):
    segments: List[SegmentRequest]

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    message: str

# --- STARTUP/SHUTDOWN LIFECYCLE ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model ONCE at startup, cleanup on shutdown"""
    logger.info("⏳ Loading AI Model at startup...")
    
    try:
        if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
            model_store.model = load_model(MODEL_PATH)
            model_store.scaler = joblib.load(SCALER_PATH)
            model_store.is_loaded = True
            logger.info("✅ Model & Scaler loaded successfully!")
        else:
            logger.error(f"❌ Model files not found: {MODEL_PATH}, {SCALER_PATH}")
    except Exception as e:
        logger.error(f"❌ Error loading model: {e}")
    
    yield  # App runs here
    
    # Cleanup on shutdown
    logger.info("🛑 Shutting down AI service...")
    model_store.model = None
    model_store.scaler = None

# --- FASTAPI APP ---
app = FastAPI(
    title="ClimaRoute AI Weather Prediction Service",
    description="Production-ready weather prediction API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- HELPER FUNCTIONS ---
def get_real_weather(lat: float, lon: float) -> Optional[dict]:
    """Fetch weather data from Open-Meteo API"""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,cloud_cover,wind_speed_10m,weather_code",
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
        "past_days": 1,
        "forecast_days": 1,
        "timezone": "auto"
    }
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Weather API error: {e}")
        return None

def get_weather_desc(code: int) -> str:
    """Convert weather code to description"""
    if code in [0, 1, 2]:
        return "Sunny/Clear"
    if code == 3:
        return "Cloudy"
    if code in [51, 53, 55, 61, 63, 65]:
        return "Rain"
    if code >= 95:
        return "Storm"
    return "Clear"

def calculate_risk(lat: float, lon: float) -> Optional[dict]:
    """Core prediction logic - thread-safe"""
    # 1. Get weather data
    data = get_real_weather(lat, lon)
    if not data or 'hourly' not in data:
        return None

    # 2. Process for model
    df = pd.DataFrame(data['hourly'])
    df['time'] = pd.to_datetime(df['time'])
    current_time = datetime.now()
    
    # Filter last 24h
    df = df[df['time'] <= current_time].sort_values('time').tail(24)
    while len(df) < 24:
        df = pd.concat([df, df.iloc[[-1]]], ignore_index=True)

    # 3. Predict using pre-loaded model
    rain_prob = 0.0
    if model_store.is_loaded and model_store.model and model_store.scaler:
        df['hour'] = df['time'].dt.hour
        df['month'] = df['time'].dt.month
        input_scaled = model_store.scaler.transform(df[FEATURE_COLS].values)
        
        try:
            # LSTM expects 3D input
            input_reshaped = np.array([input_scaled])
            probs = model_store.model.predict(input_reshaped, verbose=0)[0]
        except Exception:
            # Fallback to 2D
            probs = model_store.model.predict(
                input_scaled[-1].reshape(1, -1), verbose=0
            )[0]

        # Calculate rain probability
        rain_prob = float(probs[1] + probs[2]) * 100 if len(probs) > 2 else float(probs[0]) * 100

    # 4. Extract current details
    curr = data.get('current', {})
    
    return {
        "rain_probability": round(rain_prob, 2),
        "safety_score": round(max(0, 100 - rain_prob), 1),
        "temperature": curr.get('temperature_2m', 0),
        "humidity": curr.get('relative_humidity_2m', 0),
        "wind_speed": curr.get('wind_speed_10m', 0),
        "condition": get_weather_desc(curr.get('weather_code', 0))
    }

# --- API ENDPOINTS ---

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check for container orchestration (K8s, ECS, etc.)"""
    return HealthResponse(
        status="healthy" if model_store.is_loaded else "degraded",
        model_loaded=model_store.is_loaded,
        message="AI Service is running" if model_store.is_loaded else "Model not loaded"
    )

@app.get("/ready")
async def readiness_check():
    """Readiness probe - only return 200 if model is loaded"""
    if not model_store.is_loaded:
        raise HTTPException(status_code=503, detail="Model not ready")
    return {"status": "ready"}

@app.post("/predict_score")
async def predict_score(request: LocationRequest):
    """Used by RouteController for path scoring"""
    result = calculate_risk(request.latitude, request.longitude)
    
    if not result:
        raise HTTPException(status_code=500, detail="Weather API failed")
    
    return {
        "safety_score": result['safety_score'],
        "condition": result['condition'],
        "rain_prob": result['rain_probability']
    }

@app.post("/weather_details")
async def weather_details(request: LocationRequest):
    """Used by WeatherController for frontend display"""
    result = calculate_risk(request.latitude, request.longitude)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to analyze")

    prob = result['rain_probability']
    status = "Safe"
    if prob > 40:
        status = "Caution"
    if prob > 80:
        status = "Danger"

    return {
        "current": result,
        "prediction": {
            "status": status,
            "message": f"AI Risk Analysis: {prob}% chance of rain. {status} driving conditions.",
            "probability": prob
        }
    }

@app.post("/segment_weather")
async def segment_weather(request: SegmentsRequest):
    """Get weather predictions for multiple route segments"""
    if not request.segments:
        raise HTTPException(status_code=400, detail="No segments provided")
    
    results = []
    for seg in request.segments:
        weather_result = calculate_risk(seg.lat, seg.lon)
        
        if weather_result:
            rain_prob = weather_result['rain_probability']
            
            # Calculate recommended speed
            if rain_prob >= 70:
                recommended_speed = 50
            elif rain_prob >= 40:
                recommended_speed = 65
            elif rain_prob >= 15:
                recommended_speed = 75
            else:
                recommended_speed = 80
            
            results.append({
                "name": seg.name,
                "lat": seg.lat,
                "lon": seg.lon,
                "temperature": weather_result['temperature'],
                "humidity": weather_result['humidity'],
                "wind_speed": weather_result['wind_speed'],
                "condition": weather_result['condition'],
                "rain_probability": weather_result['rain_probability'],
                "recommended_speed": recommended_speed,
                "safety_score": weather_result['safety_score']
            })
    
    return {"segments": results}

# --- RUN WITH UVICORN (Production ASGI Server) ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5001,
        workers=4,  # Multiple workers for concurrency
        log_level="info"
    )
