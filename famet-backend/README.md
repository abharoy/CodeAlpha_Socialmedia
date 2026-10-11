# Famet backend

Separate Express API for the Famet React frontend. It uses PostgreSQL through Prisma ORM.

## Setup

1. Create a PostgreSQL database called `famet`.
2. Copy `.env.example` to `.env`, then set the PostgreSQL credentials and a strong `JWT_SECRET`.
3. Install packages: `npm install`
4. Create the database tables: `npm run prisma:migrate -- --name init`
5. Start the API: `npm run dev`

The API runs at `http://localhost:4000` by default.

## Routes

- `POST /api/auth/signup` - `{ email, password, username, displayName }`
- `POST /api/auth/login` - `{ identifier, password }`
- `GET /api/profile/me` - Bearer token required
- `PATCH /api/profile/me` - Bearer token required; accepts `displayName`, `bio`, and `username`

The user-ID change rule is enforced on the server: each user can change it at most twice in a calendar month.
