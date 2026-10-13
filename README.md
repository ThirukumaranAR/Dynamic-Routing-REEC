# FlowNexus Approval System

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

4. **Configurable Approval Routing**:
   - CEO manages HR, IT, and Finance workflows from **Workflow Configuration**.
   - Each workflow has an identifier, branch, ordered role steps, active state, and version.
   - Managers choose the request branch; approval then advances through the captured workflow snapshot.
   - Finance workflows must include the Accountant; Manager must start the route, General Manager must remain, and CEO must finish it.
   - New roles can be created, assigned to an account, and explicitly inserted into a workflow.

---

## Dynamic Workflow Configuration

The browser app initializes these editable default workflow definitions:

| Branch | Default ordered approval roles |
| :--- | :--- |
| HR | `MANAGER` → `HR` → `GENERAL_MANAGER` → `CEO` |
| IT | `MANAGER` → `IT` → `GENERAL_MANAGER` → `CEO` |
| Finance | `MANAGER` → `FINANCE` → `ACCOUNTANT` → `GENERAL_MANAGER` → `CEO` |

The configuration shape is `{ id, name, branch, version, steps: [{ id, role }], active, updatedAt }`. Saving an edit increments its version. New requests store snapshots for the active branch workflows at submission; the Manager's branch decision selects one of those snapshots. Changes therefore affect later requests, not requests already in progress. Invalid active workflows are deactivated during safe localStorage loading and must be corrected before use.

The frontend stores workflows under `flownexus_approval_workflows_v1`; existing requests under `smart_approval_requests_v2` receive a best-effort legacy workflow snapshot when loaded. Existing audit trails are retained.

The CEO-protected Express API also exposes `GET /api/admin/workflows` and `PUT /api/admin/workflows/:workflowId`; request APIs include `POST /api/requests/:id/route` and validate approval/rejection against the current workflow step. The browser UI currently operates on its own localStorage user/request/workflow data and does not call these request APIs. The Express API uses a separate in-memory store. Consequently, browser data is per-browser, does not synchronize between users, and is not protected by server-side authorization. API-side checks protect API calls only; production multi-user use requires moving authentication and approval state to a shared persistent server-side store and connecting the UI to it.

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
- MySQL (v8.0 or higher) or Docker

### 1. Database Configuration
Configure `backend/.env` with your MySQL connection string:
```bash
DATABASE_URL=mysql://root:password@127.0.0.1:3306/flownexus
```

Apply migrations and generate Prisma client:
```bash
cd backend
npx prisma db push
```

### 2. Running the Backend
```bash
cd backend
npm install
npm run dev
```
*Backend runs on `http://localhost:5000`*

### 3. Running the Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`*

The backend uses a production-ready MySQL database with Prisma ORM, providing ACID transactions, relational foreign-key integrity, and persistent audit trails across server restarts.

---

## 🔑 Demo Credentials

| Role | Email | Password | Name | Department | Campus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Requester** | `requester@gmail.com` | `pass123` | Arun | Computer Science and Engineering | EEC |
| **Manager** | `manager@gmail.com` | `pass123` | Rajan Mehta | Operations | Main |
| **HR Head** | `hr@gmail.com` | `pass123` | Sarah Jenkins | People & Culture | Corporate Services |
| **IT Head** | `it@gmail.com` | `pass123` | Vikram Seth | Technology | Corporate Services |
| **Finance Head** | `finance@gmail.com` | `pass123` | Amitabh Verma | Finance | Corporate Services |
| **Accountant** | `accountant@gmail.com` | `pass123` | Pooja Sharma | Finance | Corporate Services |
| **General Manager** | `gm@gmail.com` | `pass123` | Kavitha Reddy | Operations | Head Office |
| **CEO** | `ceo@gmail.com` | `pass123` | Dr. Suresh Kumar | Executive Office | Head Office |

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
- `POST /api/requests/:id/route` - Manager selects and applies a captured branch workflow
- `POST /api/requests/:id/approve` - Approve request
- `POST /api/requests/:id/reject` - Reject request
- `POST /api/requests/:id/query` - Approver raises clarification query
- `POST /api/requests/:id/respond` - Requester responds to query
- `POST /api/requests/:id/escalate` - Escalate to higher authority
- `POST /api/requests/:id/reassign` - Authority reassigns to approver

### CEO Administration
- `GET /api/admin/workflows` - List workflow configurations
- `PUT /api/admin/workflows/:workflowId` - Validate and save a new workflow version

### Analytics & Reference
- `GET /api/analytics/dashboard` - KPI metrics and recent requests
- `GET /api/analytics/categories` - Categorical request breakdown
- `GET /api/analytics/sops` - SOPs and policy documents
