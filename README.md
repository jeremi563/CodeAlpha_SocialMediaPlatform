# Social Media Platform

A social media MVP built with a vanilla HTML/CSS/JavaScript frontend, a Node.js and Express REST API, and MongoDB. Express serves the frontend and API from the same service.

## Features

- Registration, login, logout, and MongoDB-backed sessions.
- Public profiles, profile editing, profile picture upload/removal, username search, and discovery.
- Chronological paginated post feed with owner-only editing and deletion.
- Comments, likes, follows, and follower/following lists.
- A paginated notifications inbox for likes, comments, and new followers, with unread counts and read controls.
- Responsive frontend with SVG icons and accessible interaction states.

## Technology

- Frontend: HTML5, CSS3, vanilla JavaScript.
- Backend: Node.js, Express, Mongoose, and `express-validator`.
- Database, sessions, and persistent profile pictures: MongoDB, Mongoose, `connect-mongo`, and GridFS.
- Tests: Node's built-in test runner (`node:test`).

## Repository Layout

```text
.
├── backend/
│   ├── scripts/          # Manual model and validation checks
│   ├── src/              # Express app, API modules, and configuration
│   ├── tests/            # API regression tests
│   ├── request.rest      # REST Client examples (may be git-ignored locally)
│   └── package.json
├── frontend/
│   ├── assets/
│   ├── css/
│   ├── js/
│   └── *.html
├── project documentation.txt  # Full system specification; retained
├── RENDER_DEPLOYMENT.md       # Render and MongoDB Atlas deployment guide
└── README.md
```

## Run Locally

Prerequisites: Node.js 22 and npm, plus a reachable MongoDB deployment.

1. Install backend dependencies:

  ```sh
  cd backend
  npm ci
  ```

2. Create `backend/.env` using `backend/.env.example`. Set `MONGODB_URI` to a valid MongoDB connection string and replace `SESSION_SECRET` with a long random value. Keep `.env` private and untracked.

3. Start the integrated app from the `backend/` directory:

  ```sh
  npm start
  ```

  For development with automatic restarts, use `npm run dev`.

4. Open `http://localhost:5000`. The configured `PORT` is used when present. The API health endpoint is `http://localhost:5000/api/health`.

## Tests

Run the focused API regression suite from `backend/`:

```sh
npm test
```

The suite uses the configured MongoDB connection, creates a temporary user, and removes it after the run. Do not point it at a production database.

## Deployment

See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for Render Web Service settings, Atlas configuration, environment variables, verification steps, and troubleshooting.

## Project Specification

The original system design, requirements, data model, API specification, and roadmap are preserved in [project documentation.txt](project%20documentation.txt). This README summarizes the implementation and does not replace that document.