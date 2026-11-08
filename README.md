# PulseNet — Full-Stack Social Networking Platform

PulseNet is a relational database-backed social networking platform designed to support real-time user connections, media posts, interactive engagements, community groups, and automated notifications.

This project is built for the DBMS Course Project to demonstrate clean relational database design, integrity enforcement, complex multi-table queries, and full-stack integration using the PERN Stack.

---

## Technology Stack

- **Frontend:** React.js (Vite, Context API, Axios)
- **Backend:** Node.js & Express.js (REST API Architecture, JWT Authentication)
- **Database:** PostgreSQL (Native connection pooling via `pg` library)
- **Tools:** Postman (API Testing), Git/GitHub (Version Control)

---

## Team Members & Contributions

| Name                  | Student ID   | Primary Responsibilities & Contributions                                                                                        |
| --------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Kshitij Mathur        | 2024A8PS0462H | **Lead Backend & Auth:** Server setup, Express routing, pg pool, JWT authentication, and core API endpoints (`/api/auth`, `/api/posts`). |
| Fidel Saji            | 2024AAPS1158H | **Social Graph & Messaging:** Friend request workflows (`friendships`), notification logic, and direct messaging endpoints.     |
| Ritika Mirium Thomas  | 2024A8PS0447H | **Engagement & Feed:** Post interactions, likes, bookmarking (`saved_posts`), comments, and feed UI components.               |
| Yadavalli Sai Charam  | 2024A8PS0460H | **Communities & Groups:** Group creation, role-based access management (`groups`, `group_members`), and group feeds.            |
| Shresth Prakash Singh | 2024A8PS0324H | **Database & Analytics:** Schema design, SQL migration scripts, database triggers, views, and seed data validation (500+ records). |

---

## Relational Database Architecture

The system features 12 core relations designed toward 3NF/BCNF compliance, organized across 6 functional domains:

### Accounts & Profiles
1. **users:** Secure credential storage and status tracking (`user_id`, `username`, `email`, `password_hash`, `account_status`, `created_at`, `updated_at`).
2. **user_profiles:** One-to-one extension of users storing public profile information (`profile_id`, `user_id`, `full_name`, `bio`, `location`, `website_url`, `avatar_storage_path`).

### Social Graph
3. **friendships:** Self-referential relation managing connection states (`requester_id`, `addressee_id`, `status` [pending, accepted, declined], `created_at`, `responded_at`).

### Content & Media
4. **posts:** Core content storage with privacy settings and soft delete (`post_id`, `author_id`, `content`, `privacy_level` [public, friends_only, private], `created_at`, `updated_at`, `deleted_at`).
5. **post_media:** One-to-many media attachment storage linked to posts (`media_id`, `post_id`, `storage_bucket`, `storage_path`, `media_type` [image, video], `mime_type`, `file_size_bytes`, `created_at`).
6. **comments:** Post interactions and discussion threads (`comment_id`, `post_id`, `author_id`, `content`, `created_at`, `updated_at`).

### Engagement
7. **post_likes:** Many-to-many associative relation preventing duplicate likes via composite primary key (`user_id`, `post_id`, `created_at`).
8. **saved_posts:** Many-to-many associative relation enabling users to bookmark posts (`user_id`, `post_id`, `saved_at`).

### Communities
9. **groups:** Community hubs created by users with role enforcement (`group_id`, `name`, `description`, `creator_id`, `visibility` [public, private], `created_at`).
10. **group_members:** Many-to-many associative relation managing group memberships and roles (`group_id`, `user_id`, `role` [admin, moderator, member], `joined_at`).

### Communication
11. **notifications:** System and social alerts triggered by interactions (`notification_id`, `recipient_id`, `actor_id`, `notification_type`, `related_post_id`, `related_group_id`, `is_read`, `created_at`).
12. **direct_messages:** One-to-one direct messaging between users with read receipt tracking (`message_id`, `sender_id`, `recipient_id`, `content`, `sent_at`, `read_at`).

