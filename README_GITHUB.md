# Spatial Analysis Tool - Radio Link Planner

A comprehensive GIS web application for radio/telecom network planning with automatic weather integration.

## 🚀 Features

- **Interactive Map Interface** - OpenLayers-based with 3D visualization
- **Radio Link Planning** - Tower placement, connection analysis, line-of-sight calculations
- **Automatic Weather Integration** - Real-time weather data for tower locations
- **Project Management** - Create, save, and manage multiple projects
- **User Authentication** - Secure registration with email verification
- **Elevation Data** - Automatic terrain elevation fetching
- **PDF Export** - Generate professional reports
- **AI Chatbot** - Integrated assistant for help

## 📋 Prerequisites

- **Node.js** (v18+) & npm
- **Python** (v3.8+)
- **Angular CLI** (`npm install -g @angular/cli`)
- **OpenWeatherMap API Key** (free tier available)

## 🔧 Installation

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/spatial-analysis-tool.git
cd spatial-analysis-tool
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and add your API keys
```

**Important:** Edit `backend/.env` and set:
- `OPENWEATHER_API_KEY` - Get free key from https://openweathermap.org/api
- `SECRET_KEY` - Generate a secure random key
- `MAIL_*` variables (optional, for email verification)

### 3. Frontend Setup

```bash
cd ..  # Back to root directory
npm install
```

## ▶️ Running the Application

### Start Backend Server

```bash
cd backend
python app.py
```
Backend runs on: http://localhost:5000

### Start Frontend Server

```bash
cd ..  # Back to root directory
ng serve
```
Frontend runs on: http://localhost:4200

Open browser to: **http://localhost:4200**

## 🌤️ Weather Integration

Weather data is automatically fetched when you create tower locations:

1. **Register/Login** in the application
2. **Create a project**
3. **Click on map** to add tower locations
4. **Click marker popup** to see:
   - 🌡️ Temperature
   - 💧 Humidity
   - 💨 Wind speed & direction
   - ☁️ Weather conditions with icon
   - ⏰ Last updated time

### Optional: n8n Workflow Automation

For automated weather updates every 30 minutes, see [N8N_WEATHER_SETUP.md](N8N_WEATHER_SETUP.md)

## 📁 Project Structure

```
spatial-analysis-tool/
├── backend/               # Flask backend
│   ├── app.py            # Main application
│   ├── models.py         # Database models
│   ├── database.py       # Database configuration
│   ├── requirements.txt  # Python dependencies
│   ├── .env.example      # Environment variables template
│   └── instance/         # SQLite database (auto-created)
├── src/                  # Angular frontend
│   ├── app/
│   │   ├── components/   # UI components
│   │   ├── services/     # API services
│   │   └── models/       # TypeScript interfaces
│   └── assets/           # Static assets
├── angular.json          # Angular configuration
├── package.json          # Node dependencies
└── README.md
```

## 🔐 Security

- ✅ Environment variables for sensitive data
- ✅ `.gitignore` configured to exclude secrets
- ✅ Database excluded from version control
- ✅ JWT-based authentication
- ✅ Password hashing with werkzeug

**Never commit:**
- `.env` files
- `instance/` folder (database)
- API keys or passwords

## 📖 Documentation

- [Setup Guide](SETUP.md)
- [Authentication Guide](AUTHENTICATION.md)
- [Email Verification Setup](EMAIL_VERIFICATION_SETUP.md)
- [Backend Integration](BACKEND_INTEGRATION.md)
- [n8n Weather Automation](N8N_WEATHER_SETUP.md)
- [Chatbot Setup](CHATBOT_SETUP.md)

## 🛠️ Technologies

**Frontend:**
- Angular 20+
- Leaflet/OpenLayers (Maps)
- TypeScript
- RxJS

**Backend:**
- Python Flask
- SQLAlchemy (ORM)
- SQLite (Database)
- Flask-Mail
- JWT Authentication

**APIs:**
- OpenWeatherMap (Weather data)
- Open-Elevation (Terrain data)

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-code` - Email verification

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### POIs (Tower Locations)
- `POST /api/projects/:id/pois` - Create POI (auto-fetches weather)
- `PUT /api/projects/:id/pois/:poiId` - Update POI
- `DELETE /api/projects/:id/pois/:poiId` - Delete POI
- `GET /api/pois/:id/weather` - Get weather data
- `POST /api/pois/:id/weather/refresh` - Refresh weather

### Connections
- `POST /api/projects/:id/connections` - Create connection
- `PUT /api/projects/:id/connections/:connId` - Update connection
- `DELETE /api/projects/:id/connections/:connId` - Delete connection

## 🤝 Contributing

This is a private repository. Contact the maintainer for access.

## 📄 License

Private - All rights reserved

## 👤 Author

Your Name

## 🐛 Issues

Report issues via GitHub Issues (private repository)

---

**Made with ❤️ for radio network planning professionals**
