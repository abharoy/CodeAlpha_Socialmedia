# Famet

Famet is a React frontend and Express API backed by PostgreSQL. Docker Compose starts all three services and applies the checked-in Prisma migrations automatically.

## Run the full app with Docker

Install Docker Desktop (or Docker Engine with the Compose plugin), clone this repository, and run these commands from the repository root:

```sh
docker compose up --build
```

Open the frontend at <http://localhost:5173>. The API is at <http://localhost:4000>; its health check is <http://localhost:4000/api/health>.

Compose creates the database tables on first startup and keeps database data and uploaded media in named Docker volumes. Stop the app with `Ctrl+C`; use `docker compose down` to stop and remove its containers. To also erase saved data and uploads, run `docker compose down -v`.

The default database password and JWT secret are for local development only. To set your own values, create a `.env` file in the repository root (do not commit it):

```dotenv
POSTGRES_PASSWORD=choose-a-local-database-password
JWT_SECRET=choose-a-long-random-secret
```

If you change `POSTGRES_PASSWORD` after the database volume has already been created, the existing database keeps its original password. Recreate it with `docker compose down -v` only if you are okay deleting its data.

## Run services without Docker

See [the backend setup guide](famet-backend/README.md) for API and database setup. Start the frontend from `my-react-app` with `npm install` and `npm run dev`.
