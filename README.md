# PulseNet — Full-Stack Social Networking Platform

PulseNet is a scaled-down social network built for the DBMS Course Project. Users register and keep a profile, send and answer friend requests, publish text and media posts with privacy levels, like, comment and bookmark posts, form public or private groups, exchange direct messages and receive notifications.

The focus of the project is the relational database: 12 relations whose integrity rules (keys, uniqueness, CHECK constraints, cross-table invariants and notification side effects) are enforced by PostgreSQL itself, with an Express API and a React client on top.

---

## Team Members & Contributions

| Name                  | Student ID    | Contributions                                                                                                                                     |
| --------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kshitij Mathur        | 2024A8PS0462H | **Backend & Auth:** Express server, routing, `pg` pool, JWT authentication, `/api/auth` and `/api/posts`, post publication with media (W3).        |
| Fidel Saji            | 2024AAPS1158H | **Social Graph & Messaging:** Friend-request workflow (`friendships`), notification logic, direct-messaging endpoints, friend suggestions query.   |
| Ritika Mirium Thomas  | 2024A8PS0447H | **Engagement & Feed:** Likes, comments, bookmarks (`saved_posts`), feed page and feed UI components.                                              |
| Yadavalli Sai Charan  | 2024A8PS0460H | **Communities:** Group creation, role-based access (`groups`, `group_members`), join flow, group feeds and group notifications (W4).               |
| Shresth Prakash Singh | 2024A8PS0324H | **Database & Analytics:** Schema design, SQL scripts, triggers, views, indexes, seed data (500+ records) and query validation.                     |

---

## Technology Stack

| Layer        | Technology                                              |
| ------------ | ------------------------------------------------------- |
| Frontend     | React 18 (Vite), React Router, Context API, Axios       |
| Backend      | Node.js 18+, Express 5, bcrypt, JSON Web Tokens, multer |
| Database     | PostgreSQL 15+ (local or Supabase), `pg` connection pool |
| File storage | Supabase Storage (post media and avatars) — optional    |
| Tooling      | Git/GitHub, Postman, psql                               |

Architecture: **React SPA ↔ Express REST API ↔ PostgreSQL**. The browser never holds database credentials; only the Express server connects to the database, using parameterised SQL.

---

## Repository Structure

```
PulseNet/
├── client/                     React (Vite) frontend
│   └── src/  pages/ components/ context/ api/
├── server/                     Express backend
│   ├── db/
│   │   ├── schema.sql          Full DDL: 12 tables, constraints, indexes, triggers, views
│   │   ├── seed.sql            Small hand-written sample data (5 users)
│   │   ├── seed-demo.js        Deterministic generator for ~2,250 demo rows
│   │   └── queries.sql         The 5 non-trivial SQL queries
│   ├── src/
│   │   ├── routes/ controllers/ middleware/ db/ utils/ config/
│   │   ├── app.js
│   │   └── index.js
│   ├── test-workflows.js       End-to-end tests for workflows W1–W4
│   └── test-engagement.js      Like / comment / bookmark API test
└── supabase/migrations/        Same schema split into migrations, plus RLS and storage buckets
```

`server/db/schema.sql` is the reference schema for a local database. `supabase/migrations/` contains the same tables, triggers and views split into migrations for a Supabase project, plus Row Level Security and the storage buckets.

---

## Database Design

### Relations (12)

| Domain        | Relation          | Purpose                                                                                     |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| Accounts      | `users`           | Credentials (bcrypt hash) and `account_status` (active / suspended / disabled)              |
|               | `user_profiles`   | 1:1 public profile: name, bio, location, website, avatar                                    |
| Social graph  | `friendships`     | Recursive M:N on users: `status` pending / accepted / declined, `responded_at`              |
| Content       | `posts`           | Text post with `privacy_level` (public / friends_only / private), optional group, soft delete |
|               | `post_media`      | Image/video attachments stored as bucket + path + metadata                                  |
|               | `comments`        | Comments on posts                                                                           |
| Engagement    | `post_likes`      | M:N users ↔ posts, one like per user per post                                               |
|               | `saved_posts`     | M:N users ↔ posts, one bookmark per user per post                                           |
| Communities   | `groups`          | Public or private groups with a creator                                                     |
|               | `group_members`   | M:N users ↔ groups with `role` (admin / moderator / member) and `status` (active / pending)  |
| Communication | `notifications`   | Alerts generated by triggers                                                                |
|               | `direct_messages` | One-to-one messages with read receipts (`read_at`)                                          |

