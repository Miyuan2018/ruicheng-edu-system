#!/bin/bash
# Start Celery worker for edu_system async tasks.
# Usage: ./celery_worker.sh [concurrency]
#   concurrency: number of worker processes (default: from sysconfig or 2)

cd "$(dirname "$0")"

CONCURRENCY=${1:-${CELERY_CONCURRENCY:-2}}

echo "Starting Celery worker (concurrency=$CONCURRENCY)..."
exec celery -A app.celery_app worker \
    --loglevel=info \
    --concurrency="$CONCURRENCY" \
    -Q celery
