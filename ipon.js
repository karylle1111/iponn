let goals = [];
let currentGoalId = null;
let currentSuggestedAmounts = { create: null, edit: null };

const formatCurrency = (val) => "₱" + Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* --- MONEY-SAFE HELPERS ---
   JS floats can't represent centavos exactly (e.g. 0.1 + 0.2 !== 0.3),
   so all money math that needs an exact comparison (deposits, withdrawals,
   remaining balance) is done in integer centavos, then converted back. */
const toCents = (val) => Math.round(Number(val) * 100);
const fromCents = (cents) => cents / 100;

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
  calendarPageIndex = 0;
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
  
  const defaultDeposit = goal.depositAmount;
  const remainingCents = Math.max(0, toCents(goal.target) - toCents(goal.saved));
  const defaultDepositCents = toCents(defaultDeposit);
  document.getElementById("current-transaction-input").value =
    (remainingCents > 0 && remainingCents < defaultDepositCents) ? fromCents(remainingCents).toFixed(2) : defaultDeposit;

  document.getElementById("display-progress-pct").innerText = `${progressPct}%`;
  document.getElementById("display-progress-bar").style.width = `${progressPct}%`;

  // Status Badge Toggle
  const statusBadge = document.getElementById("display-status-badge");
  if (isAccomplished) {
    statusBadge.classList.remove("hidden");
    statusBadge.className = "badge badge-completed";
    statusBadge.innerText = "Accomplished & Closed";
    
    document.getElementById("active-transaction-box").classList.add("hidden");
    document.getElementById("accomplished-banner-box").classList.remove("hidden");
  } else {
    statusBadge.classList.add("hidden");
    document.getElementById("active-transaction-box").classList.remove("hidden");
    document.getElementById("accomplished-banner-box").classList.add("hidden");
  }

  let badgeText = "Everyday";
  if (goal.intervalType === "weekdays") badgeText = "Weekdays Only";
  if (goal.intervalType === "days_per_week") badgeText = `${goal.daysPerWeek} Days / Week`;
  if (goal.intervalType === "weekly") badgeText = "Weekly";
  if (goal.intervalType === "monthly") badgeText = "Monthly";
  if (goal.intervalType === "custom") badgeText = `Every ${goal.customDays} Days`;
  document.getElementById("display-interval-badge").innerText = badgeText;
  
  const endDisplay = (!goal.endDate || goal.endDate.trim() === "") ? "Endless" : goal.endDate;
  document.getElementById("display-date-range").innerText = `Start: ${goal.startDate} | End: ${endDisplay}`;

  renderScheduleCalendar();
  renderHistoryTable();
  renderAnalyticsSummary();
}

/* --- DYNAMIC SAVINGS SCHEDULE CALENDAR ---
   Daily and weekly schedules can generate hundreds of slots for long-running
   goals, which used to render all at once and overwhelm the grid. They are
   now grouped into pages (one calendar month per page) with Prev/Next
   navigation. Monthly schedules stay ungrouped since they're already compact,
   but the pager UI is reused/hidden automatically when there's only one page. */
let calendarPageIndex = 0;
let calendarPageGroups = []; // [{ key, label, slots: [...] }]

