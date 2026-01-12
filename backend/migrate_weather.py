"""
Database Migration: Add Weather Fields to POI Table

Run this script to add weather columns to existing database without losing data.

Usage:
    python migrate_weather.py
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / 'instance' / 'radio_link_planner.db'

def migrate():
    """Add weather columns to pois table"""
    
    if not DB_PATH.exists():
        print(f"❌ Database not found at: {DB_PATH}")
        print("💡 Database will be created automatically when you start the backend.")
        return
    
    print(f"🔧 Migrating database: {DB_PATH}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if columns already exist
    cursor.execute("PRAGMA table_info(pois)")
    columns = [col[1] for col in cursor.fetchall()]
    
    weather_columns = [
        ('weather_temp', 'REAL'),
        ('weather_humidity', 'REAL'),
        ('weather_wind_speed', 'REAL'),
        ('weather_wind_direction', 'REAL'),
        ('weather_description', 'VARCHAR(255)'),
        ('weather_icon', 'VARCHAR(10)'),
        ('weather_updated_at', 'DATETIME')
    ]
    
    added_count = 0
    
    for col_name, col_type in weather_columns:
        if col_name not in columns:
            try:
                sql = f"ALTER TABLE pois ADD COLUMN {col_name} {col_type}"
                cursor.execute(sql)
                print(f"✅ Added column: {col_name}")
                added_count += 1
            except sqlite3.OperationalError as e:
                print(f"⚠️  Column {col_name} might already exist: {e}")
        else:
            print(f"ℹ️  Column {col_name} already exists")
    
    conn.commit()
    conn.close()
    
    if added_count > 0:
        print(f"\n🎉 Migration complete! Added {added_count} weather columns.")
    else:
        print("\n✅ Database already up to date!")
    
    print("\n💡 Next steps:")
    print("   1. Start your backend: python app.py")
    print("   2. Set up n8n workflow (see N8N_WEATHER_SETUP.md)")
    print("   3. Weather data will appear on tower markers!")

if __name__ == '__main__':
    migrate()
