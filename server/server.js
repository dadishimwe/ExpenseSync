const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv');
const fs = require('fs');
const bcrypt = require('bcrypt');

dotenv.config();
const app = express();
const db = new sqlite3.Database(path.join(__dirname, '../database.db'));

app.use(express.static(path.join(__dirname, '../public')));
app.use(bodyParser.json());

const sessionSecret = process.env.SESSION_SECRET || 'default_secret_please_change_me';
if (!process.env.SESSION_SECRET) console.warn('Warning: SESSION_SECRET not set in .env file. Using default secret.');
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 60 * 1000 } // 30-minute session timeout
}));

const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) { if (err) reject(err); else resolve(this); });
});

const getAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
});

const allAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
});

async function initializeDatabase() {
  try {
    await runAsync(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      name TEXT,
      password TEXT,
      role TEXT DEFAULT 'staff',
      department TEXT CHECK(department IN ('Tech', 'Sales'))
    )`);
    await runAsync(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      date TEXT,
      reason TEXT,
      amount REAL,
      status TEXT DEFAULT 'Pending',
      timestamp TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    )`);
    await runAsync(`CREATE INDEX IF NOT EXISTS idx_expenses_userId ON expenses(userId)`);
    await runAsync(`CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status)`);

    const hashedPasswords = await Promise.all([
      bcrypt.hash('techpass', 10),
      bcrypt.hash('salespass', 10),
      bcrypt.hash('financepass', 10),
      bcrypt.hash('staffpass', 10),
      bcrypt.hash('staffpass', 10)
    ]);
    await runAsync(`INSERT OR IGNORE INTO users (username, name, password, role, department) VALUES 
      ('techadmin', 'Tech Admin', ?, 'tech_admin', 'Tech'),
      ('salesadmin', 'Sales Admin', ?, 'sales_admin', 'Sales'),
      ('financeadmin', 'Finance Admin', ?, 'finance_admin', NULL),
      ('techstaff1', 'John Doe', ?, 'staff', 'Tech'),
      ('salesstaff1', 'Jane Smith', ?, 'staff', 'Sales')`, hashedPasswords);
    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Database initialization error:", err);
  }
}

