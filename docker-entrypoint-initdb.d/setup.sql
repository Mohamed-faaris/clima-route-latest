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
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "ResolvedAt" TIMESTAMP
);

-- ============================
-- SOS RECORDS
-- ============================
CREATE TABLE IF NOT EXISTS "SosRecords" (
    "Id" SERIAL PRIMARY KEY,
    "UserId" INTEGER NOT NULL,
    "Reason" TEXT NOT NULL,
    "Status" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ResolvedAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_sosrecords_userid_status ON "SosRecords" ("UserId", "Status");

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
    "RecordedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UserEmail" TEXT DEFAULT ''
);

-- ============================
-- SEED USERS
-- Passwords:
-- Updated to user-provided hash
-- ============================

INSERT INTO
    "Users" (
        "Email",
        "Password",
        "PlainPassword",
        "Name",
        "Phone",
        "Role",
        "Status"
    )
VALUES (
        'admin@gmail.com',
        '96CAE35CE8A9B0244178BF28E4966C2CE1B8385723A96A6B838858CDD6CA0A1E',
        'Admin@123',
        'Admin User',
        '9999999999',
        'ADMIN',
        'ACTIVE'
    ),
    (
        'driver@gmail.com',
        '96CAE35CE8A9B0244178BF28E4966C2CE1B8385723A96A6B838858CDD6CA0A1E',
        'Driver@123',
        'Driver User',
        '8888888888',
        'DRIVER',
        'ACTIVE'
    )
ON CONFLICT ("Email") DO NOTHING;