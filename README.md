# Civicदृष्टि ꔪ

> **Civic Vision — A Digital Platform for Transparency, Accountability, and Citizen Participation in Nepal**

Civicदृष्टि is a civic transparency and accountability platform designed to connect **citizens, local authorities, ward representatives, analysts, and administrators** through a single digital platform.

The system combines **public budget transparency** with **civic issue reporting**, enabling citizens to understand how public resources are used, report problems in their communities, and track those issues from reporting to resolution.

Built with **Next.js, Express.js, MongoDB, and Mongoose**, Civicदृष्टि provides a modern, bilingual, role-based platform designed around transparency and responsible governance.

---

## 📌 Overview

Civicदृष्टि brings two important aspects of civic engagement together:

### 💰 Public Budget Transparency

Citizens can explore government budget information by:

* Sector
* Department
* District
* Fiscal year
* Spending trends
* Department workload

Analysts can propose corrections or updates to budget records, while administrators review and approve those changes before they become official.

### 🚨 Civic Issue Reporting

Citizens can report local problems such as:

* 🛣️ Potholes and damaged roads
* 🌊 Flooding
* 🚰 Drainage problems
* ⚡ Electrical hazards
* 🏙️ Other local infrastructure issues

Each issue follows a structured workflow:

**Report → Verify → Assign → Resolve**

This creates a transparent record of how civic problems are handled.

---

## ✨ Key Features

### 🚨 Civic Issue Management

* Report civic issues with location and category
* Set issue severity
* Upload supporting photographs
* Track issue status
* Detect potential duplicate reports
* Community upvotes
* Comments and discussion
* Authority assignment
* Resolution tracking
* Complete issue history

### 💰 Budget Explorer

* Search public budget records
* Filter by sector
* Filter by department
* Filter by district
* Filter by fiscal year
* Analyze spending trends
* View department workload
* Propose budget data changes
* Admin approval workflow

### 🏛️ Authorities & Departments

* View responsible authorities
* Identify departments responsible for specific issues
* Track authority responsibilities
* View performance and historical records

### 🤖 AI-Powered Briefs

Google Gemini provides simplified summaries of complex civic and financial information, helping users understand:

* Budget trends
* Spending patterns
* Civic issue trends
* Department activity

### 📢 Notices & Notifications

Administrators can:

* Publish important notices
* Display system-wide announcements
* Target specific user roles
* Send email notifications
* Notify users when issue statuses change

### 🏘️ Ward Representatives

Ward Representatives receive access based on their approved ward.

* Submit and manage civic issues within their ward
* View ward-specific information
* Work with relevant budget information
* Participate in civic issue management
* Require administrator approval before receiving the role

### 🌐 Bilingual Interface

The platform supports:

* 🇬🇧 English
* 🇳🇵 नेपाली

Users can switch languages through a centralized language toggle.

### 🔐 Role-Based Access Control

Different users receive different permissions based on their responsibilities.

| Role                        | Primary Responsibilities                                           |
| --------------------------- | ------------------------------------------------------------------ |
| 👑 **Admin**                | Manage users, approvals, notices, and system-wide data             |
| 🧑‍💼 **Analyst**           | Verify issues, manage civic data, and propose budget changes       |
| 👤 **Researcher**           | Report issues, participate in discussions, and explore public data |
| 🏘️ **Ward Representative** | Handle civic and budget activities within an approved ward         |

---

## 🔄 Data Governance

Civicदृष्टि follows a controlled data-change process to protect the integrity of official information.

```text
Citizens
   │
   │ Report / View
   ▼
Analysts
   │
   │ Verify / Propose
   ▼
Administrators
   │
   │ Approve / Reject
   ▼
Official Data
```

### 💰 Budget Change Workflow

1. Analyst opens **Budget Explorer**
2. Analyst selects **Propose Edit**
3. Analyst submits the proposed changes and reason
4. Administrator reviews the change request
5. Administrator approves or rejects the request
6. Approved changes are applied to the official budget record

This ensures that important public data cannot be changed without proper review.

---

## 🏗️ System Architecture

