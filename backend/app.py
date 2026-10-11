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
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Database configuration - supports DATABASE_URL (e.g., Neon/Supabase PostgreSQL) or SQLite fallback
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
default_db = f"sqlite:///{os.path.join(BASE_DIR, 'radio_link_planner.db')}"
database_url = os.environ.get('DATABASE_URL', default_db)
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
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

# Authentication endpoints
@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user - Instant registration without email verification"""
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

        # Create new user - Instant registration (email saved for future password reset)
        user = User(username=username, email=email)
        user.set_password(password)
        user.is_verified = True  # Auto-verified, no email confirmation needed
        
        db.session.add(user)
        db.session.commit()

        # Generate JWT token for instant login
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
    """Login user"""
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
        'color': poi.color
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
    """Create a new POI for a project"""
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
    
    return jsonify({
        'id': poi.id,
        'name': poi.name,
        'latitude': poi.latitude,
        'longitude': poi.longitude,
        'elevation': poi.elevation,
        'tower_height': poi.tower_height,
        'color': poi.color
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

@app.route('/api/chat', methods=['POST'])
def proxy_chat():
    """Proxy chat requests to Google Gemini securely without exposing the API key to users"""
    try:
        import urllib.request
        import json

        data = request.json or {}
        gemini_key = os.environ.get('GEMINI_API_KEY')
        if not gemini_key:
            return jsonify({'error': {'message': 'Gemini API key is not configured on server'}}), 500

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={gemini_key}"
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            return jsonify(result), resp.status
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        try:
            return jsonify(json.loads(error_body)), e.code
        except Exception:
            return jsonify({'error': {'message': error_body}}), e.code
    except Exception as e:
        return jsonify({'error': {'message': str(e)}}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
