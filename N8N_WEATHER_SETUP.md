# n8n Weather Integration Setup

This guide will help you set up automatic weather data fetching for your tower locations using n8n.

## 🎯 What This Does

- Automatically fetches real-time weather data for all tower locations (POIs)
- Updates every 30 minutes (or your preferred interval)
- Displays temperature, humidity, wind speed/direction on map markers
- Works with OpenWeatherMap API (free tier available)

## 📋 Prerequisites

1. **n8n installed** - Choose one:
   - Docker: `docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n`
   - npm: `npm install n8n -g` then `n8n start`
   - n8n Cloud: https://n8n.io/cloud

2. **OpenWeatherMap API Key** (Free):
   - Sign up at https://openweathermap.org/api
   - Get your API key from your account dashboard
   - Free tier: 1,000 calls/day (more than enough)

3. **Backend running**: Your Flask backend should be running on `http://localhost:5000`

## 🚀 Quick Setup (5 Minutes)

### Step 1: Access n8n
- Open http://localhost:5678 (if self-hosted)
- Or log into n8n Cloud

### Step 2: Create New Workflow

1. Click **"New Workflow"**
2. Name it: **"Weather Auto-Update for Towers"**

### Step 3: Add Nodes

You'll need **4 nodes** in this workflow:

#### Node 1: Schedule Trigger (Every 30 minutes)
```
1. Add "Schedule Trigger" node
2. Configure:
   - Trigger Interval: Every 30 minutes
   - Or use Cron: */30 * * * *
```

#### Node 2: HTTP Request - Get POIs
```
1. Add "HTTP Request" node
2. Connect it to Schedule Trigger
3. Configure:
   - Method: GET
   - URL: http://localhost:5000/api/webhooks/weather/pois
   - Authentication: None
   - Response Format: JSON
```

#### Node 3: Loop Over Items + HTTP Request - Get Weather
```
1. Add "Code" node (to split array)
2. Configure:
   Code (JavaScript):
   
   // This splits the POI array so each POI is processed individually
   return items[0].json.pois.map(poi => ({
     json: {
       poi_id: poi.poi_id,
       name: poi.name,
       lat: poi.latitude,
       lon: poi.longitude
     }
   }));

3. Add "HTTP Request" node for OpenWeatherMap
4. Connect it to Code node
5. Configure:
   - Method: GET
   - URL: https://api.openweathermap.org/data/2.5/weather
   - Query Parameters:
     * lat = {{$json.lat}}
     * lon = {{$json.lon}}
     * appid = YOUR_API_KEY_HERE
     * units = metric
   - Response Format: JSON
```

#### Node 4: HTTP Request - Update Backend
```
1. Add final "HTTP Request" node
2. Connect to previous weather request
3. Configure:
   - Method: POST
   - URL: http://localhost:5000/api/webhooks/weather/update
   - Body Content Type: JSON
   - Body:
   {
     "poi_id": "{{$node['Code'].json.poi_id}}",
     "weather": {
       "temp": "{{$json.main.temp}}",
       "humidity": "{{$json.main.humidity}}",
       "wind_speed": "{{$json.wind.speed}}",
       "wind_direction": "{{$json.wind.deg}}",
       "description": "{{$json.weather[0].description}}",
       "icon": "{{$json.weather[0].icon}}"
     }
   }
```

### Step 4: Test Workflow

1. Click **"Execute Workflow"** button
2. Check execution log - should see green checkmarks
3. Open your app and click on a tower marker
4. Weather data should appear!

### Step 5: Activate Workflow

1. Toggle switch at top right: **OFF → ON**
2. Workflow now runs automatically every 30 minutes

---

## 📊 Complete n8n Workflow JSON

Copy this JSON and import directly into n8n:

```json
{
  "name": "Weather Auto-Update for Towers",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "minutes",
              "minutesInterval": 30
            }
          ]
        }
      },
      "name": "Every 30 minutes",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "http://localhost:5000/api/webhooks/weather/pois",
        "options": {}
      },
      "name": "Get All POIs",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [450, 300]
    },
    {
      "parameters": {
        "jsCode": "return items[0].json.pois.map(poi => ({\n  json: {\n    poi_id: poi.poi_id,\n    name: poi.name,\n    lat: poi.latitude,\n    lon: poi.longitude\n  }\n}));"
      },
      "name": "Split POIs",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [650, 300]
    },
    {
      "parameters": {
        "url": "https://api.openweathermap.org/data/2.5/weather",
        "queryParameters": {
          "parameters": [
            {
              "name": "lat",
              "value": "={{$json.lat}}"
            },
            {
              "name": "lon",
              "value": "={{$json.lon}}"
            },
            {
              "name": "appid",
              "value": "YOUR_OPENWEATHERMAP_API_KEY"
            },
            {
              "name": "units",
              "value": "metric"
            }
          ]
        },
        "options": {}
      },
      "name": "Fetch Weather",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [850, 300]
    },
    {
      "parameters": {
        "url": "http://localhost:5000/api/webhooks/weather/update",
        "method": "POST",
        "jsonParameters": true,
        "options": {},
        "bodyParametersJson": "={\n  \"poi_id\": {{$node['Split POIs'].json.poi_id}},\n  \"weather\": {\n    \"temp\": {{$json.main.temp}},\n    \"humidity\": {{$json.main.humidity}},\n    \"wind_speed\": {{$json.wind.speed}},\n    \"wind_direction\": {{$json.wind.deg}},\n    \"description\": \"{{$json.weather[0].description}}\",\n    \"icon\": \"{{$json.weather[0].icon}}\"\n  }\n}"
      },
      "name": "Update Backend",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [1050, 300]
    }
  ],
  "connections": {
    "Every 30 minutes": {
      "main": [[{"node": "Get All POIs", "type": "main", "index": 0}]]
    },
    "Get All POIs": {
      "main": [[{"node": "Split POIs", "type": "main", "index": 0}]]
    },
    "Split POIs": {
      "main": [[{"node": "Fetch Weather", "type": "main", "index": 0}]]
    },
    "Fetch Weather": {
      "main": [[{"node": "Update Backend", "type": "main", "index": 0}]]
    }
  }
}
```

