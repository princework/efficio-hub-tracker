# Efficio Hub · Zoho Implementation Tracker

Milestone tracker for the Efficio Hub Zoho implementation: 9 milestones, 172 tasks,
client feedback, CSV export. Data lives in MongoDB Atlas; the same page also runs
offline from disk using the browser's own storage.

## Two links, two levels of access

| Link | What it can do |
|------|----------------|
| `https://<host>/` | View everything, leave feedback |
| `https://<host>/?key=<ADMIN_KEY>` | Everything above, plus edit tasks, milestones and project details |

The key is stored in that browser and stripped from the address bar, so the developer
link only has to be opened once. A "Developer mode" badge appears in the header with an
**exit** button that returns the browser to the client view.

## Running it

```bash
npm install
cp .env.example .env     # then fill in MONGODB_URI and ADMIN_KEY
npm run seed             # creates the database and loads the 9 milestones / 172 tasks
npm start                # http://localhost:3100
```

`npm run check` prints what is actually stored in Atlas (task counts per milestone).

### Environment

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Atlas connection string (the same cluster as the Mazad tracker) |
| `MONGODB_DB` | Database inside that cluster — `efficio_hub`, kept separate from Mazad's |
| `ADMIN_KEY` | Unlocks editing via `?key=…` |
| `PORT` | Local port, default 3100 |

`.env` is git-ignored. On Vercel, set the same variables in the project settings.

## API

| Method | Route | Access |
|--------|-------|--------|
| GET | `/api/state` | everyone — the whole tracker in one response |
| GET | `/api/auth` | everyone — says whether this browser holds the key |
| POST | `/api/feedback` | everyone — the client link posts feedback |
| DELETE | `/api/feedback/:id` | developer |
| POST / PATCH / DELETE | `/api/tasks`, `/api/tasks/:id` | developer |
| POST / PATCH / DELETE | `/api/milestones`, `/api/milestones/:id` | developer |
| PATCH | `/api/project` | developer |

Writes are optimistic: the change appears immediately, then goes to the server. If the
server rejects it the page says so and reloads the stored state.

## Layout

```
app.js            express app (static files + /api)
server.js         local entry point
api/index.js      Vercel serverless entry point
lib/db.js         Atlas connection, one-time seeding
lib/seedData.js   turns public/seed-data.js into documents
models/           Project, Milestone, Task, Feedback
routes/           state, tasks, milestones, feedback, project
middleware/auth.js  developer-key check
public/           the tracker page (index.html, style.css, script.js, seed-data.js)
scripts/seed.js   npm run seed
scripts/check.js  npm run check
```

### Offline use

Opening `public/index.html` directly still works: the page detects that `/api` is not
reachable, seeds itself from `seed-data.js` and saves to localStorage. Nothing in that
mode reaches MongoDB.
