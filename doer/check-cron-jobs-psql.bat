@echo off
REM Windows batch script to check cron jobs using psql
REM You need to set DATABASE_URL environment variable first

echo === Checking for pg_cron Jobs ===
echo.

if "%DATABASE_URL%"=="" (
    echo ERROR: DATABASE_URL environment variable is not set
    echo.
    echo To get your database connection string:
    echo 1. Go to Supabase Dashboard ^> Project Settings ^> Database
    echo 2. Copy the "Connection string" (URI format)
    echo 3. Set it as: set DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xbzcyyukykxnrfgnhike.supabase.co:5432/postgres
    echo.
    echo Or run the SQL directly in Supabase SQL Editor:
    echo File: check-cron-jobs.sql
    exit /b 1
)

echo Running SQL queries...
echo.

psql "%DATABASE_URL%" -f check-cron-jobs.sql

if errorlevel 1 (
    echo.
    echo ERROR: Failed to execute query
    echo Make sure:
    echo - DATABASE_URL is correct
    echo - psql is in your PATH
    echo - You have network access to the database
    exit /b 1
)

echo.
echo === Check Complete ===


