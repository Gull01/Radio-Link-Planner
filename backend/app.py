from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_mail import Mail, Message
from database import db, init_db
from models import Project, POI, Connection, User
from datetime import datetime, timedelta
import os
import jwt
import re
import random
import string
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///radio_link_planner.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here-change-in-production')

# Email configuration - works with any SMTP server
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'true').lower() == 'true'
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'false').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')  # Your email
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')  # Your email password or app password
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', os.environ.get('MAIL_USERNAME'))

# Weather API configuration
WEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '373a966a30cdc66cc51bbdbb57a904d7')
WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather'

CORS(app)
db.init_app(app)
mail = Mail(app)

with app.app_context():
    init_db()

def generate_verification_code():
    """Generate a 6-digit verification code"""
    return ''.join(random.choices(string.digits, k=6))

def send_verification_email(email, code, username):
    """Send verification code via email"""
    try:
        msg = Message(
            subject='Your Verification Code',
            recipients=[email],
            body=f'''Hello {username},

Your verification code is: {code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Best regards,
Spatial Analysis Tool Team'''
        )
        mail.send(msg)
        return True
    except Exception as e:
        print(f'Error sending email: {str(e)}')
        return False

def fetch_weather_for_poi(latitude, longitude):
    """Fetch weather data from OpenWeatherMap API"""
    try:
        params = {
            'lat': latitude,
            'lon': longitude,
            'appid': WEATHER_API_KEY,
            'units': 'metric'
        }
        response = requests.get(WEATHER_API_URL, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        return {
            'temp': data['main']['temp'],
            'humidity': data['main']['humidity'],
            'wind_speed': data['wind']['speed'],
            'wind_direction': data['wind']['deg'],
            'description': data['weather'][0]['description'],
            'icon': data['weather'][0]['icon']
        }
    except Exception as e:
        print(f'Error fetching weather: {str(e)}')
        return None

# Authentication endpoints
@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user - Email verification bypassed for testing"""
    try:
        data = request.json
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        # Validation
        if not username or len(username) < 3:
            return jsonify({'success': False, 'message': 'Username must be at least 3 characters'}), 400
        
        if not email or not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            return jsonify({'success': False, 'message': 'Invalid email address'}), 400
        
        if not password or len(password) < 6:
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400

        # Check if user already exists
        if User.query.filter_by(username=username).first():
            return jsonify({'success': False, 'message': 'Username already exists'}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already registered'}), 400

        # Create new user - Auto-verify for testing (no email required)
        user = User(username=username, email=email)
        user.set_password(password)
        user.is_verified = True  # Auto-verify without email
        
        db.session.add(user)
        db.session.commit()

        # Generate JWT token
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.utcnow() + timedelta(days=30)
        }, app.config['SECRET_KEY'], algorithm='HS256')

        return jsonify({
            'success': True,
            'message': 'Registration successful',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'created_at': user.created_at.isoformat()
            },
            'token': token
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/verify-code', methods=['POST'])
def verify_code():
    """Verify the code sent to user's email"""
    try:
        data = request.json
        user_id = data.get('user_id')
        code = data.get('code', '').strip()

        if not user_id or not code:
            return jsonify({'success': False, 'message': 'User ID and code are required'}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        # Check if code matches and is not expired
        if user.verification_code != code:
            return jsonify({'success': False, 'message': 'Invalid verification code'}), 400

        if user.code_expiry < datetime.utcnow():
            return jsonify({'success': False, 'message': 'Verification code has expired'}), 400

        # Mark user as verified
        user.is_verified = True
        user.verification_code = None
        user.code_expiry = None
        db.session.commit()

        # Generate JWT token
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.utcnow() + timedelta(days=30)
        }, app.config['SECRET_KEY'], algorithm='HS256')

        return jsonify({
            'success': True,
            'message': 'Email verified successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'created_at': user.created_at.isoformat()
            },
            'token': token
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/resend-code', methods=['POST'])
def resend_code():
    """Resend verification code to user's email"""
    try:
        data = request.json
        user_id = data.get('user_id')

        if not user_id:
            return jsonify({'success': False, 'message': 'User ID is required'}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        if user.is_verified:
            return jsonify({'success': False, 'message': 'Email is already verified'}), 400

        # Generate new verification code
        code = generate_verification_code()
        user.verification_code = code
        user.code_expiry = datetime.utcnow() + timedelta(minutes=10)
        db.session.commit()

        # Send verification email
        if send_verification_email(user.email, code, user.username):
            return jsonify({
                'success': True,
                'message': 'Verification code resent successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to send verification email'
            }), 500

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login user - Email verification bypassed for testing"""
    try:
        data = request.json
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password are required'}), 400

        # Find user by email
        user = User.query.filter_by(email=email).first()

        if not user or not user.check_password(password):
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401

        # Auto-verify if not verified (for testing without email)
        if not user.is_verified:
            user.is_verified = True
            db.session.commit()

        # Generate JWT token
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.utcnow() + timedelta(days=30)
        }, app.config['SECRET_KEY'], algorithm='HS256')

        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'created_at': user.created_at.isoformat()
            },
            'token': token
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Projects endpoints
@app.route('/api/projects', methods=['GET'])
def get_projects():
    """Get all projects"""
    projects = Project.query.all()
    return jsonify([{
        'id': p.id,
        'name': p.name,
        'description': p.description,
        'created_at': p.created_at.isoformat(),
        'updated_at': p.updated_at.isoformat(),
        'poi_count': len(p.pois),
        'connection_count': len(p.connections)
    } for p in projects])

@app.route('/api/projects', methods=['POST'])
def create_project():
    """Create a new project"""
    data = request.json
    project = Project(
        name=data.get('name', 'Untitled Project'),
        description=data.get('description', '')
    )
    db.session.add(project)
    db.session.commit()
    return jsonify({
        'id': project.id,
        'name': project.name,
        'description': project.description,
        'created_at': project.created_at.isoformat(),
        'updated_at': project.updated_at.isoformat()
    }), 201

@app.route('/api/projects/<int:project_id>', methods=['GET'])
def get_project(project_id):
    """Get a specific project with all its data"""
    project = Project.query.get_or_404(project_id)
    
    pois_data = [{
        'id': poi.id,
        'name': poi.name,
        'latitude': poi.latitude,
        'longitude': poi.longitude,
        'elevation': poi.elevation,
        'tower_height': poi.tower_height,
        'color': poi.color,
        'weather': {
            'temp': poi.weather_temp,
            'humidity': poi.weather_humidity,
            'wind_speed': poi.weather_wind_speed,
            'wind_direction': poi.weather_wind_direction,
            'description': poi.weather_description,
            'icon': poi.weather_icon,
            'updated_at': poi.weather_updated_at.isoformat() if poi.weather_updated_at else None
        } if poi.weather_temp is not None else None
    } for poi in project.pois]
    
    connections_data = [{
        'id': conn.id,
        'from_poi_id': conn.from_poi_id,
        'to_poi_id': conn.to_poi_id,
        'distance': conn.distance,
        'signal_strength': conn.signal_strength,
        'line_of_sight': conn.line_of_sight,
        'min_clearance': conn.min_clearance
    } for conn in project.connections]
    
    return jsonify({
        'id': project.id,
        'name': project.name,
        'description': project.description,
        'created_at': project.created_at.isoformat(),
        'updated_at': project.updated_at.isoformat(),
        'pois': pois_data,
        'connections': connections_data
    })

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    """Update project details"""
    project = Project.query.get_or_404(project_id)
    data = request.json
    
    if 'name' in data:
        project.name = data['name']
    if 'description' in data:
        project.description = data['description']
    
    project.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'id': project.id,
        'name': project.name,
        'description': project.description,
        'updated_at': project.updated_at.isoformat()
    })

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project and all its data"""
    project = Project.query.get_or_404(project_id)
    db.session.delete(project)
    db.session.commit()
    return '', 204

# POI endpoints
@app.route('/api/projects/<int:project_id>/pois', methods=['POST'])
def create_poi(project_id):
    """Create a new POI for a project and auto-fetch weather"""
    project = Project.query.get_or_404(project_id)
    data = request.json
    
    poi = POI(
        project_id=project_id,
        name=data['name'],
        latitude=data['latitude'],
        longitude=data['longitude'],
        elevation=data.get('elevation', 0),
        tower_height=data.get('tower_height', 0),
        color=data.get('color', '#3388ff')
    )
    
    db.session.add(poi)
    project.updated_at = datetime.utcnow()
    db.session.commit()
    
    # Auto-fetch weather data
    weather = fetch_weather_for_poi(poi.latitude, poi.longitude)
    if weather:
        poi.weather_temp = weather['temp']
        poi.weather_humidity = weather['humidity']
        poi.weather_wind_speed = weather['wind_speed']
        poi.weather_wind_direction = weather['wind_direction']
        poi.weather_description = weather['description']
        poi.weather_icon = weather['icon']
        poi.weather_updated_at = datetime.utcnow()
        db.session.commit()
    
    return jsonify({
        'id': poi.id,
        'name': poi.name,
        'latitude': poi.latitude,
        'longitude': poi.longitude,
        'elevation': poi.elevation,
        'tower_height': poi.tower_height,
        'color': poi.color,
        'weather': {
            'temp': poi.weather_temp,
            'humidity': poi.weather_humidity,
            'wind_speed': poi.weather_wind_speed,
            'wind_direction': poi.weather_wind_direction,
            'description': poi.weather_description,
            'icon': poi.weather_icon,
            'updated_at': poi.weather_updated_at.isoformat() if poi.weather_updated_at else None
        } if poi.weather_temp is not None else None
    }), 201

@app.route('/api/projects/<int:project_id>/pois/<int:poi_id>', methods=['PUT'])
def update_poi(project_id, poi_id):
    """Update a POI"""
    poi = POI.query.filter_by(id=poi_id, project_id=project_id).first_or_404()
    data = request.json
    
    if 'name' in data:
        poi.name = data['name']
    if 'tower_height' in data:
        poi.tower_height = data['tower_height']
    if 'color' in data:
        poi.color = data['color']
    
    poi.project.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'id': poi.id,
        'name': poi.name,
        'tower_height': poi.tower_height,
        'color': poi.color
    })

