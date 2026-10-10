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

| Name          | Student ID   | Primary Responsibilities & Contributions                                                                                        |
| ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Kshitij Mathur | 2024A8PS0462H | **Lead Backend & Auth:** Server setup, Express routing, JWT authentication, and core API endpoints (`/api/auth`, `/api/posts`). |
| Fidel Saji | 2024AAPS1158H | **Social Graph & Messaging:** Connections API, friend request workflows (`friendships`), and notification logic.                |
| Ritika Mirium Thomas | 2024A8PS0447H | **Comments & Engagements:** Post interactions, comment hierarchy routing, and feed UI components.                               |
| Yadavalli Sai Charam | 2024A8PS0460H | **Communities & Groups:** Group creation, role-based access management (`groups`, `group_members`), and group feeds.            |
| Shresth Prakash Singh | 2024A8PS0324H | **Database & Analytics:** Schema design, SQL migration scripts, database triggers, views, and seed scripts (500+ records).      |

---

## Relational Database Architecture

The system features 9 core relations designed toward 3NF/BCNF compliance:

1. **users:** Secure credential storage (`user_id`, `username`, `email`, `password_hash`).
2. **user_profiles:** One-to-one relation storing public metadata (`bio`, `location`, `avatar_url`).
3. **friendships:** Self-referential many-to-many relation managing connection states (`pending`, `accepted`, `declined`).
4. **posts:** Core content storage with privacy settings (`public`, `friends_only`, `private`).
5. **post_likes:** Many-to-many associative relation preventing duplicate likes using a composite primary key (`user_id`, `post_id`).
6. **comments:** Post engagement supporting self-referential parent/child comment threads.
7. **groups:** Community hubs created by users with foreign key constraints.
8. **group_members:** Many-to-many associative relation managing group roles (`admin`, `member`).
9. **notifications:** System alerts triggered by social interactions.

---

## Core Application Workflows

1. **User Authentication & Profile Setup:** Registers account credentials in `users` and initializes linked metadata in `user_profiles` within an atomic database transaction.
2. **Social Connection Request Flow:** Manages friendship requests through status updates, controlling mutual access permissions.
3. **Personalized Feed Generation:** Uses multi-table joins involving `posts`, `users`, `friendships`, and `post_likes` to compile feeds containing public posts and updates from accepted connections.

---

## Current Mid-Sem Progress Summary

- **Database Schema:** Formulated the ER/EER model, mapped the relational schema, and written initial PostgreSQL DDL scripts (`schema.sql`).
- **Backend Infrastructure:** Initialized the Node.js/Express server, configured the PostgreSQL connection pool (`pg`), and set up environment variables.
- **Authentication Layer:** Built REST endpoints for user registration and login, with password hashing using bcrypt and JWT-based authentication.
- **Frontend Shell:** Initialized the React application with Vite, set up base client routing, and established API connection modules.
- **Midterm Deliverables:** Compiled a 5-page Database Design Document (PDF) covering system assumptions, ER diagram, schema mapping, and normalization justifications.

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
cd your-repo-name
```

### 2. Database Setup

Create a new PostgreSQL database:

```sql
CREATE DATABASE pulsenet_db;
```

Run the SQL schema script to create the tables:

```bash
psql -d pulsenet_db -U postgres -f server/db/schema.sql
```

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
