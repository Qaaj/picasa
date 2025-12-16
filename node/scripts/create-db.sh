#!/usr/bin/env bash

set -e

read -p "Enter new database name: " DB_NAME

PG_SUPERUSER="postgres"
APP_USER="picasa"
APP_PASSWORD="yourpassword"

echo "▶ Ensuring role '${APP_USER}' exists..."

psql -U "$PG_SUPERUSER" -d postgres <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = '${APP_USER}'
  ) THEN
    CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASSWORD}';
  END IF;
END
\$\$;
EOF

echo "▶ Creating database '${DB_NAME}' (if not exists)..."

psql -U "$PG_SUPERUSER" -d postgres <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_database WHERE datname = '${DB_NAME}'
  ) THEN
    CREATE DATABASE ${DB_NAME} OWNER ${APP_USER};
  END IF;
END
\$\$;
EOF

echo "▶ Installing extensions in '${DB_NAME}'..."

psql -U "$PG_SUPERUSER" -d "$DB_NAME" <<EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
EOF

echo "▶ Granting privileges..."

psql -U "$PG_SUPERUSER" -d postgres <<EOF
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${APP_USER};
EOF

echo "✅ Database '${DB_NAME}' fully bootstrapped"