**To import:**
1. Copy the JSON above
2. In n8n, click **"..." menu** → **"Import from File/URL"**
3. Paste JSON
4. Replace `YOUR_OPENWEATHERMAP_API_KEY` with your actual API key
5. Save and activate!

---

## 🔧 Customization Options

### Change Update Frequency

**Every hour:**
```
Cron: 0 * * * *
```

**Every 15 minutes:**
```
Cron: */15 * * * *
```

**Once per day at 6 AM:**
```
Cron: 0 6 * * *
```

### Use Different Weather API

Replace OpenWeatherMap with:
- **WeatherAPI.com**: https://www.weatherapi.com
- **AccuWeather**: https://developer.accuweather.com
- **Tomorrow.io**: https://www.tomorrow.io

Just adjust the HTTP Request node URL and response mapping.

---

## 🛠️ Troubleshooting

### Weather not showing?

1. **Check n8n execution log:**
   - Click on workflow execution
   - Look for errors (red nodes)
   - Common issue: API key not set

2. **Verify backend is running:**
   ```bash
   curl http://localhost:5000/api/webhooks/weather/pois
   ```
   Should return list of POIs

3. **Check API key validity:**
   - OpenWeatherMap API keys take ~10 minutes to activate
   - Test at: `https://api.openweathermap.org/data/2.5/weather?lat=40.71&lon=-74.01&appid=YOUR_KEY`

4. **Database migration needed:**
   - Stop backend
   - Delete `backend/instance/radio_link_planner.db`
   - Restart backend (recreates with weather columns)

### No POIs returned?

- Create at least one tower/POI in your app first
- Check database has data: `sqlite3 backend/instance/radio_link_planner.db "SELECT * FROM pois;"`

### n8n not accessible?

**Docker users:**
```bash
docker ps  # Check if running
docker logs n8n  # Check logs
```

**npm users:**
```bash
n8n start  # Restart
```

---

## 📈 Advanced Features

### Email Alerts for Extreme Weather

Add "Send Email" node after weather fetch:

```javascript
// In IF node, check conditions:
if ($json.main.temp > 40 || $json.wind.speed > 20) {
  return true;  // Trigger email
}
```

### Store Historical Weather Data

Add "PostgreSQL" or "MySQL" node to log weather history for trend analysis.

### Weather-based Tower Alerts

Send Slack/Discord notification when conditions affect signal quality:
- High winds (>15 m/s)
- Extreme temperatures (<-20°C or >45°C)
- Heavy precipitation

---

## 🔐 Security Notes

- **Never commit API keys** to Git
- Use n8n environment variables for sensitive data
- If exposing n8n publicly, enable authentication
- Use HTTPS for production deployments

---

## 📚 API Reference

### Backend Endpoints

#### GET `/api/webhooks/weather/pois`
Returns all POIs with coordinates for weather fetching.

**Response:**
```json
{
  "success": true,
  "count": 3,
  "pois": [
    {
      "poi_id": 1,
      "name": "Tower A",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "project_id": 1,
      "last_weather_update": "2026-01-12T10:30:00"
    }
  ]
}
```

#### POST `/api/webhooks/weather/update`
Updates weather data for a specific POI.

**Request:**
```json
{
  "poi_id": 1,
  "weather": {
    "temp": 22.5,
    "humidity": 65,
    "wind_speed": 5.2,
    "wind_direction": 180,
    "description": "Clear sky",
    "icon": "01d"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Weather updated for POI Tower A",
  "poi_id": 1
}
```

#### GET `/api/pois/<poi_id>/weather`
Get current weather for a specific POI.

---

## ✅ Verification

After setup, you should see:

1. **In n8n dashboard:**
   - Green checkmarks on all nodes
   - Last execution timestamp updating every 30 min

2. **In your app:**
   - Click any tower marker
   - Weather panel appears with:
     - Temperature
     - Weather icon
     - Humidity
     - Wind speed/direction
     - "Updated X minutes ago" timestamp

3. **In browser console (F12):**
   - No errors
   - POI objects include `weather` property

---

## 🎉 Success!

Your tower locations now have live weather data! This helps with:
- **Planning maintenance** during good weather
- **Predicting signal interference** from weather conditions
- **Safety monitoring** for field technicians
- **Professional presentations** with live data

## 💡 Next Steps

- Add more weather metrics (pressure, visibility, UV index)
- Create weather-based reports
- Build weather history charts
- Set up weather-triggered notifications

---

**Need help?** Check n8n docs: https://docs.n8n.io