@app.route('/api/projects/<int:project_id>/pois/<int:poi_id>', methods=['DELETE'])
def delete_poi(project_id, poi_id):
    """Delete a POI"""
    poi = POI.query.filter_by(id=poi_id, project_id=project_id).first_or_404()
    db.session.delete(poi)
    db.session.commit()
    return '', 204

# Connection endpoints
@app.route('/api/projects/<int:project_id>/connections', methods=['POST'])
def create_connection(project_id):
    """Create a new connection for a project"""
    project = Project.query.get_or_404(project_id)
    data = request.json
    
    connection = Connection(
        project_id=project_id,
        from_poi_id=data['from_poi_id'],
        to_poi_id=data['to_poi_id'],
        distance=data['distance'],
        signal_strength=data.get('signal_strength', 0),
        line_of_sight=data.get('line_of_sight', False),
        min_clearance=data.get('min_clearance', 0)
    )
    
    db.session.add(connection)
    project.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'id': connection.id,
        'from_poi_id': connection.from_poi_id,
        'to_poi_id': connection.to_poi_id,
        'distance': connection.distance,
        'signal_strength': connection.signal_strength,
        'line_of_sight': connection.line_of_sight,
        'min_clearance': connection.min_clearance
    }), 201

@app.route('/api/projects/<int:project_id>/connections/<int:connection_id>', methods=['PUT'])
def update_connection(project_id, connection_id):
    """Update a connection"""
    connection = Connection.query.filter_by(id=connection_id, project_id=project_id).first_or_404()
    data = request.json
    
    if 'signal_strength' in data:
        connection.signal_strength = data['signal_strength']
    if 'line_of_sight' in data:
        connection.line_of_sight = data['line_of_sight']
    if 'min_clearance' in data:
        connection.min_clearance = data['min_clearance']
    
    connection.project.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'id': connection.id,
        'signal_strength': connection.signal_strength,
        'line_of_sight': connection.line_of_sight,
        'min_clearance': connection.min_clearance
    })

