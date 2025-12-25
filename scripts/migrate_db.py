"""
Database Migration Script: SQLite → PostgreSQL

This script exports data from SQLite and imports into PostgreSQL.
Run this ONCE during migration.

Usage:
    python migrate_db.py --sqlite-path ./climaroute.db --pg-host localhost --pg-db climaroute
"""

import argparse
import sqlite3
import psycopg2
from psycopg2.extras import execute_batch
from datetime import datetime

def get_sqlite_tables(sqlite_conn):
    """Get list of tables from SQLite"""
    cursor = sqlite_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    return [row[0] for row in cursor.fetchall()]

def get_table_schema(sqlite_conn, table_name):
    """Get column info for a table"""
    cursor = sqlite_conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    return cursor.fetchall()

def sqlite_to_pg_type(sqlite_type):
    """Convert SQLite type to PostgreSQL type"""
    type_map = {
        'INTEGER': 'INTEGER',
        'TEXT': 'TEXT',
        'REAL': 'DOUBLE PRECISION',
        'BLOB': 'BYTEA',
        'NUMERIC': 'NUMERIC',
        '': 'TEXT'  # Default
    }
    return type_map.get(sqlite_type.upper(), 'TEXT')

def migrate_table(sqlite_conn, pg_conn, table_name):
    """Migrate a single table from SQLite to PostgreSQL"""
    print(f"  📦 Migrating table: {table_name}")
    
    # Get schema
    schema = get_table_schema(sqlite_conn, table_name)
    columns = [(col[1], col[2], col[5]) for col in schema]  # name, type, is_pk
    
    # Create PostgreSQL table
    pg_cursor = pg_conn.cursor()
    
    # Build CREATE TABLE statement
    col_defs = []
    for name, dtype, is_pk in columns:
        pg_type = sqlite_to_pg_type(dtype)
        col_def = f'"{name}" {pg_type}'
        if is_pk:
            col_def += ' PRIMARY KEY'
        col_defs.append(col_def)
    
    create_sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({", ".join(col_defs)})'
    
    try:
        pg_cursor.execute(f'DROP TABLE IF EXISTS "{table_name}" CASCADE')
        pg_cursor.execute(create_sql)
        pg_conn.commit()
    except Exception as e:
        print(f"    ⚠️ Error creating table: {e}")
        pg_conn.rollback()
        return 0
    
    # Get data from SQLite
    sqlite_cursor = sqlite_conn.cursor()
    sqlite_cursor.execute(f'SELECT * FROM "{table_name}"')
    rows = sqlite_cursor.fetchall()
    
    if not rows:
        print(f"    ✓ Table empty, schema created")
        return 0
    
    # Insert into PostgreSQL
    col_names = [col[0] for col in columns]
    placeholders = ', '.join(['%s'] * len(col_names))
    insert_sql = f'INSERT INTO "{table_name}" ({", ".join([f\'"{c}\'' for c in col_names])}) VALUES ({placeholders})'
    
    try:
        execute_batch(pg_cursor, insert_sql, rows, page_size=1000)
        pg_conn.commit()
        print(f"    ✓ Migrated {len(rows)} rows")
        return len(rows)
    except Exception as e:
        print(f"    ⚠️ Error inserting data: {e}")
        pg_conn.rollback()
        return 0

def main():
    parser = argparse.ArgumentParser(description='Migrate SQLite to PostgreSQL')
    parser.add_argument('--sqlite-path', required=True, help='Path to SQLite database')
    parser.add_argument('--pg-host', default='localhost', help='PostgreSQL host')
    parser.add_argument('--pg-port', default=5432, type=int, help='PostgreSQL port')
    parser.add_argument('--pg-db', default='climaroute', help='PostgreSQL database name')
    parser.add_argument('--pg-user', default='postgres', help='PostgreSQL user')
    parser.add_argument('--pg-password', default='postgres', help='PostgreSQL password')
    
    args = parser.parse_args()
    
    print("=" * 50)
    print("🚀 SQLite → PostgreSQL Migration")
    print("=" * 50)
    print(f"Source: {args.sqlite_path}")
    print(f"Target: {args.pg_host}:{args.pg_port}/{args.pg_db}")
    print("=" * 50)
    
    # Connect to SQLite
    print("\n📂 Connecting to SQLite...")
    sqlite_conn = sqlite3.connect(args.sqlite_path)
    
    # Connect to PostgreSQL
    print("🐘 Connecting to PostgreSQL...")
    pg_conn = psycopg2.connect(
        host=args.pg_host,
        port=args.pg_port,
        dbname=args.pg_db,
        user=args.pg_user,
        password=args.pg_password
    )
    
    # Get tables
    tables = get_sqlite_tables(sqlite_conn)
    print(f"\n📋 Found {len(tables)} tables to migrate: {tables}")
    
    # Migrate each table
    total_rows = 0
    for table in tables:
        rows = migrate_table(sqlite_conn, pg_conn, table)
        total_rows += rows
    
    # Cleanup
    sqlite_conn.close()
    pg_conn.close()
    
    print("\n" + "=" * 50)
    print(f"✅ Migration complete! {total_rows} total rows migrated.")
    print("=" * 50)

if __name__ == "__main__":
    main()
