# Utility Meter Reading & Billing System

**PS 7 — Utilities / Public Services** · BTech CSE (AI/ML) Assignment-2

A server-rendered web application that records monthly **electricity** meter readings and generates slab-wise consumer bills, with three roles: **Admin**, **Meter Reader** and **Consumer**.

- **Live URL:** https://utility-billing-system.onrender.com
- **GitHub:** https://github.com/arhandevsingh17/utility-billing-system

---

## Problem statement

Record monthly electricity meter readings and generate consumer bills.

Admins manage consumers, meters, readers and tariff slabs; meter readers record the monthly reading for each meter (a reading lower than the previous one is rejected); the system auto-generates a bill from units consumed using slab-wise rates plus a fixed charge; consumers view the current bill, mark it paid, and browse past bills and consumption history.

> **Tariff disclaimer.** All slab rates and fixed charges in this project are **configurable academic/demo values**. They are not official government or utility rates.

---

## Features

### Mandatory (PS 7)

- Register / login / logout with session-based authentication and role-based authorisation
- Admin: manage consumers, meters, meter readers, tariff slabs
- Meter Reader: enter a monthly reading per meter; readings lower than the previous one are rejected
- Automatic bill generation from units consumed using slab rates + fixed charge
- Consumer: current bill, simulated payment, past bills, consumption history
- Dashboard: bills generated, paid vs unpaid, total units billed, top consumers

### Recommended additions implemented

- Slab breakdown snapshotted onto each bill so historical bills do not change when a tariff is edited
- Lazy overdue recomputation on read (no cron job required)
- Compound unique indexes for database-level duplicate prevention
- Flash messaging, empty states, centralised error handling and seed script

### Stretch goals implemented

- **Late-payment surcharge** applied automatically once a bill passes its due date
- Consumption line chart (Chart.js)
- Print / save-as-PDF bill layout
- Search and filter on bills lists

---

## User roles

| Role          | Can do                                                                     |
| ------------- | -------------------------------------------------------------------------- |
| `admin`       | Full management: consumers, meters, readers, tariffs, all bills, dashboard |
| `meterReader` | View active meters, enter monthly readings, trigger bill generation        |
| `consumer`    | View own profile, current bill, bill history, consumption, mark bills paid |

Public registration **always** creates a `consumer`. The role is hard-coded server-side and `req.body.role` is never read.

---

## Tech stack

| Layer      | Technology                                           |
| ---------- | ---------------------------------------------------- |
| Frontend   | EJS (server-side rendering) + Bootstrap 5 + Chart.js |
| Backend    | Node.js + Express.js                                 |
| Database   | MongoDB Atlas                                        |
| ODM        | Mongoose                                             |
| Auth       | express-session + connect-mongo + bcryptjs           |
| Deployment | Render                                               |

---

## Architecture

```text
Browser
  |
Express (app.js)
  |-- express.urlencoded / static / method-override
  |-- express-session (cookie <-> MongoDB session store)
  |-- currentUser loader
  v
Routes -> Middleware (isLoggedIn, hasRole) -> Controllers
                                                |
                                  Services: billingService.js
                                            billCalculator.js
                                                |
                                          Mongoose models
                                                |
                                           MongoDB Atlas
```

---

## Folder structure

```text
utility-billing-system/
├── app.js                  Express configuration
├── seed.js                 Demo data
├── config/db.js            MongoDB connection
├── models/                 User, Meter, Reading, Tariff, Bill
├── routes/                 auth, admin, reader, consumer
├── controllers/            auth, admin, reader, consumer
├── middleware/             auth, role, errorHandler
├── utils/                  billCalculator, billingService, helpers
├── views/                  EJS layouts, partials and role-based pages
└── public/                 CSS and JavaScript
```

---

## Database schema

### User

Name, email, bcrypt password hash, role, consumer ID, address, connection type, active status and timestamps.

### Meter

Meter number, consumer reference, connection type, status and installation date.

### Reading

Meter, consumer, previous reading, current reading, units consumed, billing month, entering user and reading date.

**Unique index:** `{ meter: 1, billingMonth: 1 }`

### Tariff

Tariff name, connection type, fixed charge, configurable slabs and active status.

### Bill

Bill number, consumer, meter, reading, billing month, previous/current readings, units consumed, energy charge, fixed charge, surcharge, total amount, slab breakdown, tariff snapshot, due date and payment status.

**Unique index:** `{ meter: 1, billingMonth: 1 }`

---

## Billing algorithm

