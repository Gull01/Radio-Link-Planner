from datetime import datetime
from database import db
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    verification_code = db.Column(db.String(6), nullable=True)
    code_expiry = db.Column(db.DateTime, nullable=True)
    is_verified = db.Column(db.Boolean, default=False)
    
    def set_password(self, password):
        """Hash and set the password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if password matches the hash"""
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f'<User {self.username}>'

class Project(db.Model):
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    pois = db.relationship('POI', backref='project', lazy=True, cascade='all, delete-orphan')
    connections = db.relationship('Connection', backref='project', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Project {self.name}>'

class POI(db.Model):
    __tablename__ = 'pois'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    elevation = db.Column(db.Float, default=0)
    tower_height = db.Column(db.Float, default=0)
    color = db.Column(db.String(7), default='#3388ff')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Weather data fields (populated by n8n)
    weather_temp = db.Column(db.Float, nullable=True)  # Temperature in Celsius
    weather_humidity = db.Column(db.Float, nullable=True)  # Humidity percentage
    weather_wind_speed = db.Column(db.Float, nullable=True)  # Wind speed in m/s
    weather_wind_direction = db.Column(db.Float, nullable=True)  # Wind direction in degrees
    weather_description = db.Column(db.String(255), nullable=True)  # Weather condition
    weather_icon = db.Column(db.String(10), nullable=True)  # Weather icon code
    weather_updated_at = db.Column(db.DateTime, nullable=True)  # Last weather update
    
    def __repr__(self):
        return f'<POI {self.name} ({self.latitude}, {self.longitude})>'

class Connection(db.Model):
    __tablename__ = 'connections'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    from_poi_id = db.Column(db.Integer, db.ForeignKey('pois.id'), nullable=False)
    to_poi_id = db.Column(db.Integer, db.ForeignKey('pois.id'), nullable=False)
    distance = db.Column(db.Float, nullable=False)
    signal_strength = db.Column(db.Float, default=0)
    line_of_sight = db.Column(db.Boolean, default=False)
    min_clearance = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    from_poi = db.relationship('POI', foreign_keys=[from_poi_id])
    to_poi = db.relationship('POI', foreign_keys=[to_poi_id])
    
    def __repr__(self):
        return f'<Connection {self.from_poi_id} -> {self.to_poi_id}>'
