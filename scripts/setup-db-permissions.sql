-- Grant permissions for crontopusadmin user
-- Run this with a superuser account

-- Connect to the database
\c crontopus-db

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON DATABASE "crontopus-db" TO crontopusadmin;

-- Grant schema permissions
GRANT ALL PRIVILEGES ON SCHEMA public TO crontopusadmin;

-- Grant table permissions (for existing tables)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crontopusadmin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crontopusadmin;

-- Grant default privileges (for future tables created by any user)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO crontopusadmin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO crontopusadmin;

-- Grant on Alembic version table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alembic_version') THEN
        GRANT ALL PRIVILEGES ON TABLE alembic_version TO crontopusadmin;
    END IF;
END $$;

-- Verify permissions
\du crontopusadmin
\dp