The ER diagram, relational mapping and normalization justification are in the Database Design Document (PDF).

### Integrity Constraints

| Mechanism   | Examples                                                                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary key | Surrogate keys on entity tables; composite keys on `friendships`, `post_likes`, `saved_posts`, `group_members` (rules out duplicate likes, bookmarks and memberships)                                   |
| Foreign key | Every reference declared with an explicit `ON DELETE`: `CASCADE` for owned rows, `RESTRICT` on `groups.creator_id` (a group owner cannot be deleted), `SET NULL` on `notifications.actor_id`           |
| Unique      | Case-insensitive username and email (`LOWER(...)` unique indexes); one profile per user; unique `(storage_bucket, storage_path)`; one friendship row per unordered pair (`uq_friendship_pair` on `LEAST/GREATEST`) |
| Check       | Enumerated domains (status, privacy, visibility, role, media type, notification type); no self-friendship, self-message or self-notification; `responded_at` set exactly when status is not pending; `read_at ≥ sent_at`; file size > 0; MIME prefix matches media type; non-blank comments and messages |
| Deferred constraint trigger | `trg_post_has_content`: a non-deleted post must have non-blank text or at least one media row, checked at `COMMIT` so a post and its media can be inserted in one transaction |

### Triggers

| Trigger                      | Fires on                                        | Effect                                                                                                                                            |
| ---------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trg_*_touch`                | `UPDATE` on users, user_profiles, groups, posts, comments | Sets `updated_at = NOW()`                                                                                                                 |
| `trg_groups_creator_admin`   | `groups` insert                                 | Enrols the creator in `group_members` as an active admin                                                                                          |
| `trg_post_has_content`       | `posts` insert / update (deferred)              | Enforces the text-or-media rule                                                                                                                   |
| `trg_friendships_notify`     | `friendships` insert / status update / delete   | Request sent → notify addressee. Answered → mark that notification read; if accepted, notify requester. Pending request cancelled → remove unread notification. |
| `trg_post_likes_notify`      | `post_likes` insert / delete                    | Like → notify post author. Unlike → remove unread notification.                                                                                   |
| `trg_comments_notify`        | `comments` insert                               | Notify post author                                                                                                                                |
| `trg_direct_messages_notify` | `direct_messages` insert / `read_at` update     | Notify recipient; repeated unread messages from one sender collapse into a single notification (partial unique index + `ON CONFLICT`). Conversation read → mark it read. |
| `trg_group_members_notify`   | `group_members` insert                          | A pending join request to a private group notifies the group creator                                                                              |

Self-actions (liking or commenting on your own post) never create notifications.

### Views

| View                      | Purpose                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `v_friend_pairs`          | Accepted friendships listed in both directions, so "friends of X" is `WHERE user_id = X`      |
| `v_friend_suggestions`    | Friends of friends with no existing friendship row, with a `mutual_friends` count             |
| `v_user_stats`            | Per-user friend, post, likes-received and group counts (used on profile pages)                |
| `post_engagement_summary` | Per-post like, comment, bookmark and media counts, derived rather than stored                 |

All views are declared `WITH (security_invoker = true)`, which is why PostgreSQL 15 or newer is required.

### Indexes

Indexes support the main access paths: posts by author and group, likes / comments / bookmarks / media by post, memberships by user and by `(group_id, role, status)`, incoming friend requests, notifications by recipient and time, and conversations by `(sender_id, recipient_id, message_id DESC)`. Partial indexes cover unread notifications and unread messages (`WHERE is_read = FALSE`, `WHERE read_at IS NULL`).

### Transactions

| Operation                    | Atomic unit                                                         |
| ---------------------------- | ------------------------------------------------------------------- |
| Registration                 | `INSERT users` + `INSERT user_profiles`                             |
| Post publication             | `INSERT posts` + `INSERT post_media` rows, checked by the deferred trigger at `COMMIT` |
| Group creation               | `INSERT groups` + creator's admin membership (via trigger)          |
| Demo seeding                 | The whole seed run is one transaction                               |

### Non-Trivial SQL Queries (`server/db/queries.sql`)

| #  | Query                                      | Concepts                                                                                 |
| -- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Q1 | Privacy-aware feed with engagement counts  | CTE over `v_friend_pairs`, multi-table outer joins, `GROUP BY`, `EXISTS` subqueries       |
| Q2 | Friend suggestions with mutual friends     | Self-join on `v_friend_pairs`, `NOT EXISTS` anti-join, `ARRAY_AGG(DISTINCT …)`            |
| Q3 | Group activity analytics and ranking       | Outer joins, conditional aggregation with `FILTER`, `NULLIF`, `DENSE_RANK()` window       |
| Q4 | Per-user activity scorecard                | Multiple CTEs with pre-aggregation to avoid join fan-out, outer joins                     |
| Q5 | Messaging inbox: latest message + unread   | CTE, `ROW_NUMBER() OVER (PARTITION BY …)`, grouped unread counts                          |

The queries use `user_id = 1` as the sample viewer. Run them with:

```bash
psql -U postgres -d pulsenet_db -f server/db/queries.sql
```

---

## Application Workflows

| Workflow | Flow | Tables | DBMS concepts |
| -------- | ---- | ------ | ------------- |
| **W1 Registration & profile** | Form → validation → bcrypt → `BEGIN; INSERT users; INSERT user_profiles; COMMIT` → JWT | users, user_profiles | Transaction, case-insensitive unique index, FK |
| **W2 Friendships & feed** | Send request → accept / decline → privacy-aware feed with like, comment, bookmark | friendships, notifications, posts, post_likes, comments, saved_posts | Unordered-pair unique index, CHECK on `responded_at`, notification triggers, views, joins and aggregation |
| **W3 Post with media** | Upload file to storage → one transaction inserts `posts` + `post_media` → deferred trigger checks text-or-media at `COMMIT` | posts, post_media | Deferred constraint trigger, atomicity, CHECK on MIME type and size |
| **W4 Groups & messaging** | Create group (trigger adds admin) → join (public: active; private: pending + notification to creator) → admin approves / changes roles → direct message → recipient reads (`read_at` set) | groups, group_members, notifications, direct_messages | AFTER INSERT trigger, M:N with attributes, `RESTRICT` on creator, notification collapsing |

Constraint enforcement can be demonstrated live, for example: a reverse-direction friend request (rejected by `uq_friendship_pair`), a post with blank text and no media (rejected at `COMMIT`), a duplicate username in different letter case, or deleting a user who still owns a group (`RESTRICT`).

---

## Setup & Run

### Prerequisites

- Node.js 18 or newer
- PostgreSQL **15 or newer** (needed for `security_invoker` views)
- Git
- Optional: a Supabase project, only for media and avatar uploads

### 1. Clone

```bash
git clone https://github.com/kmkm-com/PulseNet.git
cd PulseNet
```

### 2. Create the database and schema

```bash
createdb -U postgres pulsenet_db
```

```bash
psql -U postgres -d pulsenet_db -f server/db/schema.sql
```

`schema.sql` drops and recreates every table, so re-running it **wipes all data**.

### 3. Configure the backend

```bash
cd server
npm install
```

Create `server/.env`:

```ini
PORT=5000
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pulsenet_db
DB_SSL=false
JWT_SECRET=replace_with_a_long_random_secret

