#!/bin/bash
# Database migration workflow
# Run this in an interactive terminal (not CI)

set -e

case "$1" in
  new)
    # Create a new migration: ./scripts/db-migrate.sh new <name>
    NAME="${2:-changes}"
    npx prisma migrate dev --name "$NAME"
    ;;
  deploy)
    # Apply pending migrations in production/CI
    npx prisma migrate deploy
    ;;
  status)
    npx prisma migrate status
    ;;
  reset)
    # Dangerous: resets DB and re-runs all migrations
    echo "WARNING: This will reset the database. Continue? (y/N)"
    read -r confirm
    if [ "$confirm" = "y" ]; then
      npx prisma migrate reset
    fi
    ;;
  *)
    echo "Usage: $0 {new <name>|deploy|status|reset}"
    exit 1
    ;;
esac
