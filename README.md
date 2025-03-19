# ExpenseSync
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v12+-green)](https://nodejs.org/)

A lightweight expense tracking system for small teams, built with Node.js, SQLite, and a simple web interface. Staff can submit expenses, admins can manage reimbursements, and weekly reports can be generated—all hosted on a local server (e.g., Raspberry Pi).

## Features
- **Staff Dashboard**: Submit expenses (date, reason, amount) and track pending/reimbursed status.
- **Admin Controls**: Approve reimbursements, delete entries, and generate weekly reports.
- **Local Hosting**: Runs on a Raspberry Pi or any Node.js environment.
- **Testing Ready**: Includes sample data and easy setup.

## Installation
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/[your-username]/ExpenseSync.git
   cd ExpenseSync

2. **Install Dependencies**:
   ```bash
   npm install express sqlite3 body-parser bcrypt express-session dotenv

3. **Start the Server**:
   ```bash
   cd server
   node server.js

4. **Access**:
   http://localhost:8080

5. **Deployment**:
   ```bash
   npm install -g pm2
   pm2 start server/server.js
   pm2 save
   pm2 startup