# Comma-separated user IDs allowed to suspend / disable accounts (default: 1)
PLATFORM_OPERATOR_IDS=1

# Optional: only needed for media and avatar uploads
# SUPABASE_URL=https://<project-ref>.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. See `server/.env.example` for the Supabase variant (`DATABASE_URL` + `DB_SSL=true`).

### 4. Load sample data

Small hand-written data set (5 users):

```bash
psql -U postgres -d pulsenet_db -f server/db/seed.sql
```

Full demo data set (about 2,250 rows across all 12 tables), run from `server/`:

```bash
npm run db:seed:demo
```

| Table           | Rows | Table             | Rows |
| --------------- | ---- | ----------------- | ---- |
| users           | 60   | post_media        | 60   |
| user_profiles   | 60   | post_likes        | 500  |
| friendships     | 360  | saved_posts       | 200  |
| groups          | 15   | comments          | 400  |
| group_members   | 150  | direct_messages   | 250  |
| posts           | 200  | notifications     | generated by triggers |

For safety, the demo seeder only runs against `localhost` and a database named `pulsenet_db`, `pulsenet_dev` or `pulsenet_test*`. It reads `server/.env.test` if present, otherwise `server/.env`.

**Login accounts:** `testuser@example.com`, `bob@example.com`, `charlie@example.com`, `diana@example.com`, `evan@example.com` — password `password123` for all. User 1 (`testuser`) is the default platform operator.