---

## Core Application Workflows

1. **W1 — User Authentication & Profile Setup:** Registers account credentials in `users` and initializes linked metadata in `user_profiles` within an atomic database transaction.
2. **W2 — Social Connection & Privacy-Aware Feed:** Manages friendship requests with acceptance flows; compiles personalized feeds with likes, comments, and post bookmarks (`saved_posts`).
3. **W3 — Post Creation with Media Attachments:** Coordinates atomic inserts into `posts` and `post_media` with deferred constraint triggers ensuring non-deleted posts contain text or media attachments.
4. **W4 — Communities & Direct Messaging:** Supports group creation (automatically assigning creator as admin), membership management, notifications, and direct messaging between users with read receipts.

---

## Database Triggers

Notifications are generated inside PostgreSQL by triggers (`server/db/schema.sql`), so every write path (API, seed script, manual SQL) produces them consistently. Self-actions (liking or commenting on your own post) never notify.

| Trigger | Fires on | Effect |
| --- | --- | --- |
| `trg_friendships_notify` | `friendships` insert / status update / delete | Request sent: notify addressee (`friend_request`). Request answered: mark that notification read; if accepted, notify requester (`friend_accepted`). Pending request cancelled: remove unread notification. |
| `trg_post_likes_notify` | `post_likes` insert / delete | Like: notify post author (`post_like`). Unlike: remove unread notification. |
| `trg_comments_notify` | `comments` insert | Notify post author (`post_comment`). |
| `trg_direct_messages_notify` | `direct_messages` insert / `read_at` update | Unread message: notify recipient (`direct_message`); repeated messages from the same sender collapse into one unread notification. Conversation read: mark it read. |

Integrity rules enforced by the schema for the social graph:

- A user cannot send a friend request to themselves (`chk_friend_not_self`).
- Only one friendship row may exist per pair of users in either direction (`uq_friendship_pair` on `LEAST/GREATEST` of the two ids).
- `responded_at` is set exactly when a request leaves `pending` (`chk_friend_responded_iff_not_pending`).
- A notification's actor cannot be its recipient; `notification_type` is restricted to known types.

---

## API Reference

Base URL: `http://localhost:5000/api`. All routes except `register`, `login` and `health` need the header `Authorization: Bearer <token>` from login.

### Auth & Health

| Method | Route | Description |
| --- | --- | --- |
| GET | `/health` | API and database status |
| POST | `/auth/register` | Body `{ username, email, password, full_name }`; creates user + profile in one transaction |
| POST | `/auth/login` | Body `{ email, password }`; returns JWT |
| GET | `/auth/me` | Current user with profile |

### Posts

| Method | Route | Description |
| --- | --- | --- |
| POST | `/posts` | Body `{ content, privacy_level, media[] }` |
| GET | `/posts/feed?limit=&offset=` | Privacy-aware feed with like and comment counts |
| GET | `/posts/:id` | Single post with media |
| PATCH | `/posts/:id` | Edit own post |
| DELETE | `/posts/:id` | Soft-delete own post |

### Friends

| Method | Route | Description |
| --- | --- | --- |
| GET | `/friends?limit=&offset=` | Accepted friends with `friends_since` |
| GET | `/friends/requests?direction=incoming\|outgoing` | Pending requests to me (default) or from me |
| GET | `/friends/status/:userId` | `none`, `friends`, `request_sent`, `request_received` or `declined` |
| POST | `/friends/requests/:userId` | Send request (allowed again after a decline) |
| PATCH | `/friends/requests/:userId` | Body `{ action: "accept" \| "decline" }`; only the addressee can respond |
| DELETE | `/friends/:userId` | Unfriend, cancel own pending request, or clear a declined one |

### Direct Messages

Only accepted friends can send messages to each other.

