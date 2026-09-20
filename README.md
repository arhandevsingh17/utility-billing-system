# Utility Meter Reading & Billing System

**PS 7 — Utilities / Public Services** · BTech CSE (AI/ML) Assignment-2

A server-rendered web application that records monthly **electricity** meter readings and generates slab-wise consumer bills, with three roles: **Admin**, **Meter Reader**, and **Consumer**.

* **Live URL:** *add your Render URL here*
* **GitHub:** *add your repository URL here*

---

## Problem Statement

Record monthly electricity meter readings and generate consumer bills.

Admins manage consumers, meters, readers and tariff slabs; meter readers record the monthly reading for each meter (a reading lower than the previous one is rejected); the system auto-generates a bill from units consumed using slab-wise rates plus a fixed charge; consumers view the current bill, mark it paid, and browse past bills and consumption history.

> **Tariff disclaimer:** All slab rates and fixed charges in this project are **configurable academic/demo values**. They are not official government or utility rates.

---

## Features

### Mandatory (PS 7)

* Register / login / logout with session-based authentication and role-based authorization
* Admin: manage consumers, meters, meter readers, and tariff slabs
* Meter Reader: enter a monthly reading per meter; readings lower than the previous one are rejected
* Automatic bill generation from units consumed using slab rates + fixed charge
* Consumer: current bill, simulated payment, past bills, and consumption history
* Dashboard: bills generated, paid vs unpaid, total units billed, and top consumers

### Recommended Additions Implemented

* Slab breakdown snapshotted onto each bill so historical bills do not change when tariffs are edited
* Lazy overdue recomputation without requiring a cron job
* Compound unique indexes for database-level duplicate prevention
* Flash messaging
* Empty states
* Centralized error handling
* Seed script for demo data

### Stretch Goals Implemented

* **Late-payment surcharge** applied automatically once a bill passes its due date
* Consumption line chart using Chart.js
* Print / save-as-PDF bill layout
* Search and filter on bill lists

---

## User Roles

| Role          | Permissions                                                                               |
| ------------- | ----------------------------------------------------------------------------------------- |
| `admin`       | Full management of consumers, meters, readers, tariffs, bills, and dashboard              |
| `meterReader` | View active meters, enter monthly readings, and trigger bill generation                   |
| `consumer`    | View own profile, current bill, bill history, consumption history, and mark bills as paid |

Public registration always creates a `consumer`. The role is assigned server-side and is not accepted from the registration form.

---

## Tech Stack

| Layer             | Technology                                           |
| ----------------- | ---------------------------------------------------- |
| Frontend          | EJS (server-side rendering) + Bootstrap 5 + Chart.js |
| Backend           | Node.js + Express.js                                 |
| Database          | MongoDB / MongoDB Atlas                              |
| ODM               | Mongoose                                             |
| Authentication    | express-session + connect-mongo                      |
| Password Security | bcryptjs                                             |
| Deployment        | Render                                               |

---

## Architecture

```text
Browser
   |
   v
Express (app.js)
   |
   |-- express.urlencoded / static / method-override
   |-- express-session
   |-- currentUser loader
   |
   v
Routes
   |
   v
Middleware
   |
   |-- isLoggedIn
   |-- hasRole
   |
   v
Controllers
   |
   v
Services / Utilities
   |
   |-- billingService.js
   |-- billCalculator.js
   |
   v
Mongoose Models
   |
   v
MongoDB
```

The application follows a server-rendered MVC-style structure. Routes handle request mapping, middleware handles authentication and authorization, controllers handle request/response flow, services contain business logic, and models handle database operations.

---

## Folder Structure

```text
utility-billing-system/

├── app.js
├── seed.js
├── package.json
├── config/
│   └── db.js
├── models/
│   ├── User.js
│   ├── Meter.js
│   ├── Reading.js
│   ├── Tariff.js
│   └── Bill.js
├── routes/
│   ├── auth.js
│   ├── admin.js
│   ├── reader.js
│   └── consumer.js
├── controllers/
│   ├── authController.js
│   ├── adminController.js
│   ├── readerController.js
│   └── consumerController.js
├── middleware/
│   ├── auth.js
│   ├── role.js
│   └── errorHandler.js
├── utils/
│   ├── billCalculator.js
│   ├── billingService.js
│   └── helpers.js
├── views/
│   ├── layouts/
│   ├── partials/
│   ├── auth/
│   ├── admin/
│   ├── reader/
│   └── consumer/
└── public/
    ├── css/
    └── js/
```

---

## Database Schema

### User

Stores authentication and consumer information.

* `name`
* `email` — unique
* `password` — bcrypt hashed
* `role`
* `consumerId`
* `address`
* `connectionType`
* `isActive`
* timestamps

### Meter

Stores meter information.

* `meterNumber` — unique
* `consumer`
* `connectionType`
* `status`
* `installationDate`
* timestamps

### Reading

Stores monthly meter readings.

* `meter`
* `consumer`
* `previousReading`
* `currentReading`
* `unitsConsumed`
* `billingMonth`
* `enteredBy`
* `readingDate`
* timestamps

Unique index:

```text
{ meter, billingMonth }
```

This prevents duplicate readings for the same meter and billing month.

### Tariff

Stores configurable tariff slabs.

* `name`
* `connectionType`
* `fixedCharge`
* `slabs`
* `isActive`
* timestamps

Each slab contains:

```text
from
to
rate
```

### Bill

Stores generated bills.

