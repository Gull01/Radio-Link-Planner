# Weather Integration - Quick Test Script
# Run this to manually fetch weather for all POIs (no n8n required for testing)

import requests
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

BACKEND_URL = "http://localhost:5000"
WEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY')  # Loaded from .env file

def test_weather_integration():
    """Test weather fetching without n8n"""
    
    print("🌤️  Weather Integration Test\n")
    
    # Step 1: Get all POIs
    print("📍 Fetching POIs from backend...")
    try:
        response = requests.get(f"{BACKEND_URL}/api/webhooks/weather/pois")
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Error connecting to backend: {e}")
        print("\n💡 Make sure backend is running: python app.py")
        return
    
    if not data.get('success'):
        print(f"❌ Backend error: {data.get('message')}")
        return
    
    pois = data.get('pois', [])
    print(f"✅ Found {len(pois)} POIs\n")
    
    if len(pois) == 0:
        print("💡 No POIs found. Create some towers in your app first!")
        return
    
    if WEATHER_API_KEY == "YOUR_OPENWEATHERMAP_API_KEY":
        print("❌ Please set your OpenWeatherMap API key in this script!")
        print("   Get free API key at: https://openweathermap.org/api")
        return
    
    # Step 2: Fetch and update weather for each POI
    for poi in pois:
        poi_id = poi['poi_id']
        name = poi['name']
        lat = poi['latitude']
        lon = poi['longitude']
        
        print(f"🌡️  {name} ({lat:.4f}, {lon:.4f})")
        
        # Fetch weather from OpenWeatherMap
        try:
            weather_url = "https://api.openweathermap.org/data/2.5/weather"
            params = {
                'lat': lat,
                'lon': lon,
                'appid': WEATHER_API_KEY,
                'units': 'metric'
            }
            weather_response = requests.get(weather_url, params=params)
            weather_response.raise_for_status()
            weather_data = weather_response.json()
            
            # Update backend
            update_payload = {
                'poi_id': poi_id,
                'weather': {
                    'temp': weather_data['main']['temp'],
                    'humidity': weather_data['main']['humidity'],
                    'wind_speed': weather_data['wind']['speed'],
                    'wind_direction': weather_data['wind']['deg'],
                    'description': weather_data['weather'][0]['description'],
                    'icon': weather_data['weather'][0]['icon']
                }
            }
            
            update_response = requests.post(
                f"{BACKEND_URL}/api/webhooks/weather/update",
                json=update_payload
            )
            update_response.raise_for_status()
            
            temp = weather_data['main']['temp']
            desc = weather_data['weather'][0]['description']
            wind = weather_data['wind']['speed']
            
            print(f"   ✅ {temp}°C, {desc}, Wind: {wind} m/s")
            
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Error: {e}")
    
    print("\n🎉 Weather update complete!")
    print("💡 Open your app and click on tower markers to see weather data!")

if __name__ == '__main__':
    test_weather_integration()