initializeDatabase().then(() => {
  const requireAuth = (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    next();
  };

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  app.get('/session', (req, res) => {
    if (req.session.user) res.json(req.session.user);
    else res.status(401).json({ error: 'Not logged in' });
  });

  app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const row = await getAsync(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!row || !(await bcrypt.compare(password, row.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.user = { id: row.id, username: row.username, name: row.name, role: row.role, department: row.department };
    res.json(req.session.user);
  });

  app.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ message: 'Logged out' }));
  });

  app.post('/register', async (req, res) => {
    const { username, name, password, department } = req.body;
    if (!['Tech', 'Sales'].includes(department)) return res.status(400).json({ error: 'Invalid department' });
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (username, name, password, role, department) VALUES (?, ?, ?, 'staff', ?)`, 
      [username, name, hashedPassword, department], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
      });
  });

  app.post('/users', requireAuth, async (req, res) => {
    const { username, name, password, department } = req.body;
    if (!req.session.user.role.includes('admin') || (req.session.user.department && req.session.user.department !== department)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (username, name, password, role, department) VALUES (?, ?, ?, 'staff', ?)`, 
      [username, name, hashedPassword, department], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
      });
  });

  app.delete('/users/:id', requireAuth, (req, res) => {
    const userId = req.params.id;
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, row) => {
      if (err || !row || row.role !== 'staff' || 
          (req.session.user.department && req.session.user.department !== row.department)) {
        return res.status(403).json({ error: 'Unauthorized or invalid user' });
      }
      db.run(`DELETE FROM users WHERE id = ?`, [userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
      });
    });
  });

  app.put('/password', requireAuth, async (req, res) => {
    const { newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.run(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, req.session.user.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ changes: this.changes });
    });
  });

  app.post('/expenses', requireAuth, (req, res) => {
    const { date, reason, amount } = req.body;
    db.run(`INSERT INTO expenses (userId, date, reason, amount, status, timestamp) VALUES (?, ?, ?, ?, 'Pending', datetime('now'))`, 
      [req.session.user.id, date, reason, amount], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
      });
  });

  app.get('/expenses', requireAuth, (req, res) => {
    const { user } = req.session;
    let query, params;
    if (user.role === 'finance_admin') {
      query = `SELECT e.*, u.username, u.name, u.department FROM expenses e JOIN users u ON e.userId = u.id`;
      params = [];
    } else if (user.role.includes('admin')) {
      query = `SELECT e.*, u.username, u.name, u.department FROM expenses e JOIN users u ON e.userId = u.id WHERE u.department = ?`;
      params = [user.department];
    } else {
      query = `SELECT e.*, u.username, u.name, u.department FROM expenses e JOIN users u ON e.userId = u.id WHERE e.userId = ?`;
      params = [user.id];
    }
    db.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  app.delete('/expenses/:id', requireAuth, (req, res) => {
    const { user } = req.session;
    const expenseId = req.params.id;
    db.get(`SELECT e.*, u.department FROM expenses e JOIN users u ON e.userId = u.id WHERE e.id = ?`, [expenseId], (err, row) => {
      if (err || !row) return res.status(404).json({ error: 'Expense not found' });
      if (user.role === 'staff' && row.userId === user.id && row.status !== 'Pending') {
        return res.status(403).json({ error: 'Staff can only delete Pending requests' });
      }
      if (user.role.includes('admin') && !user.role.includes('finance') && user.department === row.department && row.status === 'Reimbursed') {
        return res.status(403).json({ error: 'Department admins cannot delete Reimbursed requests' });
      }
      if (user.role === 'finance_admin' && row.status !== 'Reimbursed') {
        return res.status(403).json({ error: 'Finance admin can only delete Reimbursed requests' });
      }
      if (user.role === 'staff' && row.userId !== user.id) return res.status(403).json({ error: 'Unauthorized: You can only delete your own requests' });
      if (user.role.includes('admin') && !user.role.includes('finance') && user.department !== row.department) {
        return res.status(403).json({ error: 'Unauthorized: Wrong department' });
      }
      db.run(`DELETE FROM expenses WHERE id = ?`, [expenseId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
      });
    });
  });

  app.put('/expenses/:id/approve', requireAuth, (req, res) => {
    const { user } = req.session;
    if (!user.role.includes('admin') || user.role === 'finance_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    db.get(`SELECT e.*, u.department FROM expenses e JOIN users u ON e.userId = u.id WHERE e.id = ?`, [req.params.id], (err, row) => {
      if (err || !row) return res.status(404).json({ error: 'Expense not found' });
      if (user.department !== row.department) return res.status(403).json({ error: 'Unauthorized: Wrong department' });
      if (row.status !== 'Pending') return res.status(400).json({ error: 'Can only approve Pending requests' });
      db.run(`UPDATE expenses SET status = 'Dept_Approved' WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
      });
    });
  });

  app.put('/expenses/:id/reimburse', requireAuth, (req, res) => {
    const { user } = req.session;
    if (user.role !== 'finance_admin') return res.status(403).json({ error: 'Unauthorized' });
    db.get(`SELECT * FROM expenses WHERE id = ?`, [req.params.id], (err, row) => {
      if (err || !row) return res.status(404).json({ error: 'Expense not found' });
      if (row.status !== 'Dept_Approved') return res.status(400).json({ error: 'Can only reimburse Dept_Approved requests' });
      db.run(`UPDATE expenses SET status = 'Reimbursed' WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
      });
    });
  });

  app.get('/staff', requireAuth, (req, res) => {
    const { user } = req.session;
    let query, params;
    if (user.role === 'finance_admin') {
      query = `SELECT id, username, name, role, department FROM users WHERE role = 'staff'`;
      params = [];
    } else if (user.role.includes('admin')) {
      query = `SELECT id, username, name, role, department FROM users WHERE role = 'staff' AND department = ?`;
      params = [user.department];
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    db.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  app.get('/reimbursement-report', requireAuth, (req, res) => {
    if (req.session.user.role !== 'finance_admin') return res.status(403).json({ error: 'Unauthorized' });
    const { startDate, endDate } = req.query;
    db.all(`SELECT e.*, u.username, u.name, u.department FROM expenses e 
            JOIN users u ON e.userId = u.id 
            WHERE e.date BETWEEN ? AND ?`, 
      [startDate, endDate], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const csv = [
          'ID,Username,Name,Department,Date,Reason,Amount,Status,Timestamp',
          ...rows.map(row => `${row.id},${row.username},${row.name},${row.department},${row.date},${row.reason},${row.amount},${row.status},${row.timestamp}`)
        ].join('\n');
        const filePath = path.join(__dirname, '../public/reimbursement_report.csv');
        fs.writeFile(filePath, csv, (err) => {
          if (err) return res.status(500).json({ error: 'Failed to write CSV' });
          res.json({ file: '/reimbursement_report.csv' });
        });
      });
  });

  app.listen(8080, () => console.log('Server running on http://localhost:8080'));
}).catch(err => {
  console.error("Failed to initialize server:", err);
  process.exit(1);
});