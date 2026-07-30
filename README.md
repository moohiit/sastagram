# SastaGram 📸

<!-- Replace moohiit/sastagram with the GitHub repository slug once pushed -->
[![CI](https://github.com/moohiit/sastagram/actions/workflows/ci.yml/badge.svg)](https://github.com/moohiit/sastagram/actions/workflows/ci.yml)

A MERN-stack Instagram-style social platform with photo posts, likes, comments, bookmarks, follow system, and real-time chat and notifications powered by Socket.io.

**Live demo:** https://sastagram.mohitpatel.org/

---

## Features

### Posts & Feed
- Create photo posts with captions (image processed with Sharp, hosted on Cloudinary)
- Home feed of posts with like / dislike, comments, and bookmarks
- Explore view and per-user post grid
- Delete your own posts

### Social
- Follow / unfollow users
- Followers and following lists
- Suggested users sidebar
- User search and public profiles
- Edit profile (bio, gender, profile picture upload)

### Real-time (Socket.io)
- One-to-one chat with instant message delivery
- Online users presence indicator
- Live notifications when someone likes or comments on your post

### Auth
- Register / login / logout with JWT stored in an httpOnly cookie
- Protected routes on both API (auth middleware) and frontend (route guards)
- Persistent client session via Redux Persist

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite, Redux Toolkit + Redux Persist, React Router 6, Tailwind CSS, shadcn/ui (Radix UI), Axios, Socket.io Client, Sonner (toasts) |
| Backend | Node.js, Express, Socket.io, Multer + Sharp (image processing), Cloudinary (media storage) |
| Database | MongoDB with Mongoose |
| Auth | JWT, bcryptjs, httpOnly cookies |

---

## Project Structure

```
instagram-clone/
├── backend/
│   ├── controllers/     # user, post, message handlers
│   ├── middlewares/     # auth guard, multer upload
│   ├── models/          # User, Post, Comment, Conversation, Message
│   ├── routes/          # /api/v1 routers
│   ├── socket.io/       # Socket.io server + online-user map
│   ├── tests/           # Vitest + Supertest API tests (in-memory MongoDB)
│   ├── utils/           # DB connection, Cloudinary, datauri helpers
│   ├── app.js           # Express app wiring (middleware + routes, no listen)
│   └── server.js        # Entry: DB connect, listen, graceful shutdown
├── frontend/
│   ├── src/
│   │   ├── components/  # Feed, Post, Chat, Profile, Explore, ui/ ...
│   │   ├── hooks/       # data-fetching + real-time hooks
│   │   ├── redux/       # auth, post, chat, notification, socket slices
│   │   └── lib/         # utilities
│   └── vite.config.js
└── package.json         # Root scripts (dev / build / start)
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Cloudinary account (media storage)

### Installation

```bash
git clone https://github.com/moohiit/instagram-clone.git
cd instagram-clone

# Install backend + frontend dependencies
npm install
npm install --prefix frontend
```

### Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```env
PORT=8000
# Frontend origin allowed by CORS (dev: http://localhost:5173)
URL=http://localhost:5173
MONGO_URI=your_mongodb_uri
# Long random string, e.g. run: openssl rand -hex 32
JWT_SECRET=your_jwt_secret

# Cloudinary (dashboard -> Account Details)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Set by the platform in production (Render sets this automatically)
# NODE_ENV=production
```

### Run

```bash
# Backend (with nodemon)
npm run dev

# Frontend (separate terminal)
cd frontend && npm run dev
```

For production, build the frontend and serve everything from Express:

```bash
npm run build
npm start
```

The server also serves the built frontend from `frontend/dist`.

---

## Testing

Backend API tests use [Vitest](https://vitest.dev/) + [Supertest](https://github.com/ladjs/supertest) against a real in-memory MongoDB ([mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server)) — no external database or Cloudinary credentials required.

```bash
npm test
```

Covered: auth (register validation, NoSQL-injection guard, login cookies, session check), posts (cursor pagination, like/dislike, comments, edit/delete authorization), and messaging (send, read receipts, unread counts).

Rate limiting is disabled when `NODE_ENV=test`. Tests live in `backend/tests/`.

## Continuous Integration

Every push and pull request to `main` or `upgrade/**` runs the backend test suite and a frontend production build via GitHub Actions (`.github/workflows/ci.yml`).

---

## API Overview

All endpoints are prefixed with `/api/v1`. Authenticated routes require the JWT cookie.

| Group | Base Path | Endpoints |
|---|---|---|
| Users | `/api/v1/user` | `register`, `login`, `logout`, `:id/profile`, `profile/edit`, `suggested`, `followorunfollow/:id`, `search/:id`, `:id/followers`, `:id/following` |
| Posts | `/api/v1/post` | `addpost`, `all`, `userpost/all`, `:id/like`, `:id/dislike`, `:id/comment`, `:id/comment/all`, `:id/bookmark`, `delete/:id` |
| Messages | `/api/v1/message` | `send/:id`, `all/:id` |

Socket.io events: `getOnlineUsers` (presence), `newMessage` (chat), `notification` (likes/comments).

---

## Author

**Mohit Patel** — https://mohitpatel.org · GitHub [@moohiit](https://github.com/moohiit)

Live demo: https://sastagram.mohitpatel.org/
