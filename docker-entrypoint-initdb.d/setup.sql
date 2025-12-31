-- ============================
-- USERS
-- ============================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    plain_password TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    vehicle_id TEXT DEFAULT ''
);

-- ============================
-- USER SETTINGS
-- ============================
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    temperature_unit TEXT NOT NULL,
    distance_unit TEXT NOT NULL,
    time_format TEXT NOT NULL,
    language TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ============================
-- HISTORIES
-- ============================
CREATE TABLE IF NOT EXISTS histories (
    id SERIAL PRIMARY KEY,
    route_id TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    weather TEXT NOT NULL,
    distance TEXT NOT NULL,
    status TEXT NOT NULL,
    driver_email TEXT NOT NULL,
    origin_lat REAL,
    origin_lon REAL,
    destination_lat REAL,
    destination_lon REAL,
    current_lat REAL,
    current_lon REAL,
    eta TEXT,
    speed REAL,
    temperature REAL,
    humidity INTEGER,
    wind_speed REAL,
    rain_probability REAL,
    safety_score TEXT NOT NULL,
    weather_condition TEXT NOT NULL,
    duration REAL,
    notes TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- ============================
-- NOTIFICATIONS
-- ============================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    type TEXT DEFAULT '',
    severity TEXT DEFAULT '',
    user_email TEXT DEFAULT ''
);

-- ============================
-- SOS ALERTS
-- ============================
CREATE TABLE IF NOT EXISTS sos_alerts (
    id SERIAL PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    driver_email TEXT NOT NULL,
    type TEXT NOT NULL,
    location TEXT NOT NULL,
    time TEXT NOT NULL,
    is_active INTEGER NOT NULL,
    driver_name TEXT DEFAULT '',
    created_at TEXT DEFAULT '',
    resolved_at TEXT
);

-- ============================
-- SOS RECORDS
-- ============================
CREATE TABLE IF NOT EXISTS sos_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS ix_sosrecords_userid_status
ON sos_records (user_id, status);

-- ============================
-- WEATHERS
-- ============================
CREATE TABLE IF NOT EXISTS weathers (
    id SERIAL PRIMARY KEY,
    temperature REAL NOT NULL,
    condition TEXT NOT NULL,
    humidity INTEGER NOT NULL,
    wind_speed REAL NOT NULL,
    rain_probability REAL NOT NULL,
    safety_score TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    user_email TEXT DEFAULT ''
);

-- ============================
-- SEED USERS
-- Passwords:
-- Admin@123
-- Driver@123
-- ============================

INSERT INTO users (email, password, plain_password, name, phone, role, status)
VALUES
(
    'Admin@dev.com',
    '$2b$10$Qe3Z9zv0M9WQp4G8g1JwOeH8y6Z1JrZzZ8l5dZcZKkZr7F6pQJz4W',
    'Admin@123',
    'Admin User',
    '9999999999',
    'ADMIN',
    'ACTIVE'
),
(
    'Driver@dev.com',
    '$2b$10$XJ1Cq1ZyJ6vKp8WmRk7ZWeA9FQYFQqPZy8xY3mGk6y9Y0pQmQZ3eK',
    'Driver@123',
    'Driver User',
    '8888888888',
    'DRIVER',
    'ACTIVE'
)
ON CONFLICT (email) DO NOTHING;
