import pandas as pd
import numpy as np
import requests
import joblib
import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
try:
    from tensorflow.keras.models import load_model
except Exception:
    load_model = None
    print("⚠️ TensorFlow not available; model loading is disabled.")
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.getenv('MODEL_PATH', os.path.join(BASE_DIR, 'rainfall_model.keras'))
SCALER_PATH = os.getenv('SCALER_PATH', os.path.join(BASE_DIR, 'scaler.gz'))
WEATHER_API_URL = os.getenv('WEATHER_API_URL', 'https://api.open-meteo.com/v1/forecast')

FEATURE_COLS = ['temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 
                'surface_pressure', 'cloud_cover', 'wind_speed_10m', 
                'hour', 'month']

# --- LOAD MODEL ---
print("⏳ Loading AI Model...")
model = None
scaler = None

if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH) and load_model is not None:
    try:
        model = load_model(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        print("✅ Model & Scaler Loaded!")
    except Exception as e:
        print(f"❌ Error loading model: {e}")
else:
    if not (os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH)):
        print("⚠️ Model files not found. Ensure rainfall_model.keras and scaler.gz are in this folder.")
    else:
        print("⚠️ TensorFlow not installed; model loading skipped. Install TensorFlow to enable predictions.")

# --- HELPER: Fetch Weather ---
def get_real_weather(lat, lon):
    url = WEATHER_API_URL
    params = {
        "latitude": lat, "longitude": lon,
        "hourly": "temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,cloud_cover,wind_speed_10m,weather_code",
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
        "past_days": 1, "forecast_days": 1, "timezone": "auto"
    }
    try:
        response = requests.get(url, params=params)
        return response.json()
    except:
        return None

def get_weather_desc(code):
    if code in [0,1,2]: return "Sunny/Clear"
    if code in [3]: return "Cloudy"
    if code in [51, 53, 55, 61, 63, 65]: return "Rain"
    if code >= 95: return "Storm"
    return "Clear"

# --- SHARED PREDICTION LOGIC ---
def calculate_risk(lat, lon):
    # 1. Get Data
    data = get_real_weather(lat, lon)
    if not data or 'hourly' not in data:
        return None

    # 2. Process for Model
    df = pd.DataFrame(data['hourly'])
    df['time'] = pd.to_datetime(df['time'])
    current_time = datetime.now()
    
    # Filter last 24h
    df = df[df['time'] <= current_time].sort_values('time').tail(24)
    while len(df) < 24: # Pad if needed
        df = pd.concat([df, df.iloc[[-1]]], ignore_index=True)

    # 3. Predict
    rain_prob = 0
    if model and scaler:
        df['hour'] = df['time'].dt.hour
        df['month'] = df['time'].dt.month
        input_scaled = scaler.transform(df[FEATURE_COLS].values)
        
        try:
            # Try 3D input (LSTM)
            input_reshaped = np.array([input_scaled]) 
            probs = model.predict(input_reshaped, verbose=0)[0]
        except:
            # Fallback to 2D (Dense)
            probs = model.predict(input_scaled[-1].reshape(1, -1), verbose=0)[0]

        # Calculate Rain Prob (Sum of non-zero classes)
        rain_prob = float(probs[1] + probs[2]) * 100 if len(probs) > 2 else float(probs[0]) * 100

    # 4. Extract Current Details
    curr = data.get('current', {})
    
    return {
        "rain_probability": round(rain_prob, 2),
        "safety_score": round(max(0, 100 - rain_prob), 1),
        "temperature": curr.get('temperature_2m', 0),
        "humidity": curr.get('relative_humidity_2m', 0),
        "wind_speed": curr.get('wind_speed_10m', 0),
        "condition": get_weather_desc(curr.get('weather_code', 0))
    }

# --- ENDPOINTS ---

@app.route('/predict_score', methods=['POST'])
def predict_score():
    """ Used by RouteController for Path Scoring """
    data = request.json
    result = calculate_risk(data.get('latitude'), data.get('longitude'))
    
    if not result: return jsonify({"error": "Weather API failed"}), 500
    
    return jsonify({
        "safety_score": result['safety_score'],
        "condition": result['condition'],
        "rain_prob": result['rain_probability']
    })

@app.route('/weather_details', methods=['POST'])
def weather_details():
    """ Used by WeatherController for Frontend Display """
    data = request.json
    # Resolving location name is handled by C# Geocoding before calling this
    lat, lon = data.get('latitude'), data.get('longitude')
    
    result = calculate_risk(lat, lon)
    if not result: return jsonify({"error": "Failed to analyze"}), 500

    # Logic for Recommendation
    prob = result['rain_probability']
    status = "Safe"
    if prob > 40: status = "Caution"
    if prob > 80: status = "Danger"

    return jsonify({
        "current": result,
        "prediction": {
            "status": status,
            "message": f"AI Risk Analysis: {prob}% chance of rain. {status} driving conditions.",
            "probability": prob
        }
    })

@app.route('/segment_weather', methods=['POST'])
def segment_weather():
    """ Get weather predictions for multiple route segments """
    data = request.json
    segments = data.get('segments', [])
    
    if not segments:
        return jsonify({"error": "No segments provided"}), 400
    
    results = []
    for seg in segments:
        lat = seg.get('lat')
        lon = seg.get('lon')
        name = seg.get('name', 'Unknown')
        
        if lat is None or lon is None:
            continue
        
        weather_result = calculate_risk(lat, lon)
        
        if weather_result:
            # Calculate recommended speed based on weather conditions
            rain_prob = weather_result['rain_probability']
            base_speed = 80  # km/h
            
            # Adjust speed based on rain probability
            if rain_prob >= 70:
                recommended_speed = 50
            elif rain_prob >= 40:
                recommended_speed = 65
            elif rain_prob >= 15:
                recommended_speed = 75
            else:
                recommended_speed = base_speed
            
            results.append({
                "name": name,
                "lat": lat,
                "lon": lon,
                "temperature": weather_result['temperature'],
                "humidity": weather_result['humidity'],
                "wind_speed": weather_result['wind_speed'],
                "condition": weather_result['condition'],
                "rain_probability": weather_result['rain_probability'],
                "recommended_speed": recommended_speed,
                "safety_score": weather_result['safety_score']
            })
    
    return jsonify({"segments": results})

@app.route('/health', methods=['GET'])
def health_check():
    """ Health check endpoint """
    return jsonify({"status": "ok", "message": "AI Server is running"})

if __name__ == '__main__':
    # Use Waitress for production-ready multi-threaded serving
    # Waitress handles multiple concurrent requests properly on Windows
    try:
        from waitress import serve
        print("🚀 Starting Production Server (Waitress)...")
        print("📡 AI Model API running on http://127.0.0.1:5001")
        print("👥 Multi-user support: ENABLED (4 threads)")
        # threads=4 allows 4 concurrent requests, adjust as needed
        serve(app, host='0.0.0.0', port=5001, threads=4)
    except ImportError:
        print("⚠️ Waitress not installed. Falling back to Flask dev server.")
        print("⚠️ Run: pip install waitress")
        app.run(port=5001, debug=True)