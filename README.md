# Kumon Center Management System

The Kumon Center Management System is a web-based platform designed to centralize and streamline the operations of a Kumon education center.

It supports core workflows including student management, academic tracking, class scheduling, CRM, and financial operations, all aligned with real-world Kumon business logic such as subject-based enrollments and learning progression.

With a modular architecture and role-based access control, the system ensures secure, efficient, and scalable management across multiple roles including administrators, teachers, assistants, and consultants.


## Tech Stack
This system is built using a modern full-stack architecture with Next.js, combining both frontend and backend within a unified codebase. It is designed for scalability, maintainability, and real-world operational usage.

**Frontend:** Next.js (App Router), Tailwind CSS, Radix UI, Recharts

**Backend:** Next.js Route Handlers, 

**Database:** PostgreSQL, Prisma ORM
## Deployment

The system is containerized using Docker and orchestrated via Docker Compose. It is exposed to the internet securely using Cloudflare Tunnel without requiring a public IP or reverse proxy.

- Install Cloudflared from [here](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/).

```bash
  cloudflared --version
```

This command will open a browser where you will be prompted to log in to your Cloudflare account and select your domain (e.g. `ptn2026.id.vn`). Once authenticated, the credentials will be stored locally in the `~/.cloudflared/` directory. On Windows systems, this directory is typically located at `C:\Users\User\.cloudflared`.

- Authenticate with Cloudflare:

```bash
  cloudflared tunnel login
```

- Create a new tunnel:

```bash
  cloudflared tunnel create kumon
```

- Create a configuration file at `~/.cloudflared/config.yml` and define the tunnel settings as follows:

```yaml
tunnel: kumon
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  - hostname: kumon.ptn2026.id.vn
    service: http://app:3001
  - service: http_status:404
```

- Create DNS record:

```bash
  cloudflared tunnel route dns kumon kumon.ptn2026.id.vn
```

- Run services:

```bash
  docker compose up -d --build
```
## Features

### 🔐 Authentication & Session Management
- Secure authentication using username/password
- HTTP-only session cookie (`kumon_auth`) for enhanced security
- Configurable session expiration (default: 24 hours)
- Password management (change password, logout)
- Centralized middleware for role-based access control (RBAC) across both page routes and API endpoints

### 📊 Dashboard & Analytics
- Monthly KPIs:
  - Active enrolled students (by subject)
  - Trial students
  - Consulting leads
  - Monthly revenue
- Advanced comparison charts:
  - Month-over-month within a year
  - Year-over-year comparison for a selected month
- Subject distribution tracking (Math vs EFL)
- Financial overview:
  - Total income vs expenses
  - Latest revenue
  - Current month expenses
- Accurate enrollment tracking with support for `reenrollDate` to reflect returning students

### 👨‍🎓 Student Management
- Full CRUD operations for student profiles
- Comprehensive student data:
  - Personal information
  - Parent/guardian details
  - Learning status
- Enrollment milestones tracking (start date, Report B, etc.)
- Staff assignment for student responsibility
- Aggregated student data including:
  - Enrollments
  - Class assignments
  - Latest certificates
- Automated notification generation for new student onboarding

### 📝 Enrollment Management
- Subject-based enrollment management
- Support for enrollment types:
  - Official enrollment
  - Trial enrollment
- Flexible study frequency:
  - Twice per week
  - Daily attendance
- Timeline tracking:
  - Start date
  - Report B date
  - End date
  - Re-enrollment date
- Class session mapping aligned with Kumon scheduling structure

### 🏫 Class Management
- Class grouping by subject, day, and time slot
- Teacher assignment per class
- Student listing per class (based on enrollments)
- Attendance tracking system
- Extra class (make-up session) management via dedicated scheduling
- Recent attendance history tracking

### 📚 Academic Management
- Subject-based academic profiles for each student
- Assessment Record management:
  - Scores
  - Completion time
  - Group tests
- Individual learning schedule tracking
- Worksheet inventory system:
  - Batch imports
  - Usage tracking
  - Stock management (in/out logic)
- Aggregated attendance data for academic monitoring

### 📈 CRM & Consulting
- Lead management with pipeline status tracking
- Lead source tracking
- Consulting appointment scheduling
- Lead-to-student conversion workflow
- Basic interaction history tracking

### 💰 Financial Management
- Income and expense tracking with categorization
- Tuition fee and enrollment fee management
- Operational cost tracking
- Salary management:
  - Full-time and part-time staff
- Metadata parsing from notes to trigger business notifications (e.g., tuition collection, salary payment)
- Financial data aggregation for dashboard analytics

### 🏆 Certificate Generation
- Generate certificates in DOCX format from templates
- Convert DOCX to PDF using headless LibreOffice
- Certificate preview and download
- Certificate history tracking
- Automatic level progression update upon certificate issuance

### 👥 System & Staff Management
- Staff CRUD management
- Role management:
  - Admin
  - Teacher
  - Assistant
  - Consultant
- Contract type management:
  - Full-time
  - Part-time
- Salary configuration (monthly/hourly)
- Leave and holiday management
- Time tracking (time entries)

### 🔔 Internal Notifications
- Event-driven notification system
- Role-based notification targeting
- Read/unread status tracking
- Consulting appointment reminders
- Pre-class attendance reminders

### 🔐 Role-Based Access Control (RBAC)

The system enforces strict access control using role-based permissions stored in session:

- Admin
- Teacher
- Assistant
- Consultant


## Used By

This project is actively used in production by Kumon Gia Hoa Center (Ho Chi Minh City, Vietnam) and is accessible at:
https://kumon.ptn2026.id.vn


## Documentation

Detailed system and Kumon methodology documentation is available at:

👉 [View full documentation](https://docs.google.com/document/d/1O-EmcQtSucFqCpvURUJxH5rRqdrps-CK/edit?usp=sharing&ouid=117902199911993826473&rtpof=true&sd=true)