```text
┌───────────────────────────────────────────┐
│              Civicदृष्टि 🇳🇵              │
└─────────────────────┬─────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────┐
│          Next.js Frontend                 │
│      React + Tailwind CSS + Recharts      │
└─────────────────────┬─────────────────────┘
                      │
                  /api/*
                      │
                      ▼
┌───────────────────────────────────────────┐
│             Express.js API                │
│      Authentication + Business Logic      │
└─────────────────────┬─────────────────────┘
                      │
              ┌───────┴────────┐
              ▼                ▼
       ┌────────────┐    ┌──────────────┐
       │  MongoDB   │    │ In-Memory    │
       │  Mongoose  │    │  Fallback    │
       └────────────┘    └──────────────┘
              │
              ▼
       ┌───────────────┐
       │ External APIs │
       │ Gemini / Email│
       └───────────────┘
```

---

## 🛠️ Technology Stack

### Frontend

* **Next.js 14** — React framework with App Router
* **React** — UI development
* **Tailwind CSS** — Styling and responsive design
* **Recharts** — Data visualization
* **Lucide React** — Interface icons

### Backend

* **Node.js**
* **Express.js**
* **Mongoose**

### Database

* **MongoDB**
* MongoDB Compass for database management

### Authentication & Security

* **JWT** — Authentication tokens
* **bcryptjs** — Password hashing
* Role-based authorization

### Communication

* **Nodemailer**
* Email verification
* OTP verification
* Password reset
* Welcome emails
* System notices

### Artificial Intelligence

* **Google Gemini API**
* AI-generated civic and budget briefs

---

## 📁 Project Structure

```text
Government-web/
├── frontend/                       # Next.js frontend (App Router)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (protected)/        # Auth-gated app pages
│   │   │   │   ├── admin/          # User management, wards & representatives
│   │   │   │   ├── analytics/      # Charts & spending analysis
│   │   │   │   ├── authorities/    # Responsible authorities directory
│   │   │   │   ├── budget/         # Budget explorer
│   │   │   │   ├── dashboard/      # Civic overview (home after login)
│   │   │   │   ├── departments/    # Implementing agencies
│   │   │   │   ├── issues/         # Civic issue reports + map + detail/discussion
│   │   │   │   ├── reports/        # AI-generated briefs
│   │   │   │   ├── settings/       # Notices, account settings
│   │   │   │   └── layout.jsx      # Sidebar + Topbar shell for all protected pages
│   │   │   ├── api/                # Next.js route handlers
│   │   │   ├── login/              # Login page
│   │   │   ├── signup/             # Signup page (citizen / staff / ward rep)
│   │   │   ├── globals.css
│   │   │   ├── layout.jsx          # Root layout (fonts, providers, theme script)
│   │   │   └── page.jsx            # Public landing page
│   │   ├── components/             # Reusable UI (Sidebar, Topbar, MapPicker, IssuesMap, CivicAuthShell, etc.)
│   │   ├── context/                # AuthContext, LanguageContext (global state)
│   │   ├── lib/                    # API client, formatting, i18n, face-match helpers
│   │   └── styles/                 # CSS modules (civicAuth.module.css)
│   ├── public/
│   │   ├── icons/
│   │   └── models/                 # face-api.js models for selfie verification
│   ├── jsconfig.json
│   ├── next.config.js
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                        # Node + Express API
│   ├── models/                     # Mongoose schemas (User, IncidentReport, BudgetItem, Authority, Notice, Project, WardUnit, ...)
│   ├── routes/                     # API route handlers (auth, reports, budgets, authorities, wards, notices, ...)
│   ├── middleware/                 # Auth/role-guard middleware
│   ├── utils/                      # Email, SMS, AI briefs, avatar-hue, seeding helpers
│   ├── scripts/                    # One-off maintenance scripts (avatar re-roll, demo cleanup, etc.)
│   ├── db.js                       # MongoDB connection (falls back to in-memory store if unreachable)
│   ├── memstore.js                 # In-memory data store used in no-DB fallback mode
│   ├── index.js                    # Express app entry point
│   ├── .env                        # MONGODB_URI and other server secrets (not committed)
│   └── package.json
│
├── .vscode/
├── .gitignore
├── README.md
└── package.json                    # Root workspace scripts (npm run dev runs both apps)
```