@app.route('/api/projects/<int:project_id>/connections/<int:connection_id>', methods=['DELETE'])
def delete_connection(project_id, connection_id):
    """Delete a connection"""
    connection = Connection.query.filter_by(id=connection_id, project_id=project_id).first_or_404()
    db.session.delete(connection)
    db.session.commit()
    return '', 204

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Radio Link Planner API is running'})

# Weather webhook endpoints for n8n integration
@app.route('/api/webhooks/weather/update', methods=['POST'])
def update_weather():
    """Webhook to receive weather data from n8n
    
    Expected payload:
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
    """
    try:
        data = request.json
        poi_id = data.get('poi_id')
        weather = data.get('weather', {})
        
        if not poi_id:
            return jsonify({'success': False, 'message': 'poi_id is required'}), 400
        
        poi = POI.query.get(poi_id)
        if not poi:
            return jsonify({'success': False, 'message': 'POI not found'}), 404
        
        # Update weather data
        poi.weather_temp = weather.get('temp')
        poi.weather_humidity = weather.get('humidity')
        poi.weather_wind_speed = weather.get('wind_speed')
        poi.weather_wind_direction = weather.get('wind_direction')
        poi.weather_description = weather.get('description')
        poi.weather_icon = weather.get('icon')
        poi.weather_updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Weather updated for POI {poi.name}',
            'poi_id': poi.id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/webhooks/weather/pois', methods=['GET'])
