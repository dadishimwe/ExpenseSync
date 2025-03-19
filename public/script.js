let currentUser = null;
let staffListVisible = false;

function showLogin() {
  document.getElementById('login').style.display = 'block';
  document.getElementById('register').style.display = 'none';
  document.getElementById('password-reset').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('change-password').style.display = 'none';
}

function showRegister() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('register').style.display = 'block';
}

function showPasswordReset() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('password-reset').style.display = 'block';
}

function showDashboard() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('change-password').style.display = 'none';
}

function showChangePassword() {
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('change-password').style.display = 'block';
}

async function loadSession() {
  try {
    const res = await fetch('/session');
    const data = await res.json();
    if (!data.error) {
      currentUser = data;
      showDashboard();
      document.getElementById('user-name').textContent = currentUser.name;
      document.getElementById('user-role').textContent = currentUser.role.replace('_', ' ');
      if (currentUser.role.includes('admin')) document.getElementById('admin-section').style.display = 'block';
      if (currentUser.role === 'finance_admin') document.getElementById('finance-section').style.display = 'block';
      loadExpenses();
      if (currentUser.role.includes('admin') || currentUser.role === 'finance_admin') loadStaff();
    }
  } catch {
    showLogin();
  }
}

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  if (!username || !password) {
    document.getElementById('login-error').textContent = 'Please fill in all fields';
    return;
  }
  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.error) {
      document.getElementById('login-error').textContent = data.error;
      return;
    }
    currentUser = data;
    showDashboard();
    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('user-role').textContent = currentUser.role.replace('_', ' ');
    if (currentUser.role.includes('admin')) document.getElementById('admin-section').style.display = 'block';
    if (currentUser.role === 'finance_admin') document.getElementById('finance-section').style.display = 'block';
    loadExpenses();
    if (currentUser.role.includes('admin') || currentUser.role === 'finance_admin') loadStaff();
  } catch (err) {
    document.getElementById('login-error').textContent = 'Login failed';
  }
}

async function logout() {
  await fetch('/logout', { method: 'POST' });
  currentUser = null;
  showLogin();
  document.getElementById('admin-section').style.display = 'none';
  document.getElementById('finance-section').style.display = 'none';
}

async function register() {
  const username = document.getElementById('reg-username').value;
  const name = document.getElementById('reg-name').value;
  const password = document.getElementById('reg-password').value;
  const department = document.getElementById('department').value;
  if (!username || !name || !password || !department) {
    alert('Please fill in all fields');
    return;
  }
  try {
    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, name, password, department })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    alert('Registration successful! Please log in.');
    showLogin();
  } catch (err) {
    alert('Registration failed');
  }
}

async function resetPassword() {
  const username = document.getElementById('reset-username').value;
  const newPassword = document.getElementById('reset-new-password').value;
  if (!username || !newPassword) {
    alert('Please fill in all fields');
    return;
  }
  try {
    const res = await fetch('/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    alert('Password reset successful!');
    showLogin();
  } catch (err) {
    alert('Password reset failed');
  }
}

async function changePassword() {
  const newPassword = document.getElementById('new-password').value;
  if (!newPassword) {
    alert('Please enter a new password');
    return;
  }
  try {
    const res = await fetch('/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    });
    await res.json();
    alert('Password changed successfully!');
    showDashboard();
  } catch (err) {
    alert('Password change failed');
  }
}

async function submitExpense() {
  const date = document.getElementById('date').value;
  const reason = document.getElementById('reason').value;
  const amount = document.getElementById('amount').value;
  if (!date || !reason || !amount || amount <= 0) {
    document.getElementById('expense-error').textContent = 'Please fill in all fields with valid values';
    return;
  }
  try {
    const res = await fetch('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, reason, amount })
    });
    await res.json();
    document.getElementById('expense-form').reset();
    loadExpenses();
  } catch (err) {
    document.getElementById('expense-error').textContent = 'Failed to submit expense';
  }
}

async function createStaff() {
  const username = document.getElementById('new-staff-username').value;
  const name = document.getElementById('new-staff-name').value;
  const password = document.getElementById('new-staff-password').value;
  if (!username || !name || !password) {
    alert('Please fill in all fields');
    return;
  }
  try {
    const res = await fetch('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, name, password, department: currentUser.department })
    });
    await res.json();
    loadStaff();
  } catch (err) {
    alert('Failed to create staff');
  }
}

function toggleStaffList() {
  staffListVisible = !staffListVisible;
  const isFinanceAdmin = currentUser.role === 'finance_admin';
  const toggleBtn = document.getElementById(isFinanceAdmin ? 'toggle-finance-staff-btn' : 'toggle-staff-btn');
  toggleBtn.textContent = staffListVisible ? 'Hide Staff List' : 'Show Staff List';
  document.getElementById(isFinanceAdmin ? 'finance-staff-list' : 'staff-list').style.display = staffListVisible ? 'block' : 'none';
}