* `billNumber`
* `consumer`
* `meter`
* `reading`
* `billingMonth`
* `previousReading`
* `currentReading`
* `unitsConsumed`
* `energyCharge`
* `fixedCharge`
* `surcharge`
* `totalAmount`
* `slabBreakdown`
* `tariffName`
* `dueDate`
* `status`
* `paidAt`
* timestamps

Unique index:

```text
{ meter, billingMonth }
```

---

## Billing Algorithm

Units consumed are calculated as:

```text
unitsConsumed = currentReading - previousReading
```

A reading lower than the previous reading is rejected.

The billing calculation processes tariff slabs from lowest to highest:

```text
for each slab:

    capacity = slab.to - slab.from
                or unlimited if to is null

    unitsInSlab = minimum(remaining units, capacity)

    energyCharge += unitsInSlab × slab.rate

    remaining -= unitsInSlab
```

Finally:

```text
totalAmount = energyCharge + fixedCharge + surcharge
```

### Example

For 150 units on the demo domestic tariff:

| Slab              | Units | Rate |   Amount |
| ----------------- | ----: | ---: | -------: |
| 0–100             |   100 |   ₹3 |     ₹300 |
| 100–200           |    50 |   ₹5 |     ₹250 |
| **Energy charge** |       |      | **₹550** |
| Fixed charge      |       |      |      ₹50 |
| **Total**         |       |      | **₹600** |

The application stores slabs internally using boundaries such as:

```text
0 → 100
100 → 200
200 → 500
500 → unlimited
```

This allows the billing calculation to use slab widths directly and avoids off-by-one errors.

---

## Testing the Billing Algorithm

The billing calculator can be tested without connecting to MongoDB:

```bash
npm run test:billing
```

The test suite covers:

* Zero units
* Slab boundaries
* 150 units
* 200 units
* 350 units
* 600 units
* Negative units
* Missing tariff slabs

---

## Installation

Clone the repository:

```bash
git clone <your-repo-url>
cd utility-billing-system
```

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Configure the required environment variables.

For local MongoDB:

```env
MONGO_URI=mongodb://127.0.0.1:27017/utility_billing
```

Seed demo data:

```bash
npm run seed
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Environment Variables

| Variable         | Purpose                                                       |
| ---------------- | ------------------------------------------------------------- |
| `PORT`           | Server port. Render provides this automatically in production |
| `NODE_ENV`       | `development` or `production`                                 |
| `APP_NAME`       | Application display name                                      |
| `MONGO_URI`      | MongoDB connection string                                     |
| `SESSION_SECRET` | Secret used to sign session cookies                           |
| `ADMIN_EMAIL`    | Admin email used by the seed script                           |
| `ADMIN_PASSWORD` | Admin password used by the seed script                        |
| `DUE_DAYS`       | Optional. Number of days until a bill is due. Default: 15     |
| `SURCHARGE_RATE` | Optional. Late-payment surcharge rate. Default: 0.02          |

The `.env` file is excluded from Git using `.gitignore`.

**Never commit real credentials, passwords, API keys, or database connection strings to GitHub.**

---

## Demo Accounts

Demo accounts are created by the seed script for local testing.

Run:

```bash
npm run seed
```

The seed script contains the demo account configuration.

Do not use demo credentials as production credentials.

---

## Security

The application includes:

* bcrypt password hashing
* Session-based authentication
* MongoDB-backed session storage
* Session regeneration during login
* `httpOnly` cookies
* `sameSite=lax` cookies
* Secure cookies in production
* Database-based role authorization
* Server-side role assignment during public registration
* Consumer ownership checks
* Backend request validation
* Mongoose schema validation
* Unique database indexes
* Environment variables for secrets
* `.env` excluded from Git

Consumer queries are scoped to the authenticated consumer, preventing one consumer from accessing another consumer's bills or readings.

---

## Error Handling and Validation

The application performs validation on the server.

Examples include:

* Invalid login credentials
* Invalid registration data
* Unauthorized role access
* Invalid meter readings
* Lower-than-previous meter readings
* Duplicate monthly readings
* Duplicate monthly bills
* Invalid bill/payment operations
* Invalid or missing database records

The application also provides user-facing flash messages for important actions and errors.

---

## Deployment

The production version is intended to use:

```text
Render
   ↓
Node.js + Express
   ↓
MongoDB Atlas
```

Before deployment:

1. Create a MongoDB Atlas database.
2. Create the required database user.
3. Configure network access.
4. Push the project to GitHub.
5. Create a Render Web Service.
6. Configure production environment variables.
7. Deploy the application.
8. Run the seed script if demo data is required.

Production `MONGO_URI` should point to MongoDB Atlas rather than the local MongoDB server.

---

## Live Application

**Live URL:** *add Render URL after deployment*

**GitHub Repository:** *add GitHub repository URL*

---

## Screenshots

The final submission should include screenshots of the working application, such as:

* Landing page
* Login page
* Admin dashboard
* Consumer management
* Meter management
* Tariff configuration
* Meter reading entry
* Rejected lower reading
* Consumer bill
* Bill history
* Consumption history / chart

---

## Future Improvements

Possible future improvements include:

* Email/SMS bill notifications
* Real payment gateway integration
* Reader-to-meter route assignment
* Bulk reading upload using CSV
* Admin analytics by locality
* More detailed reporting
* Automated bill notifications
* Production-grade payment processing

---

## Academic Note

This project is developed as part of **BTech CSE (AI/ML) Assignment-2 — PS 7: Utility Meter Reading & Billing System**.

The tariff values, fixed charges, demo users, and other sample data are intended for academic demonstration and do not represent official electricity utility rates.
