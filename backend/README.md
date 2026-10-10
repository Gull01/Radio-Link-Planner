# Radio Link Planner - Backend

Flask + SQLite backend for the Radio Link Planner application.

## Setup

1. Install Python dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Run the Flask server:
```bash
python app.py
```

The API will be available at `http://localhost:5000`

## API Endpoints

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create a new project
- `GET /api/projects/:id` - Get a specific project with all data
- `PUT /api/projects/:id` - Update project details
- `DELETE /api/projects/:id` - Delete a project

### POIs (Tower Locations)
- `POST /api/projects/:id/pois` - Create a new POI
- `PUT /api/projects/:id/pois/:poi_id` - Update a POI
- `DELETE /api/projects/:id/pois/:poi_id` - Delete a POI

### Connections (Radio Links)
- `POST /api/projects/:id/connections` - Create a new connection
- `PUT /api/projects/:id/connections/:conn_id` - Update a connection
- `DELETE /api/projects/:id/connections/:conn_id` - Delete a connection

### Health Check
- `GET /api/health` - Check if API is running

## Database

SQLite database file: `radio_link_planner.db`

The database is automatically created on first run with the following tables:
- `projects` - Stores project information
- `pois` - Stores tower locations with coordinates and heights
- `connections` - Stores radio links between towers with analysis results