async function loadStaff() {
  try {
    const res = await fetch('/staff');
    const staff = await res.json();
    const adminTbody = document.getElementById('staff-body');
    const financeTbody = document.getElementById('finance-staff-body');
    adminTbody.innerHTML = '';
    financeTbody.innerHTML = '';
    staff.forEach(s => {
      const tr = document.createElement('tr');
      if (currentUser.role === 'finance_admin') {
        tr.innerHTML = `<td>${s.id}</td><td>${s.username}</td><td>${s.name}</td><td>${s.department}</td>`;
        financeTbody.appendChild(tr);
      } else {
        tr.innerHTML = `
          <td>${s.id}</td>
          <td>${s.username}</td>
          <td>${s.name}</td>
          <td>${s.department}</td>
          <td><button onclick="deleteStaff(${s.id})">Delete</button></td>`;
        adminTbody.appendChild(tr);
      }
    });
  } catch (err) {
    console.error('Failed to load staff:', err);
  }
}

async function deleteStaff(id) {
  if (confirm('Are you sure you want to delete this staff member?')) {
    try {
      await fetch(`/users/${id}`, { method: 'DELETE' });
      loadStaff();
    } catch (err) {
      alert('Failed to delete staff');
    }
  }
}

async function loadExpenses() {
  try {
    const res = await fetch('/expenses');
    const expenses = await res.json();
    const filter = document.getElementById('status-filter').value;
    const filtered = filter ? expenses.filter(exp => exp.status === filter) : expenses;
    const tbody = document.getElementById('expense-body');
    tbody.innerHTML = '';
    let total = 0;
    filtered.forEach(exp => {
      total += parseFloat(exp.amount);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Name">${exp.name}</td>
        <td data-label="Date">${exp.date}</td>
        <td data-label="Reason" data-full-text="${escapeHtml(exp.reason)}">${escapeHtml(exp.reason)}</td>
        <td data-label="Amount">${exp.amount}</td>
        <td data-label="Status" class="status-${exp.status.toLowerCase().replace('_', '-')}">${exp.status}</td>
        <td data-label="Timestamp">${exp.timestamp}</td>
        <td data-label="Actions">${getActionButtons(exp)}</td>`;
      tbody.appendChild(tr);
    });
    document.getElementById('total-expenses').textContent = total.toFixed(2);
  } catch (err) {
    console.error('Failed to load expenses:', err);
  }
}

function getActionButtons(exp) {
  let buttons = '';
  if (exp.status === 'Pending') {
    if (currentUser.role === 'staff' && exp.userId === currentUser.id) {
      buttons += `<button onclick="deleteExpense(${exp.id})">Delete</button>`;
    }
    if (currentUser.role.includes('admin') && !currentUser.role.includes('finance') && currentUser.department === exp.department) {
      buttons += `<button onclick="approveExpense(${exp.id})">Approve</button> `;
      buttons += `<button onclick="deleteExpense(${exp.id})">Delete</button>`;
    }
  } else if (exp.status === 'Dept_Approved') {
    if (currentUser.role === 'finance_admin') {
      buttons += `<button onclick="reimburseExpense(${exp.id})">Reimburse</button>`;
    }
  } else if (exp.status === 'Reimbursed') {
    if (currentUser.role === 'finance_admin') {
      buttons += `<button onclick="deleteExpense(${exp.id})">Delete</button>`;
    }
  }
  return buttons;
}

async function deleteExpense(id) {
  if (confirm('Are you sure you want to delete this expense request?')) {
    try {
      const res = await fetch(`/expenses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) alert(data.error);
      else loadExpenses();
    } catch (err) {
      alert('Failed to delete expense');
    }
  }
}

async function approveExpense(expenseId) {
  try {
    const res = await fetch(`/expenses/${expenseId}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else loadExpenses();
  } catch (err) {
    alert('Failed to approve expense');
  }
}

async function reimburseExpense(expenseId) {
  try {
    const res = await fetch(`/expenses/${expenseId}/reimburse`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else loadExpenses();
  } catch (err) {
    alert('Failed to reimburse expense');
  }
}

async function generateReport() {
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;
  if (!startDate || !endDate) {
    alert('Please select both start and end dates');
    return;
  }
  try {
    const res = await fetch(`/reimbursement-report?startDate=${startDate}&endDate=${endDate}`);
    const data = await res.json();
    const link = document.getElementById('download-link');
    link.href = data.file;
    link.style.display = 'block';
  } catch (err) {
    alert('Failed to generate report');
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.onload = loadSession;