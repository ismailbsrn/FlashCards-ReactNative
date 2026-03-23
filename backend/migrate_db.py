"""
Database migration script to add tags and color columns to collections table
"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'flashcards.db')

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA table_info(collections)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'tags' not in columns:
        print("Adding 'tags' column to collections table...")
        cursor.execute("ALTER TABLE collections ADD COLUMN tags TEXT")
        print("✓ Added 'tags' column")
    else:
        print("✓ 'tags' column already exists")
    
    if 'color' not in columns:
        print("Adding 'color' column to collections table...")
        cursor.execute("ALTER TABLE collections ADD COLUMN color TEXT")
        print("✓ Added 'color' column")
    else:
        print("✓ 'color' column already exists")
    
    conn.commit()
    conn.close()
    print("\nMigration completed successfully!")
else:
    print("Database does not exist yet. It will be created with the new schema on first run.")