### 5. Start the backend

```bash
npm run dev
```

The API runs on `http://localhost:5000/api`; check `http://localhost:5000/api/health`.

### 6. Start the frontend

In a new terminal, from the project root:

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `http://localhost:5000`; set `VITE_API_TARGET` in `client/.env` if the backend runs elsewhere.

### 7. Media uploads (optional, Supabase)

Media and avatar uploads go to Supabase Storage. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `server/.env` and create the `post-media` and `avatars` buckets (see `supabase/migrations/20261112000004_storage_buckets.sql`). Everything else works without Supabase.

To host the whole database on Supabase instead, apply the files in `supabase/migrations/` in order and set `DATABASE_URL` and `DB_SSL=true` in `server/.env`.

### 8. Run the tests

The tests start the API on a random port and run against the database in `server/.env.test` (copy `server/.env.test.example`). Use a disposable local database with the schema loaded.

```bash
cd server
npm run test:workflows
```

`test-workflows.js` covers W1–W4 end to end (transactions, unique and CHECK constraints, privacy scoping, deferred trigger, auto-admin trigger, notification triggers, read receipts) and cleans up its fixtures afterwards.

---

## API Reference

Base URL: `http://localhost:5000/api`. All routes except `/health`, `/auth/register` and `/auth/login` need `Authorization: Bearer <token>`.

Errors return `{ "error": "..." }` with status 400 (bad input), 401 (missing or invalid token), 403 (not allowed or account not active), 404 (not found) or 409 (duplicate / conflicting state).

### Auth & Health

| Method | Route            | Description                                                                 |
| ------ | ---------------- | --------------------------------------------------------------------------- |
| GET    | `/health`        | API and database status                                                     |
| POST   | `/auth/register` | `{ username, email, password, full_name }`; creates user + profile in one transaction |
| POST   | `/auth/login`    | `{ email, password }`; returns a JWT (suspended / disabled accounts are refused) |
| GET    | `/auth/me`       | Current user with profile                                                   |

### Users