def get_pois_for_weather():
    """Endpoint for n8n to fetch all POIs that need weather updates
    
    Returns all POIs with their coordinates for n8n to fetch weather data
    """
    try:
        # Get all POIs across all projects
        pois = POI.query.all()
        
        pois_data = [{
            'poi_id': poi.id,
            'name': poi.name,
            'latitude': poi.latitude,
            'longitude': poi.longitude,
            'project_id': poi.project_id,
            'last_weather_update': poi.weather_updated_at.isoformat() if poi.weather_updated_at else None
        } for poi in pois]
        
        return jsonify({
            'success': True,
            'count': len(pois_data),
            'pois': pois_data
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/pois/<int:poi_id>/weather', methods=['GET'])
def get_poi_weather(poi_id):
    """Get current weather data for a specific POI"""
    try:
        poi = POI.query.get_or_404(poi_id)
        
        if poi.weather_temp is None:
            return jsonify({
                'success': False,
                'message': 'No weather data available for this POI'
            }), 404
        
        return jsonify({
            'success': True,
            'poi_id': poi.id,
            'poi_name': poi.name,
            'weather': {
                'temp': poi.weather_temp,
                'humidity': poi.weather_humidity,
                'wind_speed': poi.weather_wind_speed,
                'wind_direction': poi.weather_wind_direction,
                'description': poi.weather_description,
                'icon': poi.weather_icon,
                'updated_at': poi.weather_updated_at.isoformat() if poi.weather_updated_at else None
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/pois/<int:poi_id>/weather/refresh', methods=['POST'])
def refresh_poi_weather(poi_id):
    """Manually refresh weather data for a specific POI"""
    try:
        poi = POI.query.get_or_404(poi_id)
        
        # Fetch fresh weather data
        weather = fetch_weather_for_poi(poi.latitude, poi.longitude)
        
        if not weather:
            return jsonify({
                'success': False,
                'message': 'Failed to fetch weather data'
            }), 500
        
        # Update POI weather fields
        poi.weather_temp = weather['temp']
        poi.weather_humidity = weather['humidity']
        poi.weather_wind_speed = weather['wind_speed']
        poi.weather_wind_direction = weather['wind_direction']
        poi.weather_description = weather['description']
        poi.weather_icon = weather['icon']
        poi.weather_updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Weather updated successfully',
            'poi_id': poi.id,
            'weather': {
                'temp': poi.weather_temp,
                'humidity': poi.weather_humidity,
                'wind_speed': poi.weather_wind_speed,
                'wind_direction': poi.weather_wind_direction,
                'description': poi.weather_description,
                'icon': poi.weather_icon,
                'updated_at': poi.weather_updated_at.isoformat()
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
