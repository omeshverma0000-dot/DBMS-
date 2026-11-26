<<<<<<< HEAD
# DBMS-
=======
# SmartPark - Smart Parking Management System (DBMS Project)

Full-stack project: **HTML/CSS/JS frontend + Node.js/Express backend + MySQL database**.

## Structure
```
smartpark-fullstack/
  public/index.html   frontend (dashboard, entry, billing, records, schema)
  server.js           backend REST API (Express + mysql2)
  config.js           MySQL host / user / password
  schema.sql          database: tables, keys, slot data, sample queries
  package.json        dependencies
```

## Setup (one time)
1. Install **Node.js** (nodejs.org, LTS) and **MySQL** (or XAMPP / MySQL Installer).
2. Create the database:  `mysql -u root -p < schema.sql`
3. Open `config.js` and put your MySQL password.
4. In this folder run:  `npm install`

## Run
```
npm start
```
Open **http://localhost:3000** in your browser. (Do not open index.html directly.)
On first start the server adds demo vehicles; the Reset button on the Records page restores them.

## REST API
| Method | URL | What it does (SQL) |
|---|---|---|
| GET  | /api/state | SELECT slots, tickets, rates |
| POST | /api/park  | transaction: INSERT ticket + UPDATE slot to OCCUPIED |
| POST | /api/pay   | transaction: UPDATE ticket (fee via JOIN rate_card) + UPDATE slot to FREE |
| POST | /api/reset | DELETE tickets, reseed demo data |

Fee = max(1, ceil(minutes/60)) x rate_per_hour (Bike 10, Car 30, EV 40).

## Troubleshooting
- "Cannot use MySQL": MySQL not running, wrong password in config.js, or schema.sql not run.
- "ER_NOT_SUPPORTED_AUTH_MODE" / auth error on MySQL 8: run
  `ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';`
- Port busy: set another port, e.g. `PORT=4000 npm start`.
>>>>>>> 9447f5b (Initial Smartpark project Upload)
