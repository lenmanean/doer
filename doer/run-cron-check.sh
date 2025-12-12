#!/bin/bash
# Script to check cron jobs using Supabase CLI and psql

cd "$(dirname "$0")"

echo "=== Checking for pg_cron Jobs ==="
echo ""

# Try to get connection string from Supabase
# Note: You may need to provide the database password manually
PROJECT_REF="xbzcyyukykxnrfgnhike"

# Check if we have database URL in environment
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not found in environment"
  echo ""
  echo "To run this check, you need to:"
  echo "1. Get your database connection string from Supabase Dashboard"
  echo "2. Set it as: export DATABASE_URL='postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres'"
  echo ""
  echo "Or run the SQL directly in Supabase SQL Editor:"
  echo "File: check-cron-jobs.sql"
  exit 1
fi

echo "Running SQL queries..."
echo ""

# Run the SQL file
psql "$DATABASE_URL" -f check-cron-jobs.sql

