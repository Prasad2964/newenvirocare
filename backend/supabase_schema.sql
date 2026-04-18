-- EnviroCare Supabase Schema
-- Run this in the Supabase SQL editor to create all required tables

-- Users table (custom auth, not Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    user_id     TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Health profiles (one per user)
CREATE TABLE IF NOT EXISTS health_profiles (
    user_id     TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    conditions  TEXT[] DEFAULT '{}',
    medications TEXT[] DEFAULT '{}',
    age         INTEGER,
    blood_group TEXT,
    allergies   TEXT[] DEFAULT '{}',
    notes       TEXT,
    photo_url   TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- If updating an existing database, run:
-- ALTER TABLE health_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Routines (many per user)
CREATE TABLE IF NOT EXISTS routines (
    routine_id  TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    activity    TEXT NOT NULL,
    time        TEXT NOT NULL,
    type        TEXT DEFAULT 'outdoor',
    days        TEXT[] DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);

-- Symptom logs (many per user)
CREATE TABLE IF NOT EXISTS symptoms (
    symptom_id  TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    symptoms    TEXT[] DEFAULT '{}',
    severity    INTEGER DEFAULT 5,
    notes       TEXT,
    logged_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_symptoms_user_id ON symptoms(user_id);

-- Activity history (many per user)
CREATE TABLE IF NOT EXISTS activities (
    activity_id TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type        TEXT DEFAULT 'aqi_check',
    city        TEXT DEFAULT '',
    aqi         INTEGER DEFAULT 0,
    risk_level  TEXT DEFAULT 'low',
    description TEXT DEFAULT '',
    timestamp   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);

-- User settings (one per user)
CREATE TABLE IF NOT EXISTS settings (
    user_id                  TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    safe_aqi_threshold       INTEGER DEFAULT 50,
    risky_aqi_threshold      INTEGER DEFAULT 150,
    dangerous_aqi_threshold  INTEGER DEFAULT 300,
    notify_daily_updates     BOOLEAN DEFAULT TRUE,
    notify_high_risk         BOOLEAN DEFAULT TRUE,
    notify_travel            BOOLEAN DEFAULT TRUE,
    notify_routine           BOOLEAN DEFAULT TRUE,
    default_city             TEXT DEFAULT 'Mumbai',
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications (many per user)
CREATE TABLE IF NOT EXISTS notifications (
    notification_id TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type            TEXT DEFAULT 'alert',
    title           TEXT DEFAULT '',
    message         TEXT DEFAULT '',
    read            BOOLEAN DEFAULT FALSE,
    timestamp       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Exposure logs (many per user)
CREATE TABLE IF NOT EXISTS exposures (
    exposure_id      TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    city             TEXT DEFAULT '',
    aqi              INTEGER DEFAULT 0,
    duration_minutes INTEGER DEFAULT 0,
    level            TEXT DEFAULT 'good',
    timestamp        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exposures_user_id ON exposures(user_id);

-- Chat usage (rate limiting)
CREATE TABLE IF NOT EXISTS chat_usage (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message_count INTEGER DEFAULT 0,
    date        DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_chat_usage_user_date ON chat_usage(user_id, date);

-- Disable RLS for all tables (API uses custom JWT, not Supabase Auth)
ALTER TABLE users             DISABLE ROW LEVEL SECURITY;
ALTER TABLE health_profiles   DISABLE ROW LEVEL SECURITY;
ALTER TABLE routines          DISABLE ROW LEVEL SECURITY;
ALTER TABLE symptoms          DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities        DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings          DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     DISABLE ROW LEVEL SECURITY;
ALTER TABLE exposures         DISABLE ROW LEVEL SECURITY;
