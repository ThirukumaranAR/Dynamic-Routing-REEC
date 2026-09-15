# Northstar Workflow Approval System

A full-stack, enterprise-grade company approval workflow and governance system with role-based routing, SLA escalation, interactive audit trails, and financial tracking.

---

## 🌟 Key Features

1. **Role-Based Access Control (RBAC)**:
   - **Requester** (`Arun` - CSE / EEC Campus): Submit requests, track statuses, answer queries, view audit history.
   - **Approver** (`Rajan Mehta` - IT Dept / Main Campus): Review pending requests, approve, reject, raise queries, or escalate requests idle $\ge 8\text{h}$.
   - **Authority** (`Dr. Suresh Kumar` - Administration / Main Campus): Executive oversight, approval overrides, rejection, or reassignment of escalated requests.

2. **Full Lifecycle Approval State Machine**:
   - `PENDING` $\rightarrow$ `APPROVED` | `REJECTED` | `QUERIED` | `ESCALATED`
   - Interactive timeline audit trail with actor name, timestamp, and action description.
   - 8-hour / 10-hour SLA auto-escalation tracking.

3. **Modules & Views**:
   - **Dashboard**: 6 KPI Metric Cards with real-time counters & Recent Requests feed.
   - **All Requests**: Split dual-pane master-detail view with filter pills (`ALL`, `PENDING`, `APPROVED`, `REJECTED`, `QUERIED`, `ESCALATED`).
   - **Create Request**: Category selector (`Academic`, `Procurement`, `Training`, `Facilities`, `Finance`, `HR`), amount in ₹ INR, description, and auto-routing.
   - **Queries Workspace**: Dedicated inbox for requests requiring clarification.
   - **Flow Categories**: Request count distribution across organizational categories.
   - **SOPs & Policies**: SLA guidelines (10h SLA threshold) and institutional policies.
   - **Completion Status**: Visual analytics (Completion %, Rejection %, Pending count, 4.2h avg resolution time, and color-coded status progress bars).
   - **My Profile**: User role card, campus affiliation, and contact details.

---

## 📁 Project Structure

```
smart-approval-system/
├── backend/                  # Node.js + Express + TypeScript REST API
│   ├── src/
│   │   ├── controllers/      # Auth, Request, Analytics handlers
│   │   ├── middleware/       # JWT and RBAC authentication
│   │   ├── models/           # TypeScript interfaces & types
│   │   ├── routes/           # REST endpoints
│   │   ├── services/         # In-memory / persistent database
│   │   └── server.ts         # Express server entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── frontend/                 # React + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/       # SrmLogo, Icons, StatusBadge, MetricCard, Sidebar, Header
│   │   ├── views/            # Dashboard, AllRequests, CreateRequest, Categories, etc.
│   │   ├── services/         # API client, types & initial demo seed
│   │   ├── App.tsx           # State engine & routing
│   │   ├── main.tsx          # React DOM mounting
│   │   └── index.css         # Tailwind & theme styling
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── index.html
│
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 1. Running the Backend
```bash
cd backend
npm install
npm run dev
```
*Backend runs on `http://localhost:5000`*

### 2. Running the Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`*

### Deploying to Vercel

Deploy `frontend` and `backend` as separate Vercel projects, using each directory as its project root.

For the frontend project, use the default Vite settings (`npm run build`, output directory `dist`).
For the backend project, use the included `backend/vercel.json` configuration.
Set `VITE_API_URL` in the frontend project to the deployed backend URL ending in `/api`.
The frontend falls back to `/api` locally, where the Vite proxy forwards requests to `localhost:5000`.

The current backend uses an in-memory database, so data resets when the serverless instance is restarted.
Persistent user management, dynamic roles, and role-removal reassignment are intentionally deferred until the deployed UI review.

---

## 🔑 Demo Credentials

| Role | Email | Password | Name | Department | Campus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Requester** | `requester@gmail.com` | `pass123` | Arun | Computer Science and Engineering | EEC |
| **Approver** | `approver@gmail.com` | `pass123` | Rajan Mehta | IT Department | Main |
| **Authority** | `authority@gmail.com` | `pass123` | Dr. Suresh Kumar | Administration | Main |

*(Quick demo login buttons are also available directly on the login screen for 1-click switching).*

---

## 📡 REST API Endpoints

### Authentication
- `POST /api/auth/login` - Sign in and receive JWT token
- `GET /api/auth/me` - Get current authenticated user profile
- `GET /api/auth/demo-users` - Retrieve demo user accounts

### Requests & Approvals
- `GET /api/requests` - List requests (supports `?status=...&category=...`)
- `GET /api/requests/:id` - Fetch single request with audit trail
- `POST /api/requests` - Create new approval request
- `POST /api/requests/:id/approve` - Approve request
- `POST /api/requests/:id/reject` - Reject request
- `POST /api/requests/:id/query` - Approver raises clarification query
- `POST /api/requests/:id/respond` - Requester responds to query
- `POST /api/requests/:id/escalate` - Escalate to higher authority
- `POST /api/requests/:id/reassign` - Authority reassigns to approver

### Analytics & Reference
- `GET /api/analytics/dashboard` - KPI metrics and recent requests
- `GET /api/analytics/categories` - Categorical request breakdown
- `GET /api/analytics/sops` - SOPs and policy documents
