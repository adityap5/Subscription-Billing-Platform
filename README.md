# Subscription Billing Platform

## Demo / Walkthrough
[Watch the Demo Walkthrough Video](https://drive.google.com/file/d/19wfx9FeeIQJo_Y3NHqJgTg8ZgrIMY-lO/view?usp=sharing)

A production-grade subscription billing platform built with Express.js (backend) and Next.js 15 (frontend), using Razorpay Orders API for payments, MongoDB for persistence, and Resend for email notifications.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed decisions, data model, payment flow diagrams, and edge case documentation.

## Tech Stack

- **Runtime:** Bun
- **Backend:** Express.js + TypeScript + Mongoose (MongoDB)
- **Frontend:** Next.js 15 (App Router) + React + TypeScript + Tailwind CSS
- **Payments:** Razorpay Orders API (test mode)
- **Email:** Resend
- **Auth:** JWT + bcrypt

## Prerequisites

- [Bun](https://bun.sh/) installed (v1.0+)
- MongoDB Atlas account (or local MongoDB)
- Razorpay account (test mode API keys)
- Resend account (API key + verified sender domain)

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd subscription-billing-platform

# Install backend dependencies
cd backend
bun install

# Install frontend dependencies
cd ../frontend
bun install
```

### 2. Configure Environment Variables

**Backend** — copy and fill in `backend/.env.example` → `backend/.env`:

```bash
cd backend
cp .env.example .env
# Edit .env with your values
```

**Frontend** — copy and fill in `frontend/.env.local.example` → `frontend/.env.local`:

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local with your values
```

See `.env.example` / `.env.local.example` for detailed comments on where to get each value.

### 3. Seed the Database

```bash
cd backend
bun run seed
```

This creates 3 plans (Basic ₹499, Pro ₹999, Enterprise ₹1999) if they don't already exist.

### 4. Run Development Servers

```bash
# Terminal 1 — Backend (default port 5000)
cd backend
bun run dev

# Terminal 2 — Frontend (default port 3000)
cd frontend
bun run dev
```

### 5. Run Tests

```bash
cd backend
bun test
```

## Project Structure

```
subscription-billing-platform/
├── README.md
├── ARCHITECTURE.md
├── backend/           # Express.js API
│   ├── src/
│   │   ├── config/    # Env validation, DB connection
│   │   ├── models/    # Mongoose schemas
│   │   ├── routes/    # Express routers
│   │   ├── controllers/
│   │   ├── services/  # Business logic & state machine
│   │   ├── middleware/
│   │   ├── validators/
│   │   ├── utils/
│   │   ├── emails/
│   │   ├── scripts/   # Seed script
│   │   └── types/
│   └── tests/
└── frontend/          # Next.js 15 App Router
    ├── app/           # Route pages
    ├── components/    # UI & feature components
    ├── lib/           # API client & types
    ├── hooks/
    └── context/
```

## Razorpay Webhook Setup

1. Go to Razorpay Dashboard → Settings → Webhooks
2. Add endpoint: `https://your-backend-url/api/webhooks/razorpay`
3. Select events: `payment.captured`, `payment.failed`
4. Set a webhook secret and add it to `RAZORPAY_WEBHOOK_SECRET` in your backend `.env`

## Testing Webhook Idempotency

See [ARCHITECTURE.md — Webhook Duplicate Testing](./ARCHITECTURE.md#webhook-duplicate-testing-manual) for instructions on manually replaying webhook payloads to verify idempotency.