function renderScheduleCalendar() {
  const grid = document.getElementById("schedule-calendar-grid");
  const goal = goals.find(g => g.id === currentGoalId);

  if (!grid || !goal) return;
  grid.innerHTML = "";

  const start = new Date(goal.startDate + "T00:00:00");
  const end = (goal.endDate && goal.endDate.trim() !== "") 
    ? new Date(goal.endDate + "T00:00:00") 
    : new Date(start.getTime() + (90 * 24 * 60 * 60 * 1000));

  const slots = [];
  let cumulativeTarget = 0;
  let groupBy = "month"; // how slots get paged: "month" or "year" or "none"

  if (goal.intervalType === "monthly") {
    let currYear = start.getFullYear();
    let currMonth = start.getMonth();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();

    const totalMonths = Math.max(1, ((endYear - currYear) * 12) + (endMonth - currMonth) + 1);
    const exactPerMonth = goal.target / totalMonths;
    groupBy = "year";

    for (let i = 0; i < totalMonths; i++) {
      const date = new Date(currYear, currMonth + i, 1);
      const label = date.toLocaleDateString("en-US", { month: 'short', year: 'numeric' });
      
      if (i === totalMonths - 1) {
        cumulativeTarget = goal.target;
      } else {
        cumulativeTarget += exactPerMonth;
      }

      slots.push({
        label: label,
        date: date,
        expected: Number(cumulativeTarget.toFixed(2))
      });
    }
  } else if (goal.intervalType === "weekly" || goal.intervalType === "days_per_week") {
    const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
    const exactPerWeek = goal.target / totalWeeks;

    for (let i = 1; i <= totalWeeks; i++) {
      if (i === totalWeeks) {
        cumulativeTarget = goal.target;
      } else {
        cumulativeTarget += exactPerWeek;
      }

      // Anchor each week to its start date so it can be grouped by month
      const weekStartDate = new Date(start.getTime() + ((i - 1) * 7 * 24 * 60 * 60 * 1000));

      slots.push({
        label: `Week ${i}`,
        date: weekStartDate,
        expected: Number(cumulativeTarget.toFixed(2))
      });
    }
  } else {
    const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    const validDates = [];

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000));
      if (goal.intervalType === "weekdays" && (date.getDay() === 0 || date.getDay() === 6)) {
        continue;
      }
      validDates.push(date);
    }

    const totalSlots = Math.max(1, validDates.length);
    const exactPerSlot = goal.target / totalSlots;

    validDates.forEach((date, index) => {
      if (index === totalSlots - 1) {
        cumulativeTarget = goal.target;
      } else {
        cumulativeTarget += exactPerSlot;
      }

      slots.push({
        label: date.toLocaleDateString("en-US", { month: 'short', day: 'numeric' }),
        date: date,
        expected: Number(cumulativeTarget.toFixed(2))
      });
    });
  }

  // --- Group slots into pages ---
  const groups = [];
  const groupIndexByKey = {};

  slots.forEach(slot => {
    let key, label;
    if (groupBy === "year") {
      key = `${slot.date.getFullYear()}`;
      label = `${slot.date.getFullYear()}`;
    } else {
      key = `${slot.date.getFullYear()}-${slot.date.getMonth()}`;
      label = slot.date.toLocaleDateString("en-US", { month: 'long', year: 'numeric' });
    }

    if (!(key in groupIndexByKey)) {
      groupIndexByKey[key] = groups.length;
      groups.push({ key, label, slots: [] });
    }
    groups[groupIndexByKey[key]].slots.push(slot);
  });

  calendarPageGroups = groups.length > 0 ? groups : [{ key: "none", label: "", slots: [] }];

  // Default to the page containing today (if it's within range), otherwise page 0,
  // but only re-anchor when switching goals — keep the user's position on re-renders.
  if (calendarPageIndex >= calendarPageGroups.length) {
    calendarPageIndex = 0;
  }

  renderCalendarPager(goal);
  renderCalendarPage(goal);
}

function renderCalendarPager(goal) {
  const pagerEl = document.getElementById("calendar-pager");
  const labelEl = document.getElementById("calendar-pager-label");
  const prevBtn = document.getElementById("calendar-prev-btn");
  const nextBtn = document.getElementById("calendar-next-btn");
  if (!pagerEl) return;

  const totalPages = calendarPageGroups.length;
  const showPager = totalPages > 1;

  pagerEl.classList.toggle("hidden", !showPager);
  if (!showPager) return;

  labelEl.innerText = `${calendarPageGroups[calendarPageIndex].label} (${calendarPageIndex + 1} / ${totalPages})`;
  prevBtn.disabled = calendarPageIndex === 0;
  nextBtn.disabled = calendarPageIndex === totalPages - 1;
}

