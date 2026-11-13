-- =============================================================================
-- ClipForge Enterprise PostgreSQL Schema
-- =============================================================================

CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(32) NOT NULL UNIQUE,
    quota_hours NUMERIC(10, 2) NOT NULL DEFAULT 100.0,
    used_hours NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
    priority_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS videos (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    size BIGINT NOT NULL,
    hash VARCHAR(128) NOT NULL,
    department_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
    priority VARCHAR(32) NOT NULL DEFAULT 'standard',
    status VARCHAR(32) NOT NULL DEFAULT 'validation',
    upload_progress NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    is_upload_complete BOOLEAN NOT NULL DEFAULT FALSE,
    total_chunks INT NOT NULL DEFAULT 1,
    uploaded_chunks INT NOT NULL DEFAULT 0,
    duration INT DEFAULT 0,
    resolution_360p VARCHAR(512),
    resolution_720p VARCHAR(512),
    resolution_1080p VARCHAR(512),
    thumbnail_url VARCHAR(512),
    preview_strip_url VARCHAR(512),
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_videos_hash ON videos(hash);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_department ON videos(department_id);

CREATE TABLE IF NOT EXISTS video_chunks (
    video_id VARCHAR(64) REFERENCES videos(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_size INT NOT NULL,
    chunk_hash VARCHAR(128),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (video_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(64) PRIMARY KEY,
    video_id VARCHAR(64) REFERENCES videos(id) ON DELETE CASCADE,
    stage VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    worker_id VARCHAR(64),
    progress INT NOT NULL DEFAULT 0,
    department_id VARCHAR(64),
    priority VARCHAR(32) NOT NULL DEFAULT 'standard',
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_stage ON jobs(stage);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

CREATE TABLE IF NOT EXISTS worker_heartbeats (
    worker_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    stage VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'idle',
    cpu_usage INT NOT NULL DEFAULT 0,
    memory_mb INT NOT NULL DEFAULT 0,
    current_job_id VARCHAR(64),
    jobs_completed INT NOT NULL DEFAULT 0,
    jobs_failed INT NOT NULL DEFAULT 0,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dead_letter_records (
    id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL,
    video_id VARCHAR(64) NOT NULL,
    stage VARCHAR(32) NOT NULL,
    error TEXT NOT NULL,
    attempts INT NOT NULL DEFAULT 3,
    payload JSONB,
    failed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    replayed BOOLEAN NOT NULL DEFAULT FALSE
);

-- Seed initial departments if table is empty
INSERT INTO departments (id, name, code, quota_hours, used_hours, priority_multiplier)
VALUES
    ('dept-cs', 'Computer Science', 'CS', 250.0, 194.5, 1.5),
    ('dept-ee', 'Electrical Engineering', 'EE', 200.0, 122.0, 1.2),
    ('dept-me', 'Mechanical Engineering', 'ME', 150.0, 98.2, 1.0),
    ('dept-math', 'Mathematics & Statistics', 'MATH', 120.0, 64.0, 1.0),
    ('dept-phys', 'Physics & Biophysics', 'PHYS', 100.0, 32.5, 1.0)
ON CONFLICT (id) DO NOTHING;
