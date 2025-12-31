-- ============================
-- USERS (Quoted for case-sensitive matching)
-- ============================
CREATE TABLE IF NOT EXISTS "Users" (
    "Id" SERIAL PRIMARY KEY,
    "Email" TEXT NOT NULL UNIQUE,
    "Password" TEXT NOT NULL,
    "PlainPassword" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    "Phone" TEXT NOT NULL,
    "Role" TEXT NOT NULL,
    "Status" TEXT NOT NULL,
    "VehicleId" TEXT DEFAULT ''
);

-- ============================
-- USER SETTINGS
-- ============================
CREATE TABLE IF NOT EXISTS "UserSettings" (
    "Id" SERIAL PRIMARY KEY,
    "UserId" INTEGER NOT NULL,
    "TemperatureUnit" TEXT NOT NULL,
    "DistanceUnit" TEXT NOT NULL,
    "TimeFormat" TEXT NOT NULL,
    "Language" TEXT NOT NULL,
    "UpdatedAt" TEXT NOT NULL
);

-- ============================
-- HISTORIES
-- ============================
CREATE TABLE IF NOT EXISTS "Histories" (
    "Id" SERIAL PRIMARY KEY,
    "RouteId" TEXT NOT NULL,
    "Date" TEXT NOT NULL,
    "StartTime" TEXT NOT NULL,
    "EndTime" TEXT NOT NULL,
    "Origin" TEXT NOT NULL,
    "Destination" TEXT NOT NULL,
    "Weather" TEXT NOT NULL,
    "Distance" TEXT NOT NULL,
    "Status" TEXT NOT NULL,
    "DriverEmail" TEXT NOT NULL,
    "OriginLat" REAL,
    "OriginLon" REAL,
    "DestinationLat" REAL,
    "DestinationLon" REAL,
    "CurrentLat" REAL,
    "CurrentLon" REAL,
    "Eta" TEXT,
    "Speed" REAL,
    "Temperature" REAL,
    "Humidity" INTEGER,
    "WindSpeed" REAL,
    "RainProbability" REAL,
    "SafetyScore" TEXT NOT NULL,
    "WeatherCondition" TEXT NOT NULL,
    "Duration" REAL,
    "Notes" TEXT NOT NULL,
    "CreatedAt" TEXT NOT NULL
);

-- ============================
-- NOTIFICATIONS
-- ============================
CREATE TABLE IF NOT EXISTS "Notifications" (
    "Id" SERIAL PRIMARY KEY,
    "Category" TEXT NOT NULL,
    "Title" TEXT NOT NULL,
    "Description" TEXT NOT NULL,
    "Timestamp" TEXT NOT NULL,
    "Type" TEXT DEFAULT '',
    "Severity" TEXT DEFAULT '',
    "UserEmail" TEXT DEFAULT ''
);

-- ============================
-- SOS ALERTS
-- ============================
CREATE TABLE IF NOT EXISTS "SosAlerts" (
    "Id" SERIAL PRIMARY KEY,
    "VehicleId" TEXT NOT NULL,
    "DriverEmail" TEXT NOT NULL,
    "Type" TEXT NOT NULL,
    "Location" TEXT NOT NULL,
    "Time" TEXT NOT NULL,
    "IsActive" BOOLEAN NOT NULL,
    "DriverName" TEXT DEFAULT '',
    "CreatedAt" TEXT DEFAULT '',
    "ResolvedAt" TEXT
);

-- ============================
-- SOS RECORDS
-- ============================
CREATE TABLE IF NOT EXISTS "SosRecords" (
    "Id" SERIAL PRIMARY KEY,
    "UserId" INTEGER NOT NULL,
    "Reason" TEXT NOT NULL,
    "Status" TEXT NOT NULL,
    "CreatedAt" TEXT NOT NULL,
    "ResolvedAt" TEXT
);

CREATE INDEX IF NOT EXISTS ix_sosrecords_userid_status
ON "SosRecords" ("UserId", "Status");

-- ============================
-- WEATHERS
-- ============================
CREATE TABLE IF NOT EXISTS "Weathers" (
    "Id" SERIAL PRIMARY KEY,
    "Temperature" REAL NOT NULL,
    "Condition" TEXT NOT NULL,
    "Humidity" INTEGER NOT NULL,
    "WindSpeed" REAL NOT NULL,
    "RainProbability" REAL NOT NULL,
    "SafetyScore" TEXT NOT NULL,
    "RecordedAt" TEXT NOT NULL,
    "UserEmail" TEXT DEFAULT ''
);

-- ============================
-- SEED USERS
-- Passwords:
-- Admin@123
-- Driver@123
-- ============================

INSERT INTO "Users" ("Email", "Password", "PlainPassword", "Name", "Phone", "Role", "Status")
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
ON CONFLICT ("Email") DO NOTHING;