| Method | Route                     | Description                                                                          |
| ------ | ------------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/users?search=&limit=`   | Search by username or full name, with my `relationship` to each result               |
| GET    | `/users/:userId`          | Profile with stats, `relationship` and `mutual_friends`                              |
| PATCH  | `/users/me`               | Update `full_name`, `bio`, `location`, `website_url`                                 |
| POST   | `/users/me/avatar`        | Upload avatar (multipart field `avatar`, max 5 MB; needs Supabase)                   |
| PATCH  | `/users/:userId/status`   | `{ account_status }`: active / suspended / disabled (platform operators only)        |

### Posts, Likes, Comments & Bookmarks

| Method | Route                                 | Description                                                                 |
| ------ | ------------------------------------- | --------------------------------------------------------------------------- |
| POST   | `/posts`                              | `{ content, privacy_level, group_id?, media[] }`; post + media in one transaction |
| POST   | `/posts/media/upload`                 | Upload a file (multipart field `file`, max 50 MB; needs Supabase); returns the `media` object to pass to `POST /posts` |
| GET    | `/posts/feed?limit=&offset=`          | Privacy-aware feed with counts and my like / bookmark state                 |
| GET    | `/posts/:id`                          | Single post with media                                                      |
| PATCH  | `/posts/:id`                          | Edit own post                                                               |
| DELETE | `/posts/:id`                          | Soft-delete (author, or a group admin / moderator for group posts)          |
| POST / DELETE | `/posts/:id/like`              | Like / unlike                                                               |
| GET    | `/posts/:id/comments`                 | Comments on a post                                                          |
| POST   | `/posts/:id/comments`                 | `{ content }`                                                               |
| DELETE | `/posts/:id/comments/:commentId`      | Delete a comment (its author or the post author)                            |
| POST / DELETE | `/posts/:id/bookmark`          | Bookmark / remove bookmark                                                  |
| GET    | `/posts/saved`                        | My bookmarked posts                                                         |

### Friends

| Method | Route                                              | Description                                                        |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------ |
| GET    | `/friends?limit=&offset=`                          | Accepted friends with `friends_since`                              |
| GET    | `/friends/suggestions?limit=`                      | Friends of friends, ranked by mutual friends                       |
| GET    | `/friends/requests?direction=incoming\|outgoing`   | Pending requests to me (default) or from me                        |
| POST   | `/friends/requests/:userId`                        | Send a request (allowed again after a decline)                     |
| PATCH  | `/friends/requests/:userId`                        | `{ action: "accept" \| "decline" }`; only the addressee can respond |
| DELETE | `/friends/:userId`                                 | Unfriend, cancel my pending request, or clear a declined one       |

### Groups

| Method | Route                              | Description                                                                 |
| ------ | ---------------------------------- | --------------------------------------------------------------------------- |
| POST   | `/groups`                          | `{ name, description, visibility }`; creator becomes admin via trigger      |
| GET    | `/groups?search=`                  | List / search groups                                                        |
| GET    | `/groups/:id`                      | Group details                                                               |
| PATCH  | `/groups/:id`                      | Update settings (admins only)                                               |
| DELETE | `/groups/:id`                      | Delete group (creator / admin)                                              |
| POST   | `/groups/:id/join`                 | Join a public group, or request to join a private one (pending)             |
| DELETE | `/groups/:id/leave`                | Leave (the last admin cannot leave)                                         |
| GET    | `/groups/:id/members`              | Members (private groups: members only)                                      |
| PATCH  | `/groups/:id/members/:userId`      | `{ role?, status? }`: approve requests (admin / moderator), change roles (admin) |
| DELETE | `/groups/:id/members/:userId`      | Remove a member (moderators cannot remove admins or moderators)             |
| GET    | `/groups/:id/posts?limit=&offset=` | Group feed (private groups: members only)                                   |
| POST   | `/groups/:id/posts`                | Post in the group (active members only)                                     |

### Direct Messages

Only accepted friends can message each other.

| Method | Route                                 | Description                                                     |
| ------ | ------------------------------------- | --------------------------------------------------------------- |
| GET    | `/messages`                           | Inbox: latest message and unread count per conversation         |
| GET    | `/messages/unread-count`              | Total unread messages                                           |
| GET    | `/messages/:userId?limit=&before=`    | Conversation, newest first; pass `next_before` as `before` to page |
| POST   | `/messages/:userId`                   | `{ content }` (max 2000 characters)                             |
| PATCH  | `/messages/:userId/read`              | Mark that user's messages to me as read                         |

### Notifications

| Method | Route                                        | Description                                  |
| ------ | -------------------------------------------- | -------------------------------------------- |
| GET    | `/notifications?unread=true&limit=&offset=`  | My notifications with actor and post preview |
| GET    | `/notifications/unread-count`                | Unread count for the bell badge              |
| PATCH  | `/notifications/read-all`                    | Mark all as read                             |
| PATCH  | `/notifications/:id/read`                    | Mark one as read                             |
| DELETE | `/notifications/:id`                         | Delete one                                   |

---

## Project Progress

**Mid-sem (11 Oct):** requirements, ER/EER model, relational mapping and normalization (design document); PostgreSQL DDL; Express server with `pg` pool; register / login with bcrypt and JWT; React (Vite) shell with routing and API modules.

**Final (15 Nov):**

- Posts with privacy levels, media attachments, edit and soft delete; privacy-aware feed.
- Likes, comments and bookmarks.
- Friend requests, accept / decline, unfriend, friend suggestions and user search.
- Groups with public / private visibility, join requests, roles, moderation and group feeds.
- Direct messages with inbox, pagination, unread counts and read receipts.
- Trigger-generated notifications.
- Account suspension by platform operators.
- Views, indexes, 5 analytical queries, demo seed data (~2,250 rows) and end-to-end workflow tests.
- Supabase migrations, Row Level Security and storage buckets for hosted deployment.

---

*Built as a DBMS Course Project using the PERN stack.*