```text
unitsConsumed = currentReading - previousReading
                (rejected if current < previous)

for each slab, lowest first:
    capacity    = slab.to - slab.from
                  (to = null -> unbounded)
    unitsInSlab = min(remaining, capacity)
    energyCharge += unitsInSlab * slab.rate
    remaining    -= unitsInSlab

totalAmount = energyCharge + fixedCharge + surcharge
```

### Example

For 150 units on the demo domestic tariff:

| Slab              | Units | Rate |   Amount |
| ----------------- | ----: | ---: | -------: |
| 0–100             |   100 |   ₹3 |     ₹300 |
| 101–200           |    50 |   ₹5 |     ₹250 |
| **Energy charge** |       |      | **₹550** |
| Fixed charge      |       |      |      ₹50 |
| **Total**         |       |      | **₹600** |

Slabs are stored using half-open boundaries (`0→100`, `100→200`) so slab width is `to − from`. They are converted to human-readable ranges for display.

### Billing tests

The billing calculator has a standalone test suite that does not require a database:

```bash
npm run test:billing
```

Expected result:

```text
13 passed, 0 failed
```

---

## Installation

```bash
git clone https://github.com/arhandevsingh17/utility-billing-system.git
cd utility-billing-system
npm install
cp .env.example .env
```

Edit `.env` with your local MongoDB / Atlas connection details, then:

```bash
npm run seed
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Environment variables

| Variable                         | Purpose                                         |
| -------------------------------- | ----------------------------------------------- |
| `PORT`                           | Server port; Render supplies this automatically |
| `NODE_ENV`                       | `development` or `production`                   |
| `APP_NAME`                       | Application display name                        |
| `MONGO_URI`                      | MongoDB Atlas connection string                 |
| `SESSION_SECRET`                 | Secret used to sign session cookies             |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded admin account                            |
| `DUE_DAYS`                       | Optional; default 15                            |
| `SURCHARGE_RATE`                 | Optional; default 0.02                          |

`.env` is git-ignored and must never be committed.

---

## Deployment

The application is deployed as a Render Web Service connected to the GitHub `main` branch.

### Render configuration

```text
Build Command: npm install
Start Command: node app.js
```

### Production environment

```text
NODE_ENV=production
APP_NAME=Utility Billing System
MONGO_URI=<MongoDB Atlas connection string>
SESSION_SECRET=<long random secret>
ADMIN_EMAIL=admin@ubs.test
ADMIN_PASSWORD=Admin@123
```

`PORT` is not manually configured because Render provides the service port.

### Live deployment

**https://utility-billing-system.onrender.com**

MongoDB Atlas is used as the production database.

---

## Demo credentials

These are **fake academic/demo credentials** seeded by `seed.js`.

| Role                  | Email                 | Password       |
| --------------------- | --------------------- | -------------- |
| Admin                 | `admin@ubs.test`      | `Admin@123`    |
| Meter Reader          | `reader@ubs.test`     | `Reader@123`   |
| Consumer (domestic)   | `asha@ubs.test`       | `Consumer@123` |
| Consumer (commercial) | `brightmart@ubs.test` | `Consumer@123` |

---

## Screenshots

Add screenshots of:

- Landing page
- Admin dashboard
- Consumer management
- Meter management
- Tariff configuration
- Meter reading entry
- Rejected lower reading
- Consumer current bill
- Bill history
- Consumption history / chart

---

## Security

- Passwords are hashed using bcrypt.
- Session authentication uses a MongoDB-backed session store.
- Session IDs are regenerated during login.
- Production cookies use `httpOnly`, `sameSite=lax` and `secure`.
- Roles are read server-side rather than trusted from request input.
- Consumer queries are scoped to the authenticated consumer.
- Backend validation is reinforced by Mongoose validation and MongoDB unique indexes.
- Secrets and credentials are stored in environment variables and excluded from Git.

---

## Testing

### Billing unit tests

```bash
npm run test:billing
```

### Manual functional flows tested

- Admin login
- Meter Reader login
- Consumer login
- Current bill display
- Mark bill paid
- Bill history
- Consumption history
- Admin dashboard
- Consumer management
- Meter management
- Meter reading entry
- Lower reading rejection
- Duplicate monthly reading rejection

---

## Future improvements

- Email / SMS bill notifications
- Real payment gateway integration
- Reader-to-meter route assignment
- Bulk reading upload via CSV
- Advanced analytics by locality
- Automated integration / end-to-end tests
