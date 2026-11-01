@echo off
rem Starts the picture studio: makes the pictures that people ask for on the website, using the image tool on this computer.
rem Start your image tool first (for example KoboldCpp with an image model). Close this window, or press Ctrl+C, to stop.
rem The first time, add APP_URL and WORKER_TOKEN (made on the website at /admin/workers), UPSTASH_REDIS_URL, and IMAGE_GEN_URL and/or
rem COMPANION_URL, to .env.local; see docs/picture-queue.md. The studio never reads DATABASE_URL.
cd /d "%~dp0"
npx tsx scripts/image-worker.ts 
pause