function changeCalendarPage(direction) {
  const newIndex = calendarPageIndex + direction;
  if (newIndex < 0 || newIndex >= calendarPageGroups.length) return;
  calendarPageIndex = newIndex;
  const goal = goals.find(g => g.id === currentGoalId);
  renderCalendarPager(goal);
  renderCalendarPage(goal);
}

function renderCalendarPage(goal) {
  const grid = document.getElementById("schedule-calendar-grid");
  if (!grid || !goal) return;
  grid.innerHTML = "";

  const isGoalAccomplished = goal.saved >= goal.target;
  const pageSlots = calendarPageGroups[calendarPageIndex] ? calendarPageGroups[calendarPageIndex].slots : [];

  if (pageSlots.length === 0) {
    grid.innerHTML = `<div class="empty-state">No schedule slots to show.</div>`;
    return;
  }

  pageSlots.forEach((slot) => {
    const isPaid = isGoalAccomplished || (goal.saved + 0.05 >= slot.expected);
    const remainingForSlot = Math.max(0, (slot.expected - goal.saved)).toFixed(2);
    
    const card = document.createElement("div");
    card.className = `calendar-card ${isPaid ? 'is-paid' : ''}`;
    
    card.innerHTML = `
      <div class="slot-header">
        <span class="slot-title">${slot.label}</span>
        <span class="badge ${isPaid ? 'badge-completed' : ''}">${isPaid ? 'Paid' : 'Pending'}</span>
      </div>
      <div class="slot-body">
        Expected: <strong>₱${slot.expected.toFixed(2)}</strong><br>
        Status: <span style="color: ${isPaid ? 'var(--success)' : 'var(--text-muted)'}; font-weight: 600;">
          ${isPaid ? 'Done' : '₱' + remainingForSlot + ' left'}
        </span>
      </div>
    `;
    grid.appendChild(card);
  });
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

/* --- EXPORT LEDGER (CSV) --- */
function exportLedgerCSV() {
  const goal = goals.find(g => g.id === currentGoalId);
  if (!goal || goal.history.length === 0) {
    alert("No transaction history available to export.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,Timestamp,Type,Amount (PHP),Remaining Balance (PHP)\r\n";

  goal.history.forEach(item => {
    const row = [
      `"${item.timestamp}"`,
      `"${item.type.toUpperCase()}"`,
      item.amount.toFixed(2),
      item.remainingAfter.toFixed(2)
    ];
    csvContent += row.join(",") + "\r\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${goal.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_ledger.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function addTransaction(type) {
  const goal = goals.find(g => g.id === currentGoalId);
  if (!goal) return;

  const inputVal = parseFloat(document.getElementById("current-transaction-input").value);
  if (isNaN(inputVal) || inputVal <= 0) {
    alert("Please enter a valid transaction amount greater than 0.");
    return;
  }

  // All comparisons below are done in integer centavos so that binary
  // floating-point rounding (e.g. 0.1 + 0.2 !== 0.3) never causes a
  // legitimate final deposit/withdrawal to be rejected or mis-tallied.
  const inputCents = toCents(inputVal);
  const savedCents = toCents(goal.saved);
  const targetCents = toCents(goal.target);

  if (type === 'withdraw' && inputCents > savedCents) {
    alert("Withdrawal amount cannot exceed your total saved balance (" + formatCurrency(goal.saved) + ").");
    return;
  }

  const remainingBalanceCents = Math.max(0, targetCents - savedCents);
  const remainingBalance = fromCents(remainingBalanceCents);

  if (type === 'deposit' && inputCents > remainingBalanceCents) {
    alert(`Strict Validation: Your deposit of ${formatCurrency(inputVal)} exceeds the remaining target balance of ${formatCurrency(remainingBalance)}.\n\nYou cannot deposit more than what is left unless you increase the Target Amount in Edit Parameters.`);
    return;
  }

  if (type === 'deposit') {
    goal.saved = fromCents(savedCents + inputCents);
    // Auto-snap and cap exactly to target if we've reached (or centavo-rounded past) it
    if (toCents(goal.saved) >= targetCents) {
      goal.saved = goal.target;
    }
  } else {
    goal.saved = fromCents(savedCents - inputCents);
  }

  const remainingAfter = Math.max(0, fromCents(toCents(goal.target) - toCents(goal.saved)));
  
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
  const customGroup = document.getElementById(`${prefix}-custom-group`);
  const weeklyDaysGroup = document.getElementById(`${prefix}-weekly-days-group`);

  customGroup.classList.toggle("hidden", val !== "custom");
  weeklyDaysGroup.classList.toggle("hidden", val !== "days_per_week");
}

function updateSuggestion(prefix) {
  const targetVal = parseFloat(document.getElementById(`${prefix}-target`).value);
  const startDateStr = document.getElementById(`${prefix}-start`).value;
  const endDateStr = document.getElementById(`${prefix}-end`).value;
  const intervalType = document.getElementById(`${prefix}-interval`).value;
  const customDays = parseInt(document.getElementById(`${prefix}-custom-days`).value) || 1;
  const daysPerWeek = parseInt(document.getElementById(`${prefix}-days-per-week`).value) || 3;
  
  const box = document.getElementById(`${prefix}-suggestion-box`);
  const text = document.getElementById(`${prefix}-suggestion-text`);
  const btn = document.getElementById(`${prefix}-suggestion-btn`);

  if (!endDateStr || endDateStr.trim() === "") {
    box.classList.remove("hidden");
    text.innerText = "Endless Savings Mode: No target end date set. Save at your own comfortable pace!";
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
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  if (totalDays <= 0) {
    box.classList.remove("hidden");
    text.innerText = "Target End Date must be later than Start Date to calculate suggestion.";
    btn.classList.add("hidden");
    currentSuggestedAmounts[prefix] = null;
    return;
  }

  let intervals = 1;
  let intervalLabel = "daily";

  if (intervalType === "monthly") {
    const totalMonths = ((end.getFullYear() - start.getFullYear()) * 12) + (end.getMonth() - start.getMonth()) + 1;
    intervals = Math.max(1, totalMonths);
    intervalLabel = "monthly";
  } else if (intervalType === "everyday") {
    intervals = totalDays;
    intervalLabel = "daily";
  } else if (intervalType === "weekdays") {
    intervals = totalDays * (5 / 7);
    intervalLabel = "per weekday (Mon–Fri)";
  } else if (intervalType === "days_per_week") {
    intervals = (totalDays / 7) * daysPerWeek;
    intervalLabel = `${daysPerWeek} days a week`;
  } else if (intervalType === "weekly") {
    intervals = totalDays / 7;
    intervalLabel = "weekly";
  } else if (intervalType === "custom") {
    intervals = totalDays / customDays;
    intervalLabel = `every ${customDays} day(s)`;
  }

  intervals = Math.max(1, intervals);
  const suggestedAmount = Math.ceil((targetVal / intervals) * 10) / 10;
  currentSuggestedAmounts[prefix] = suggestedAmount;

  box.classList.remove("hidden");
  text.innerText = `Suggested: ${formatCurrency(suggestedAmount)} ${intervalLabel} to reach target on time.`;
  btn.classList.remove("hidden");
}

function applySuggestion(prefix) {
  const suggested = currentSuggestedAmounts[prefix];
  if (suggested && suggested > 0) {
    document.getElementById(`${prefix}-deposit`).value = suggested.toFixed(1);
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
  const daysPerWeek = parseInt(document.getElementById("create-days-per-week").value) || 3;
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
    daysPerWeek,
    depositAmount,
    history: []
  };

  goals.push(newGoal);
  currentGoalId = newGoal.id;
  calendarPageIndex = 0;

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
  document.getElementById("edit-custom-days").value = goal.customDays || 1;
  document.getElementById("edit-days-per-week").value = goal.daysPerWeek || 3;
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
  goal.daysPerWeek = parseInt(document.getElementById("edit-days-per-week").value) || 3;
  goal.depositAmount = parseFloat(document.getElementById("edit-deposit").value);

  hideEditForm();
  renderGoalSelector();
  updateTopAnalytics();
  renderActiveGoal();
}

window.onload = init;