---

## 🚀 Getting Started

### Prerequisites

Make sure the following are installed:

* **Node.js**
* **npm**
* **MongoDB** (optional when using memory mode)
* **Git**

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd govinsight-nepal
```

### 2. Install Dependencies

The project uses npm workspaces.

```bash
npm install
npm install maplibre-gl
```
"To open mongoose"
Get-Service MongoDB
If you see:

Status   Name
------   ----
Stopped  MongoDB

start it:

Start-Service MongoDB

Then verify:

Get-Service MongoDB

### 3. Configure Environment Variables

Create:

```text
backend/.env
```

Add the required configuration:

```env
PORT=5000

MONGODB_URI=Your URL
MONGODB_DB=govinsight-nepal

JWT_SECRET=your-long-random-secret

GEMINI_API_KEY=your-gemini-api-key

EMAIL_SERVICE=gmail
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-app-password
```

### 4. Start the Application

```bash
npm run dev
```

The application will be available at:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:5000
```

### 5. Check API Health

Open:

```text
http://localhost:5000/api/health
```

---

## 🗄️ MongoDB

For local MongoDB, use:

```text
mongodb://127.0.0.1:27017
```

The application uses the following main collections:

```text
users
incidentreports
budgetitems
changerequests
authorities
wardunits
notices
notifications
reviews
projects
documents
activities
```

If MongoDB is unavailable, the backend can operate using its **temporary in-memory fallback mode**.

> ⚠️ Data stored in memory is lost when the server restarts.

---

## 📜 Available Scripts

### Development

```bash
npm run dev
```

Runs the frontend and backend together.

### Production Build

```bash
npm run build
```

Builds the application for production.

### Backend Only

```bash
npm run server
```

Starts the Express backend.

### Frontend Only

```bash
npm run client
```

Starts the Next.js frontend.

---

## 🧪 Test Accounts

Demo auto-provisioning has been removed — accounts are no longer created automatically on first login. Create real accounts via **Sign up**, choosing the role (Citizen, Local body staff, or Ward Representative). Admin accounts are provisioned manually and can promote other users' roles from **User Management**.

---

## 🔐 Security Considerations

Civicदृष्टि handles authentication and role-based access to civic and government-related information.

The application uses:

* JWT-based authentication
* Password hashing with bcrypt
* Role-based authorization
* Admin approval for sensitive actions
* Controlled budget data modification
* Environment variables for secrets

For production deployment, additional security measures should be implemented, including:

* HTTPS
* Secure cookie/token configuration
* Rate limiting
* Input validation
* Request sanitization
* Production-grade logging
* Secure file upload validation
* Proper secret management

---

## 🎯 Project Goals

Civicदृष्टि aims to make civic information more:

**Accessible** → Citizens can easily understand public information.

**Transparent** → Government budgets and civic activities remain visible.

**Participatory** → Citizens can report and discuss local problems.

**Accountable** → Issues have a clear ownership and resolution trail.

**Data-driven** → Analytics and AI help users understand trends.

**Inclusive** → Bilingual support makes the platform more accessible across Nepal.

---

## 🇳🇵 Vision

> **To build a more transparent, accountable, and participatory Nepal through technology.**

Civicदृष्टि envisions a future where citizens can easily understand how public resources are used, report problems in their communities, identify responsible authorities, and track whether those problems are actually resolved.

---

## 👥 User Flow

```text
                    🇳🇵 Citizen
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
        💰 Explore Budget    🚨 Report Issue
              │                   │
              │                   ▼
              │              🔍 Verification
              │                   │
              │                   ▼
              │              🏢 Assignment
              │                   │
              │                   ▼
              │              ✅ Resolution
              │
              ▼
       📊 Public Transparency
              │
              └──────────────┐
                             ▼
                    🤝 Civic Participation
                             │
                             ▼
                       ⚖️ Accountability
```

---

## 📄 License

This project is developed for SEP (Software Engineering Project) 💻.

---

## 💡 Civicदृष्टि ꔪ

**See the budget. Report the problem. Track the action. Build a better Nepal.**