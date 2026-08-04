let goals = [];
let currentGoalId = null;
let currentSuggestedAmounts = { create: null, edit: null };

const formatCurrency = (val) => "₱" + Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function init() {
  const todayStr = new Date().toISOString().split("T")[0];
  document.getElementById("create-start").value = todayStr;
  
  const defaultEnd = new Date();
  defaultEnd.setMonth(defaultEnd.getMonth() + 6);
  document.getElementById("create-end").value = defaultEnd.toISOString().split("T")[0];

  updateTopAnalytics();
  renderGoalSelector();
  renderActiveGoal();
  updateSuggestion('create');
}

function updateTopAnalytics() {
  let totalTarget = 0;
  let totalSaved = 0;

  goals.forEach(goal => {
    totalTarget += goal.target;
    totalSaved += goal.saved;
  });

  const totalRemaining = Math.max(0, totalTarget - totalSaved);
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  document.getElementById("stat-total-saved").innerText = formatCurrency(totalSaved);
  document.getElementById("stat-total-target").innerText = formatCurrency(totalTarget);
  document.getElementById("stat-total-remaining").innerText = formatCurrency(totalRemaining);
  document.getElementById("stat-overall-progress").innerText = `${overallPct}%`;
}

function renderGoalSelector() {
  const select = document.getElementById("goal-selector");
  select.innerHTML = "";

  if (goals.length === 0) {
    select.innerHTML = `<option value="">No Accounts Available</option>`;
    select.disabled = true;
    return;
  }

  select.disabled = false;
  goals.forEach(goal => {
    const option = document.createElement("option");
    option.value = goal.id;
    const statusLabel = goal.saved >= goal.target ? " [Accomplished]" : "";
    option.textContent = `${goal.name}${statusLabel}`;
    if (goal.id === currentGoalId) option.selected = true;
    select.appendChild(option);
  });
}

function switchGoal() {
  const select = document.getElementById("goal-selector");
  currentGoalId = select.value;
  hideEditForm();
  renderActiveGoal();
}

function calculateDaysLeft(endDateStr) {
  if (!endDateStr || endDateStr.trim() === "") return "Endless Goal";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr + "T00:00:00");
  const diffTime = end - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due Today";
  return `${diffDays} Days`;
}

function renderActiveGoal() {
  const emptyState = document.getElementById("empty-dashboard");
  const content = document.getElementById("active-dashboard-content");

  const goal = goals.find(g => g.id === currentGoalId);

  if (!goal) {
    emptyState.classList.remove("hidden");
    content.classList.add("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  content.classList.remove("hidden");

  const remaining = Math.max(0, goal.target - goal.saved);
  const isAccomplished = goal.saved >= goal.target;
  const progressPct = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;

  document.getElementById("display-goal-name").innerText = goal.name;
  
  const descEl = document.getElementById("display-description");
  if (goal.description && goal.description.trim() !== "") {
    descEl.innerText = goal.description;
    descEl.style.display = "block";
  } else {
    descEl.style.display = "none";
  }

  document.getElementById("display-target").innerText = formatCurrency(goal.target);
  document.getElementById("display-saved").innerText = formatCurrency(goal.saved);
  document.getElementById("display-remaining").innerText = formatCurrency(remaining);
  document.getElementById("display-days-left").innerText = isAccomplished ? "Completed" : calculateDaysLeft(goal.endDate);
  document.getElementById("current-transaction-input").value = goal.depositAmount;

  document.getElementById("display-progress-pct").innerText = `${progressPct}%`;
  document.getElementById("display-progress-bar").style.width = `${progressPct}%`;

  // Status Badge Toggle
  const statusBadge = document.getElementById("display-status-badge");
  if (isAccomplished) {
    statusBadge.classList.remove("hidden");
    statusBadge.className = "badge badge-completed";
    statusBadge.innerText = "Accomplished & Closed";
    
    // Hide transaction box, show banner
    document.getElementById("active-transaction-box").classList.add("hidden");
    document.getElementById("accomplished-banner-box").classList.remove("hidden");
  } else {
    statusBadge.classList.add("hidden");
    document.getElementById("active-transaction-box").classList.remove("hidden");
    document.getElementById("accomplished-banner-box").classList.add("hidden");
  }

  let badgeText = "Everyday";
  if (goal.intervalType === "weekly") badgeText = "Per Week";
  if (goal.intervalType === "monthly") badgeText = "Monthly";
  if (goal.intervalType === "custom") badgeText = `Every ${goal.customDays} Days`;
  document.getElementById("display-interval-badge").innerText = badgeText;
  
  const endDisplay = (!goal.endDate || goal.endDate.trim() === "") ? "Endless" : goal.endDate;
  document.getElementById("display-date-range").innerText = `Start: ${goal.startDate} | End: ${endDisplay}`;

  renderHistoryTable();
  renderAnalyticsSummary();
}

function getWeekLabel(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `Week ${weekNumber}, ${date.getFullYear()}`;
}

function getMonthLabel(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: 'long', year: 'numeric' });
}

