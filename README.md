# PulseNet — Full-Stack Social Networking Platform

PulseNet is a relational database-backed social networking platform designed to support real-time user connections, media posts, interactive engagements, community groups, and automated notifications.

This project is built for the DBMS Course Project to demonstrate clean relational database design, integrity enforcement, complex multi-table queries, and full-stack integration using the PERN Stack.

---

## Technology Stack

- **Frontend:** React.js (Vite, Context API / Axios)
- **Backend Layer:** Node.js & Express.js (REST API Architecture, JWT Authentication)
- **Database Layer:** PostgreSQL (Native connection pooling via pg library)
- **Design & Tools:** Postman (API Testing), Git/GitHub (Version Control)

---

## Team Members & Contributions

| Name | Student ID | Primary Responsibilities & Contributions |
| :--- | :--- | :--- |
| Member 1 Name | 202X-XX-XXXX | Lead Backend & Auth: Server setup, Express routing, JWT auth, core API endpoints (/api/auth, /api/posts). |
| Member 2 Name | 202X-XX-XXXX | Social Graph & Messaging: Connections API, friend request workflows (friendships), and notifications logic. |
| Member 3 Name | 202X-XX-XXXX | Comments & Engagements: Post interactions, comment hierarchy routing (comments), and feed UI components. |
| Member 4 Name | 202X-XX-XXXX | Communities & Groups: Group creation, role-based access management (groups, group_members), and group feeds. |
| Member 5 Name | 202X-XX-XXXX | Database & Analytics Lead: Schema design, SQL migration scripts, database triggers, views, and seed scripts (500+ records). |

---

## Relational Database Architecture

The system features 9 core relations designed up to 3NF / BCNF compliance:

1. **users:** Secure credential isolation (user_id, username, email, password_hash).
2. **user_profiles:** 1:1 weak entity storing public metadata (bio, location, avatar_url).
3. **friendships:** Self-referential M:N relation managing connection states (pending, accepted, declined).
4. **posts:** Core content storage with domain-level privacy constraints (public, friends_only, private).
5. **post_likes:** M:N associative entity preventing duplicate likes via composite primary key (user_id, post_id).
6. **comments:** Post engagement supporting self-referential parent/child comment threads.
7. **groups:** Community hubs created by users with foreign key cascade definitions.
8. **group_members:** M:N associative entity enforcing role hierarchy (admin, member).
9. **notifications:** System alerts triggered by social interactions.

---

## Core Application Workflows

1. **User Authentication & Profile Setup (Transactional):** Registers new account credentials in users and initializes linked metadata in user_profiles within an atomic database transaction.
2. **Social Connection Request Flow (Graph Management):** Handles bidirectional friendship logic (INSERT request -> UPDATE status), controlling mutual access permissions.
3. **Personalized Feed Generation (Complex Retrieval):** Executes multi-table joins (posts, users, friendships, post_likes) to compile feeds showing public posts and accepted connections' updates.

---

## Current Mid-Sem Progress Summary

- [x] **Database Schema:** Formulated ER/EER model, mapped relational schema, and written initial PostgreSQL DDL scripts (schema.sql).
- [x] **Backend Infrastructure:** Initialized Node.js/Express server environment, configured PostgreSQL connection pool (pg), and set up environment variables.
- [x] **Authentication Layer:** Built REST endpoints for user registration, login, and password hashing using bcrypt & JWT.
- [x] **Frontend Shell:** Initialized React application with Vite, set up base client routing, and established API connection modules.
- [x] **Midterm Deliverables:** Compiled 5-page Database Design Document (PDF) covering system assumptions, ER diagram, schema mapping, and normalization justifications.

---

## Local Setup & Installation

### Prerequisites

- Node.js (v18.x or higher)
- PostgreSQL (v14.x or higher)
- Git

### 1. Clone the Repository

```bash
git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
cd your-repo-name