| Method | Route | Description |
| --- | --- | --- |
| GET | `/messages` | Inbox: latest message and unread count per conversation |
| GET | `/messages/unread-count` | Total unread messages |
| GET | `/messages/:userId?limit=&before=` | Conversation, newest first; pass `next_before` from the previous page as `before` |
| POST | `/messages/:userId` | Body `{ content }` (max 2000 characters) |
| PATCH | `/messages/:userId/read` | Mark that user's messages to me as read (read receipts) |

### Notifications

| Method | Route | Description |
| --- | --- | --- |
| GET | `/notifications?unread=true&limit=&offset=` | My notifications with actor and post preview |
| GET | `/notifications/unread-count` | Unread count for the bell badge |
| PATCH | `/notifications/read-all` | Mark all as read |
| PATCH | `/notifications/:id/read` | Mark one as read |
| DELETE | `/notifications/:id` | Delete one |

Errors return `{ "error": "..." }` with status 400 (bad input), 401 (missing or invalid token), 403 (not allowed), 404 (not found) or 409 (duplicate / conflicting state).

---

## Current Mid-Sem Progress Summary

- **Database Schema:** Formulated the ER/EER model, mapped the relational schema, and written initial PostgreSQL DDL scripts (`schema.sql`).
- **Backend Infrastructure:** Initialized the Node.js/Express server, configured the PostgreSQL connection pool (`pg`), and set up environment variables.
- **Authentication Layer:** Built REST endpoints for user registration and login, with password hashing using bcrypt and JWT-based authentication.
- **Frontend Shell:** Initialized the React application with Vite, set up base client routing, and established API connection modules.
- **Midterm Deliverables:** Compiled a 5-page Database Design Document (PDF) covering system assumptions, ER diagram, schema mapping, and normalization justifications.

## Post Mid-Sem Progress

- **Posts:** Create (with media, in one transaction), privacy-aware feed, view, edit and soft-delete endpoints.
- **Social Graph:** Friend request, accept/decline, unfriend and relationship-status endpoints, with self-request and reverse-duplicate prevention enforced in the schema.
- **Direct Messaging:** Friends-only messaging with inbox, paginated conversations, unread counts and read receipts.
- **Notifications:** Trigger-generated notifications for friend requests, acceptances, likes, comments and messages, plus endpoints to list, count, mark read and delete them.

---

## Local Setup & Installation

### Prerequisites

- Node.js (v18.x or higher)
- PostgreSQL (v14.x or higher)
- Git

### 1. Clone the Repository

Replace the URL below with your actual GitHub repository URL.

```bash
git clone https://github.com/kmkm-com/PulseNet.git
cd PulseNet
```

### 2. Database Setup

Create a new PostgreSQL database:

```sql
CREATE DATABASE pulsenet_db;
```

Run the SQL schema script to create the tables and triggers, then load the sample data:

```bash
psql -d pulsenet_db -U postgres -f server/db/schema.sql
psql -d pulsenet_db -U postgres -f server/db/seed.sql
```

Both scripts can be re-run at any time, but doing so **wipes all existing data**. Re-run them after pulling any change to `schema.sql`.

Seed accounts: `alice`, `bob`, `charlie`, `diana` and `evan`, each with email `<name>@example.com` and password `password123`.

### 3. Backend Setup

Navigate to the server directory:

```bash
cd server
```

Install the dependencies:

```bash
npm install
```

Create a `.env` file inside the `server` directory:

```ini
PORT=5000
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pulsenet_db
JWT_SECRET=your_super_secret_jwt_key
```

Start the development server:

```bash
npm run dev
```

### 4. Frontend Setup

Open a **new terminal window** from the project root and navigate to the client directory:

```bash
cd client
```

Install the dependencies:

```bash
npm install
```

Start the React development server:

```bash
npm run dev
```

---

## Future Enhancements

- Real-time messaging and notifications.
- Media uploads and richer post interactions.
- Advanced feed ranking and personalization.
- Improved database analytics and query optimization.

---

*Built as a DBMS Course Project using the PERN Stack.*