function renderAnalyticsSummary() {
  const goal = goals.find(g => g.id === currentGoalId);
  const summaryBody = document.getElementById("display-summary-rows");
  const periodType = document.getElementById("summary-period-selector").value;
  summaryBody.innerHTML = "";

  if (!goal || goal.history.length === 0) {
    summaryBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No transaction analytics available yet.</td></tr>`;
    return;
  }

  const groups = {};

  goal.history.forEach(item => {
    const key = periodType === "monthly" ? getMonthLabel(item.dateOnly) : getWeekLabel(item.dateOnly);
    if (!groups[key]) {
      groups[key] = { deposited: 0, withdrawn: 0, net: 0, count: 0 };
    }
    if (item.type === "deposit") {
      groups[key].deposited += item.amount;
      groups[key].net += item.amount;
    } else {
      groups[key].withdrawn += item.amount;
      groups[key].net -= item.amount;
    }
    groups[key].count += 1;
  });

  Object.keys(groups).forEach(periodKey => {
    const data = groups[periodKey];
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 600;">${periodKey}</td>
      <td style="color: var(--success); font-weight: 600;">${formatCurrency(data.deposited)}</td>
      <td style="color: var(--danger); font-weight: 600;">${data.withdrawn > 0 ? "-" + formatCurrency(data.withdrawn) : formatCurrency(0)}</td>
      <td style="font-weight: 700;">${formatCurrency(data.net)}</td>
      <td>${data.count}</td>
    `;
    summaryBody.appendChild(row);
  });
}

