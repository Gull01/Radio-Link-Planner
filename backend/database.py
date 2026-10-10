from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def init_db():
    """Initialize the database"""
    db.create_all()
    print("Database initialized successfully!")