function renderHistoryTable() {
  const goal = goals.find(g => g.id === currentGoalId);
  const historyBody = document.getElementById("display-history-rows");
  historyBody.innerHTML = "";

  if (!goal || goal.history.length === 0) {
    historyBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No transactions recorded yet.</td></tr>`;
    return;
  }

  goal.history.forEach(item => {
    const row = document.createElement("tr");
    const isDeposit = item.type === "deposit";
    const badgeClass = isDeposit ? "badge-deposit" : "badge-withdraw";
    const typeLabel = isDeposit ? "Deposit" : "Withdrawal";
    const amountDisplay = isDeposit ? `+ ${formatCurrency(item.amount)}` : `- ${formatCurrency(item.amount)}`;
    const amountColor = isDeposit ? "var(--success)" : "var(--danger)";

    row.innerHTML = `
      <td>${item.timestamp}</td>
      <td><span class="badge ${badgeClass}">${typeLabel}</span></td>
      <td style="color: ${amountColor}; font-weight: 600;">${amountDisplay}</td>
      <td>${formatCurrency(item.remainingAfter)}</td>
    `;
    historyBody.appendChild(row);
  });
}

function addTransaction(type) {
  const goal = goals.find(g => g.id === currentGoalId);
  if (!goal) return;

  const inputVal = parseFloat(document.getElementById("current-transaction-input").value);
  if (isNaN(inputVal) || inputVal <= 0) {
    alert("Please enter a valid transaction amount greater than 0.");
    return;
  }

  // STRICT WITHDRAWAL VALIDATION
  if (type === 'withdraw' && inputVal > goal.saved) {
    alert("Withdrawal amount cannot exceed your total saved balance (" + formatCurrency(goal.saved) + ").");
    return;
  }

  // STRICT DEPOSIT / OVERFLOW VALIDATION
  const remainingBalance = goal.target - goal.saved;
  if (type === 'deposit' && inputVal > remainingBalance) {
    alert(`Strict Validation: Your deposit of ${formatCurrency(inputVal)} exceeds the remaining target balance of ${formatCurrency(remainingBalance)}.\n\nYou cannot deposit more than what is left unless you increase the Target Amount in Edit Parameters.`);
    return;
  }

  if (type === 'deposit') {
    goal.saved += inputVal;
  } else {
    goal.saved -= inputVal;
  }

  const remainingAfter = Math.max(0, goal.target - goal.saved);
  
  // Timestamp formatted down to the second (e.g., 2026-08-04 14:30:15)
  const now = new Date();
  const timestampStr = now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, '0') + "-" +
    String(now.getDate()).padStart(2, '0') + " " +
    String(now.getHours()).padStart(2, '0') + ":" +
    String(now.getMinutes()).padStart(2, '0') + ":" +
    String(now.getSeconds()).padStart(2, '0');
    
  const dateOnlyStr = timestampStr.split(" ")[0];

  goal.history.unshift({
    id: "tx-" + Date.now(),
    timestamp: timestampStr,
    dateOnly: dateOnlyStr,
    type: type,
    amount: inputVal,
    remainingAfter: remainingAfter
  });

  updateTopAnalytics();
  renderGoalSelector();
  renderActiveGoal();
}

function toggleIntervalField(prefix) {
  const val = document.getElementById(`${prefix}-interval`).value;
  const group = document.getElementById(`${prefix}-custom-group`);
  if (val === "custom") {
    group.classList.remove("hidden");
  } else {
    group.classList.add("hidden");
  }
}

/* --- SUGGESTED SAVINGS COMPUTATION LOGIC --- */
function updateSuggestion(prefix) {
  const targetVal = parseFloat(document.getElementById(`${prefix}-target`).value);
  const startDateStr = document.getElementById(`${prefix}-start`).value;
  const endDateStr = document.getElementById(`${prefix}-end`).value;
  const intervalType = document.getElementById(`${prefix}-interval`).value;
  const customDays = parseInt(document.getElementById(`${prefix}-custom-days`).value) || 1;
  const box = document.getElementById(`${prefix}-suggestion-box`);
  const text = document.getElementById(`${prefix}-suggestion-text`);
  const btn = document.getElementById(`${prefix}-suggestion-btn`);

  // Check if endless goal (no end date)
  if (!endDateStr || endDateStr.trim() === "") {
    box.classList.remove("hidden");
    text.innerText = "💡 Endless Savings Mode: No target end date set. Save at your own comfortable pace!";
    btn.classList.add("hidden");
    currentSuggestedAmounts[prefix] = null;
    return;
  }

  if (!targetVal || targetVal <= 0 || !startDateStr) {
    box.classList.add("hidden");
    return;
  }

  const start = new Date(startDateStr + "T00:00:00");
  const end = new Date(endDateStr + "T00:00:00");
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  if (totalDays <= 0) {
    box.classList.remove("hidden");
    text.innerText = "💡 Target End Date must be later than Start Date to calculate suggestion.";
    btn.classList.add("hidden");
    currentSuggestedAmounts[prefix] = null;
    return;
  }

  let intervals = 1;
  let intervalLabel = "daily";
  if (intervalType === "everyday") {
    intervals = totalDays;
    intervalLabel = "daily";
  } else if (intervalType === "weekly") {
    intervals = totalDays / 7;
    intervalLabel = "weekly";
  } else if (intervalType === "monthly") {
    intervals = totalDays / 30.4375;
    intervalLabel = "monthly";
  } else if (intervalType === "custom") {
    intervals = totalDays / customDays;
    intervalLabel = `every ${customDays} day(s)`;
  }

  intervals = Math.max(1, Math.round(intervals * 10) / 10);
  const suggestedAmount = Math.ceil((targetVal / intervals) * 100) / 100;
  currentSuggestedAmounts[prefix] = suggestedAmount;

  box.classList.remove("hidden");
  text.innerText = `💡 Suggested: ${formatCurrency(suggestedAmount)} ${intervalLabel} to reach target on time.`;
  btn.classList.remove("hidden");
}

function applySuggestion(prefix) {
  const suggested = currentSuggestedAmounts[prefix];
  if (suggested && suggested > 0) {
    document.getElementById(`${prefix}-deposit`).value = suggested;
  }
}

function showCreateForm() {
  hideEditForm();
  document.getElementById("create-goal-section").classList.remove("hidden");
  updateSuggestion('create');
}

function hideCreateForm() {
  document.getElementById("create-goal-section").classList.add("hidden");
  document.getElementById("new-goal-form").reset();
  const todayStr = new Date().toISOString().split("T")[0];
  document.getElementById("create-start").value = todayStr;
}

function saveNewGoal(e) {
  e.preventDefault();
  const name = document.getElementById("create-name").value.trim();
  const description = document.getElementById("create-description").value.trim();
  const target = parseFloat(document.getElementById("create-target").value);
  const startDate = document.getElementById("create-start").value;
  const endDate = document.getElementById("create-end").value;
  const intervalType = document.getElementById("create-interval").value;
  const customDays = parseInt(document.getElementById("create-custom-days").value) || 1;
  const depositAmount = parseFloat(document.getElementById("create-deposit").value);

  if (endDate && endDate.trim() !== "" && new Date(endDate) < new Date(startDate)) {
    alert("Target End Date cannot be earlier than Start Date.");
    return;
  }

  const newGoal = {
    id: "account-" + Date.now(),
    name,
    description,
    target,
    saved: 0,
    startDate,
    endDate: endDate || "",
    intervalType,
    customDays,
    depositAmount,
    history: []
  };

  goals.push(newGoal);
  currentGoalId = newGoal.id;

  hideCreateForm();
  renderGoalSelector();
  updateTopAnalytics();
  renderActiveGoal();
}

function showEditForm() {
  const goal = goals.find(g => g.id === currentGoalId);
  if (!goal) return;

  hideCreateForm();
  document.getElementById("edit-name").value = goal.name;
  document.getElementById("edit-description").value = goal.description || "";
  document.getElementById("edit-target").value = goal.target;
  document.getElementById("edit-start").value = goal.startDate;
  document.getElementById("edit-end").value = goal.endDate || "";
  document.getElementById("edit-interval").value = goal.intervalType;
  document.getElementById("edit-custom-days").value = goal.customDays;
  document.getElementById("edit-deposit").value = goal.depositAmount;

  toggleIntervalField('edit');
  updateSuggestion('edit');
  document.getElementById("edit-goal-section").classList.remove("hidden");
}

function hideEditForm() {
  document.getElementById("edit-goal-section").classList.add("hidden");
}

function updateGoalSettings(e) {
  e.preventDefault();
  const goal = goals.find(g => g.id === currentGoalId);
  if (!goal) return;

  const startDate = document.getElementById("edit-start").value;
  const endDate = document.getElementById("edit-end").value;
  const newTarget = parseFloat(document.getElementById("edit-target").value);

  if (endDate && endDate.trim() !== "" && new Date(endDate) < new Date(startDate)) {
    alert("Target End Date cannot be earlier than Start Date.");
    return;
  }

  if (newTarget < goal.saved) {
    alert("New target amount (" + formatCurrency(newTarget) + ") cannot be lower than your current saved balance (" + formatCurrency(goal.saved) + ").");
    return;
  }

  goal.name = document.getElementById("edit-name").value.trim();
  goal.description = document.getElementById("edit-description").value.trim();
  goal.target = newTarget;
  goal.startDate = startDate;
  goal.endDate = endDate || "";
  goal.intervalType = document.getElementById("edit-interval").value;
  goal.customDays = parseInt(document.getElementById("edit-custom-days").value) || 1;
  goal.depositAmount = parseFloat(document.getElementById("edit-deposit").value);

  hideEditForm();
  renderGoalSelector();
  updateTopAnalytics();
  renderActiveGoal();
}

window.onload = init;