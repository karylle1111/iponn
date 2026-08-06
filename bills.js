let bills = [];
let transactions = [];

// Calendar State
let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth(); // 0-indexed
let selectedModalBillId = null;
let selectedModalInstanceDate = null;
let selectedModalIsPaid = false;

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const formatCurrency = (val) => "₱" + Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toCents = (val) => Math.round(Number(val) * 100);
const fromCents = (cents) => cents / 100;
const pad2 = (n) => String(n).padStart(2, "0");
const toDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function init() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("pay-timestamp").value = now.toISOString().slice(0, 16);

  const todayStr = new Date().toISOString().split("T")[0];
  document.getElementById("bill-due-date").value = todayStr;

  populateDayOfMonthSelect("bill-reminder-day-annual");
  populateDayOfMonthSelect("edit-reminder-day-annual");
  toggleReminderFields('bill');
  toggleReminderFields('edit');

  updateDashboard();
  initCalendarPicker();
  renderCalendar();
  renderLedger();
  renderPeriodSummary();
}

function populateDayOfMonthSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = "";
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement("option");
    opt.value = String(d);
    opt.textContent = String(d);
    select.appendChild(opt);
  }
}

/* --- DASHBOARD STATISTICS --- */
function updateDashboard() {
  let totalBillsCents = 0;
  let totalPaidCents = 0;

  bills.forEach(b => { totalBillsCents += toCents(b.amount); });
  transactions.forEach(t => { totalPaidCents += toCents(t.amount); });

  const totalBills = fromCents(totalBillsCents);
  const totalPaid = fromCents(totalPaidCents);
  const totalUnpaid = Math.max(0, fromCents(totalBillsCents - totalPaidCents));
  const completionRate = totalBills > 0 ? Math.min(100, Math.round((totalPaid / totalBills) * 100)) : 0;

  document.getElementById("stat-total-bills").innerText = formatCurrency(totalBills);
  document.getElementById("stat-total-paid").innerText = formatCurrency(totalPaid);
  document.getElementById("stat-total-unpaid").innerText = formatCurrency(totalUnpaid);
  document.getElementById("stat-completion-rate").innerText = `${completionRate}%`;
}

/* --- MONTH NAVIGATION: centered label + prev/next, plus a jump-to picker --- */
function initCalendarPicker() {
  const picker = document.getElementById("calendar-month-picker");
  if (picker) {
    const mStr = pad2(currentCalMonth + 1);
    picker.value = `${currentCalYear}-${mStr}`;
  }
  updateCalendarLabel();
}

function updateCalendarLabel() {
  const label = document.getElementById("calendar-month-label");
  if (!label) return;
  const d = new Date(currentCalYear, currentCalMonth, 1);
  label.innerText = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function changeMonth(delta) {
  let newMonth = currentCalMonth + delta;
  let newYear = currentCalYear;
  if (newMonth < 0) {
    newMonth = 11;
    newYear -= 1;
  } else if (newMonth > 11) {
    newMonth = 0;
    newYear += 1;
  }
  currentCalMonth = newMonth;
  currentCalYear = newYear;
  renderCalendar();
}

function onMonthPickerChange(val) {
  if (!val) return;
  const [year, month] = val.split("-");
  currentCalYear = parseInt(year, 10);
  currentCalMonth = parseInt(month, 10) - 1;
  renderCalendar();
}

function goToToday() {
  const today = new Date();
  currentCalYear = today.getFullYear();
  currentCalMonth = today.getMonth();
  initCalendarPicker();
  renderCalendar();
}

function renderCalendar() {
  const gridEl = document.getElementById("calendar-grid-month");
  gridEl.innerHTML = "";

  initCalendarPicker();

  const firstDayOfWeek = new Date(currentCalYear, currentCalMonth, 1).getDay();
  const daysInCurrentMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentCalYear, currentCalMonth, 0).getDate();

  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Previous month trailing cells
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    gridEl.appendChild(createDayCell(dayNum, true, false, []));
  }

  // 2. Current month cells
  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const cellDateStr = `${currentCalYear}-${String(currentCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = (cellDateStr === todayStr);
    
    const dayBills = getBillsForDate(cellDateStr, day);
    gridEl.appendChild(createDayCell(day, false, isToday, dayBills, cellDateStr));
  }

  // 3. Next month leading cells
  const totalCellsRendered = firstDayOfWeek + daysInCurrentMonth;
  const remainingCells = (totalCellsRendered > 35 ? 42 : 35) - totalCellsRendered;
  for (let i = 1; i <= remainingCells; i++) {
    gridEl.appendChild(createDayCell(i, true, false, []));
  }
}

function createDayCell(dayNum, isOtherMonth, isToday, billsOnDate, dateStr = "") {
  const cell = document.createElement("div");
  cell.className = "calendar-day-cell";
  if (isOtherMonth) cell.classList.add("other-month");
  if (isToday) cell.classList.add("is-today");

  const numEl = document.createElement("div");
  numEl.className = "day-number";
  numEl.innerText = dayNum;
  cell.appendChild(numEl);

  billsOnDate.forEach(item => {
    const pill = document.createElement("div");
    
    let statusClass = "";
    if (item.isPaid) {
      statusClass = "paid";
    } else if (item.isOverdue) {
      statusClass = "overdue";
    } else if (item.isDueSoon) {
      statusClass = "due-soon";
    }

    pill.className = `calendar-event-pill ${statusClass}`;
    pill.innerText = `${item.bill.name} (${formatCurrency(item.bill.amount)})`;
    
    pill.onclick = (e) => {
      e.stopPropagation();
      openActionModal(item.bill.id, dateStr, item.isPaid, item.isOverdue);
    };

    cell.appendChild(pill);
  });

  return cell;
}

/* --- RECURRING INSTANCE GENERATOR --- */

// Does `bill` have a due occurrence on dateStr? (dayNumber = the day-of-month for that date)
function isBillDueOnDate(bill, dateStr, dayNumber) {
  const cellDate = new Date(dateStr + "T00:00:00");
  const startDueDate = new Date(bill.dueDate + "T00:00:00");

  if (bill.frequency === "One-time") {
    return bill.dueDate === dateStr;
  } else if (bill.frequency === "Monthly") {
    const dueDay = parseInt(bill.dueDate.split("-")[2], 10);
    return cellDate >= new Date(startDueDate.getFullYear(), startDueDate.getMonth(), 1) && dayNumber === dueDay;
  } else if (bill.frequency === "Weekly") {
    const diffDays = Math.round((cellDate - startDueDate) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % 7 === 0;
  } else if (bill.frequency === "Annual") {
    return cellDate.getMonth() === startDueDate.getMonth() && dayNumber === startDueDate.getDate() && cellDate.getFullYear() >= startDueDate.getFullYear();
  }
  return false;
}

// Key that groups transactions belonging to the same due occurrence, so a period
// can't be "paid" twice: one-time bills only ever have one period; monthly bills
// group by calendar month; weekly bills group by the exact due date (each week is
// its own unique date already); annual bills group by year.
function getInstancePeriodKey(bill, instanceDateStr) {
  if (bill.frequency === "One-time") return "onetime";
  if (bill.frequency === "Monthly") return instanceDateStr.slice(0, 7);
  if (bill.frequency === "Weekly") return instanceDateStr;
  if (bill.frequency === "Annual") return instanceDateStr.slice(0, 4);
  return instanceDateStr;
}

function getPaidCentsForInstance(bill, instanceDateStr) {
  const key = getInstancePeriodKey(bill, instanceDateStr);
  return transactions
    .filter(t => t.billId === bill.id && t.periodKey === key)
    .reduce((sum, t) => sum + toCents(t.amount), 0);
}

function isInstancePaid(bill, instanceDateStr) {
  return getPaidCentsForInstance(bill, instanceDateStr) >= toCents(bill.amount);
}

// Walk forward from the bill's due date looking for the earliest occurrence that
// isn't fully paid yet (used to default the general "+ Pay Bill" flow, and to
// decide whether a bill has anything left to pay at all).
function findEarliestUnpaidInstance(bill) {
  let cursor = new Date(bill.dueDate + "T00:00:00");
  const maxIterations = 3700; // safety cap, ~10 years of days
  for (let i = 0; i < maxIterations; i++) {
    const dateStr = toDateStr(cursor);
    const dayNumber = cursor.getDate();
    if (isBillDueOnDate(bill, dateStr, dayNumber)) {
      if (!isInstancePaid(bill, dateStr)) return dateStr;
      if (bill.frequency === "One-time") return null;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

function getBillsForDate(dateStr, dayNumber) {
  const matched = [];
  const cellDate = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0,0,0,0);

  bills.forEach(bill => {
    if (!isBillDueOnDate(bill, dateStr, dayNumber)) return;

    const isPaid = isInstancePaid(bill, dateStr);
    const isOverdue = !isPaid && (cellDate < today);
    const isDueSoon = !isPaid && (cellDate >= today && (cellDate - today) / (1000*60*60*24) <= 3);

    matched.push({ bill, isPaid, isOverdue, isDueSoon });
  });

  return matched;
}

/* --- REMINDER RULE FORMATTING (frequency-aware) --- */
function formatReminderRule(rule) {
  if (!rule || rule.type === "none") return "Not applicable (one-time bill)";
  if (rule.type === "monthly") return `Day ${rule.day} of every month`;
  if (rule.type === "weekly") return `Every ${WEEKDAY_NAMES[rule.weekday]}`;
  if (rule.type === "annual") return `Every ${MONTH_NAMES[rule.month - 1]} ${rule.day}`;
  return "—";
}

/* --- INTERACTIVE CALENDAR CLICK MODAL --- */
function openActionModal(billId, instanceDateStr, isPaid, isOverdue) {
  const bill = bills.find(b => b.id === billId);
  if (!bill) return;

  selectedModalBillId = bill.id;
  selectedModalInstanceDate = instanceDateStr;
  selectedModalIsPaid = isPaid;

  document.getElementById("modal-bill-title").innerText = bill.name;
  document.getElementById("modal-bill-amount").innerText = formatCurrency(bill.amount);
  document.getElementById("modal-bill-due").innerText = instanceDateStr;
  document.getElementById("modal-bill-reminder").innerText = formatReminderRule(bill.reminderRule);
  document.getElementById("modal-bill-frequency").innerText = `${bill.frequency} · ${bill.mode}`;
  document.getElementById("modal-bill-notes").innerText = bill.notes || "No additional notes.";

  const statusBadge = document.getElementById("modal-bill-status");
  const payBtn = document.getElementById("modal-pay-btn");
  if (isPaid) {
    statusBadge.className = "badge badge-paid";
    statusBadge.innerText = "Paid";
    payBtn.disabled = true;
    payBtn.classList.add("hidden");
  } else if (isOverdue) {
    statusBadge.className = "badge badge-overdue";
    statusBadge.innerText = "Overdue";
    payBtn.disabled = false;
    payBtn.classList.remove("hidden");
  } else {
    statusBadge.className = "badge badge-pending";
    statusBadge.innerText = "Pending";
    payBtn.disabled = false;
    payBtn.classList.remove("hidden");
  }

  document.getElementById("bill-action-modal").classList.remove("hidden");
}

function closeActionModal() {
  document.getElementById("bill-action-modal").classList.add("hidden");
  selectedModalBillId = null;
  selectedModalIsPaid = false;
}

function openModifyFromModal() {
  const bill = bills.find(b => b.id === selectedModalBillId);
  if (!bill) return;

  closeActionModal();
  hideAddBillForm();
  hidePayBillForm();

  document.getElementById("edit-bill-id").value = bill.id;
  document.getElementById("edit-name").value = bill.name;
  document.getElementById("edit-amount").value = bill.amount;
  document.getElementById("edit-mode").value = bill.mode;
  document.getElementById("edit-frequency").value = bill.frequency;
  document.getElementById("edit-due-date").value = bill.dueDate;
  document.getElementById("edit-notes").value = bill.notes || "";

  toggleReminderFields('edit');
  setReminderFormFromRule('edit', bill.reminderRule);

  const section = document.getElementById("edit-bill-section");
  section.classList.remove("hidden");
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openPayFromModal() {
  const bill = bills.find(b => b.id === selectedModalBillId);
  if (!bill) return;

  if (selectedModalIsPaid || isInstancePaid(bill, selectedModalInstanceDate)) {
    alert("This bill has already been paid for this period. You can't record another payment for it.");
    return;
  }

  const instanceDate = selectedModalInstanceDate;
  closeActionModal();
  showPayBillForm();
  selectBillForPayment(bill.id, instanceDate);
}

/* --- ADD & EDIT BILL FORM ACTIONS --- */
function showAddBillForm() {
  hideEditBillForm();
  hidePayBillForm();
  const section = document.getElementById("add-bill-section");
  section.classList.remove("hidden");
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideAddBillForm() {
  document.getElementById("add-bill-section").classList.add("hidden");
  document.getElementById("add-bill-form").reset();
}

function hideEditBillForm() {
  document.getElementById("edit-bill-section").classList.add("hidden");
  document.getElementById("edit-bill-form").reset();
}

/* --- FREQUENCY-AWARE REMINDER FIELDS --- */
// Shows only the reminder sub-field that matches the selected frequency:
// monthly -> day-of-month only, weekly -> day-of-week only, annual -> month+day,
// one-time -> disabled (the due date already covers it).
function toggleReminderFields(prefix) {
  const frequency = document.getElementById(`${prefix}-frequency`).value;
  const groups = {
    monthly: document.getElementById(`${prefix}-reminder-monthly-group`),
    weekly: document.getElementById(`${prefix}-reminder-weekly-group`),
    annual: document.getElementById(`${prefix}-reminder-annual-group`),
    none: document.getElementById(`${prefix}-reminder-none-group`)
  };
  Object.values(groups).forEach(g => { if (g) g.classList.add("hidden"); });

  if (frequency === "Monthly" && groups.monthly) groups.monthly.classList.remove("hidden");
  else if (frequency === "Weekly" && groups.weekly) groups.weekly.classList.remove("hidden");
  else if (frequency === "Annual" && groups.annual) groups.annual.classList.remove("hidden");
  else if (groups.none) groups.none.classList.remove("hidden");
}

function getReminderRuleFromForm(prefix) {
  const frequency = document.getElementById(`${prefix}-frequency`).value;

  if (frequency === "One-time") {
    return { type: "none" };
  }
  if (frequency === "Monthly") {
    const day = parseInt(document.getElementById(`${prefix}-reminder-day-month`).value, 10);
    if (!day || day < 1 || day > 31) {
      alert("Please enter a valid reminder day of month (1–31).");
      return null;
    }
    return { type: "monthly", day };
  }
  if (frequency === "Weekly") {
    const weekday = parseInt(document.getElementById(`${prefix}-reminder-weekday`).value, 10);
    if (isNaN(weekday)) {
      alert("Please select a reminder day of the week.");
      return null;
    }
    return { type: "weekly", weekday };
  }
  if (frequency === "Annual") {
    const month = parseInt(document.getElementById(`${prefix}-reminder-month`).value, 10);
    const day = parseInt(document.getElementById(`${prefix}-reminder-day-annual`).value, 10);
    if (!month || !day) {
      alert("Please select a valid reminder month and day.");
      return null;
    }
    return { type: "annual", month, day };
  }
  return { type: "none" };
}

function setReminderFormFromRule(prefix, rule) {
  if (!rule) rule = { type: "none" };
  if (rule.type === "monthly") {
    const el = document.getElementById(`${prefix}-reminder-day-month`);
    if (el) el.value = rule.day || "";
  } else if (rule.type === "weekly") {
    const el = document.getElementById(`${prefix}-reminder-weekday`);
    if (el) el.value = String(rule.weekday ?? 0);
  } else if (rule.type === "annual") {
    const monthEl = document.getElementById(`${prefix}-reminder-month`);
    const dayEl = document.getElementById(`${prefix}-reminder-day-annual`);
    if (monthEl) monthEl.value = String(rule.month || 1);
    if (dayEl) dayEl.value = String(rule.day || 1);
  }
}

function saveBill(e) {
  e.preventDefault();
  const name = document.getElementById("bill-name").value.trim();
  const amount = parseFloat(document.getElementById("bill-amount").value);
  const mode = document.getElementById("bill-mode").value;
  const frequency = document.getElementById("bill-frequency").value;
  const dueDate = document.getElementById("bill-due-date").value;
  const notes = document.getElementById("bill-notes").value.trim();

  if (!name) { alert("Please enter a bill name."); return; }
  if (isNaN(amount) || amount <= 0) { alert("Please enter a valid amount greater than 0."); return; }
  if (!mode) { alert("Please select a mode of payment."); return; }
  if (!dueDate) { alert("Please select a due date."); return; }

  const reminderRule = getReminderRuleFromForm('bill');
  if (reminderRule === null) return; // validation failed; message already shown

  bills.push({
    id: "bill-" + Date.now(),
    name,
    amount,
    mode,
    frequency,
    dueDate,
    reminderRule,
    notes
  });

  hideAddBillForm();
  updateDashboard();
  renderCalendar();
  renderPeriodSummary();
  populatePayBillSelect();
}

function updateBill(e) {
  e.preventDefault();
  const id = document.getElementById("edit-bill-id").value;
  const bill = bills.find(b => b.id === id);
  if (!bill) return;

  const name = document.getElementById("edit-name").value.trim();
  const amount = parseFloat(document.getElementById("edit-amount").value);
  const mode = document.getElementById("edit-mode").value;
  const dueDate = document.getElementById("edit-due-date").value;

  if (!name) { alert("Please enter a bill name."); return; }
  if (isNaN(amount) || amount <= 0) { alert("Please enter a valid amount greater than 0."); return; }
  if (!mode) { alert("Please select a mode of payment."); return; }
  if (!dueDate) { alert("Please select a due date."); return; }

  const reminderRule = getReminderRuleFromForm('edit');
  if (reminderRule === null) return;

  bill.name = name;
  bill.amount = amount;
  bill.mode = mode;
  bill.frequency = document.getElementById("edit-frequency").value;
  bill.dueDate = dueDate;
  bill.reminderRule = reminderRule;
  bill.notes = document.getElementById("edit-notes").value.trim();

  hideEditBillForm();
  updateDashboard();
  renderCalendar();
  renderLedger();
  renderPeriodSummary();
  populatePayBillSelect();
}

/* --- PAY BILL FORM ACTIONS --- */
function showPayBillForm() {
  hideAddBillForm();
  hideEditBillForm();
  if (bills.length === 0) {
    alert("Please add a bill first before recording a payment.");
    return;
  }
  populatePayBillSelect();
  const section = document.getElementById("pay-bill-section");
  section.classList.remove("hidden");
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hidePayBillForm() {
  document.getElementById("pay-bill-section").classList.add("hidden");
  document.getElementById("pay-bill-form").reset();
  document.getElementById("pay-bill-select").value = "";
  document.getElementById("pay-target-instance").value = "";
  closeBillPicker();
  syncBillPickerTrigger();
  const infoBox = document.getElementById("pay-instance-info");
  if (infoBox) { infoBox.classList.add("hidden"); infoBox.innerHTML = ""; }
  const amountInput = document.getElementById("pay-amount");
  if (amountInput) amountInput.disabled = true;
  const submitBtn = document.getElementById("pay-submit-btn");
  if (submitBtn) submitBtn.disabled = true;
}

/* --- CUSTOM BILL PICKER (styled dropdown instead of a plain native <select>) --- */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toggleBillPicker(e) {
  if (e) e.stopPropagation();
  const wrapper = document.getElementById("bill-picker");
  const isOpen = wrapper.classList.contains("open");
  isOpen ? closeBillPicker() : openBillPicker();
}

function openBillPicker() {
  document.getElementById("bill-picker").classList.add("open");
  document.getElementById("pay-bill-panel").classList.remove("hidden");
}

function closeBillPicker() {
  const wrapper = document.getElementById("bill-picker");
  if (!wrapper) return;
  wrapper.classList.remove("open");
  document.getElementById("pay-bill-panel").classList.add("hidden");
}

document.addEventListener("click", (e) => {
  const wrapper = document.getElementById("bill-picker");
  if (wrapper && !wrapper.contains(e.target)) closeBillPicker();
});

function buildBillPickerItem(bill, instanceDateStr, subLabel) {
  const item = document.createElement("div");
  item.className = "bill-picker-item";
  item.dataset.billId = bill.id;
  item.innerHTML = `
    <div class="bill-picker-item-main">
      <span class="bill-picker-item-name">${escapeHtml(bill.name)}</span>
      <span class="bill-picker-item-amount">${formatCurrency(bill.amount)}</span>
    </div>
    <div class="bill-picker-item-sub">${escapeHtml(subLabel)} · ${escapeHtml(bill.frequency)}</div>
  `;
  item.onclick = () => {
    selectBillForPayment(bill.id, instanceDateStr);
    closeBillPicker();
  };
  return item;
}

// Lists bills that still have at least one unpaid due occurrence. Bills that are
// fully settled (e.g. a paid one-time bill) are left out — there's nothing left
// to pay, so paying again shouldn't be possible.
function populatePayBillSelect() {
  const panel = document.getElementById("pay-bill-panel");
  panel.innerHTML = "";

  let anyPending = false;
  bills.forEach(b => {
    const nextInstance = findEarliestUnpaidInstance(b);
    if (!nextInstance) return;
    anyPending = true;

    const subLabel = b.frequency === "One-time" ? `Due ${formatDateDisplay(nextInstance)}` : `Next due ${formatDateDisplay(nextInstance)}`;
    panel.appendChild(buildBillPickerItem(b, nextInstance, subLabel));
  });

  if (!anyPending) {
    panel.innerHTML = `<div class="bill-picker-empty">All bills are fully paid — nothing pending.</div>`;
  }

  syncBillPickerTrigger();
  updatePayFormForSelection();
}

// Keeps the trigger button's label and the highlighted list item in sync with
// whichever bill is currently selected.
function syncBillPickerTrigger() {
  const billId = document.getElementById("pay-bill-select").value;
  const bill = bills.find(b => b.id === billId);
  const triggerText = document.getElementById("pay-bill-trigger-text");
  const panel = document.getElementById("pay-bill-panel");

  panel.querySelectorAll(".bill-picker-item").forEach(el => {
    el.classList.toggle("active", el.dataset.billId === billId);
  });

  if (bill) {
    triggerText.textContent = `${bill.name} — ${formatCurrency(bill.amount)}`;
    triggerText.classList.remove("bill-picker-placeholder");
  } else {
    triggerText.textContent = "Choose a bill...";
    triggerText.classList.add("bill-picker-placeholder");
  }
}

// Puts a specific bill + due instance into the pay form (used when paying from a
// calendar pill click, which targets an exact date rather than just "the next one").
function selectBillForPayment(billId, instanceDateStr) {
  const bill = bills.find(b => b.id === billId);
  const panel = document.getElementById("pay-bill-panel");
  let existing = panel.querySelector(`[data-bill-id="${billId}"]`);

  if (!existing && bill) {
    const emptyMsg = panel.querySelector(".bill-picker-empty");
    if (emptyMsg) emptyMsg.remove();
    panel.appendChild(buildBillPickerItem(bill, instanceDateStr, `For ${formatDateDisplay(instanceDateStr)}`));
  }

  document.getElementById("pay-bill-select").value = billId;
  document.getElementById("pay-target-instance").value = instanceDateStr;
  syncBillPickerTrigger();
  updatePayFormForSelection();
}

// Central place that keeps the amount field, info box, and submit button in sync
// with whichever bill + due instance is currently targeted. This is what enforces
// "already paid, can't pay again" at the UI level.
function updatePayFormForSelection() {
  const billId = document.getElementById("pay-bill-select").value;
  const instanceDate = document.getElementById("pay-target-instance").value;
  const infoBox = document.getElementById("pay-instance-info");
  const amountInput = document.getElementById("pay-amount");
  const submitBtn = document.getElementById("pay-submit-btn");
  const bill = bills.find(b => b.id === billId);

  if (!bill || !instanceDate) {
    infoBox.classList.add("hidden");
    infoBox.innerHTML = "";
    amountInput.value = "";
    amountInput.disabled = true;
    submitBtn.disabled = true;
    return;
  }

  const paidCents = getPaidCentsForInstance(bill, instanceDate);
  const targetCents = toCents(bill.amount);
  const remainingCents = Math.max(0, targetCents - paidCents);
  const remaining = fromCents(remainingCents);

  if (remainingCents <= 0) {
    infoBox.classList.remove("hidden");
    infoBox.className = "info-box warning";
    infoBox.innerText = `This bill is already fully paid for ${instanceDate}. Please choose a different bill.`;
    amountInput.value = "";
    amountInput.disabled = true;
    submitBtn.disabled = true;
    return;
  }

  infoBox.classList.remove("hidden");
  infoBox.className = "info-box";
  infoBox.innerHTML = `Paying for: <strong>${instanceDate}</strong> &nbsp;·&nbsp; Remaining balance: <strong>${formatCurrency(remaining)}</strong>`;
  amountInput.disabled = false;
  amountInput.max = remaining.toFixed(2);
  amountInput.value = remaining.toFixed(2);
  submitBtn.disabled = false;
}

function recordPayment(e) {
  e.preventDefault();
  const billId = document.getElementById("pay-bill-select").value;
  const bill = bills.find(b => b.id === billId);
  const instanceDate = document.getElementById("pay-target-instance").value;

  if (!bill) { alert("Please select a bill to pay."); return; }
  if (!instanceDate) { alert("No pending due period found for this bill."); return; }

  if (isInstancePaid(bill, instanceDate)) {
    alert("This bill has already been paid for this period. You can't record another payment for it.");
    updatePayFormForSelection();
    return;
  }

  const amount = parseFloat(document.getElementById("pay-amount").value);
  const timestampRaw = document.getElementById("pay-timestamp").value;

  if (isNaN(amount) || amount <= 0) { alert("Please enter a valid payment amount greater than 0."); return; }
  if (!timestampRaw) { alert("Please select the date & time paid."); return; }

  const paidCents = getPaidCentsForInstance(bill, instanceDate);
  const remainingCents = Math.max(0, toCents(bill.amount) - paidCents);
  if (toCents(amount) > remainingCents) {
    alert(`Payment amount cannot exceed the remaining balance of ${formatCurrency(fromCents(remainingCents))} for this bill period.`);
    return;
  }

  const timestamp = timestampRaw.replace("T", " ");
  const fileInput = document.getElementById("pay-proof");
  const proofFile = fileInput.files.length > 0 ? fileInput.files[0].name : "";
  const notes = document.getElementById("pay-notes").value.trim();

  transactions.unshift({
    id: "tx-" + Date.now(),
    billId: bill.id,
    billName: bill.name,
    amount,
    mode: bill.mode,
    timestamp,
    proofFile,
    notes,
    periodKey: getInstancePeriodKey(bill, instanceDate),
    instanceDate
  });

  hidePayBillForm();
  updateDashboard();
  renderCalendar();
  renderLedger();
  renderPeriodSummary();
  populatePayBillSelect();
}

/* --- TRANSACTION LEDGER & SEARCH --- */
function renderLedger() {
  const query = document.getElementById("ledger-search").value.trim().toLowerCase();
  const rowsEl = document.getElementById("ledger-rows");
  rowsEl.innerHTML = "";

  const filtered = transactions.filter(t => t.billName.toLowerCase().includes(query));

  if (filtered.length === 0) {
    rowsEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No matching transactions found.</td></tr>`;
    return;
  }

  filtered.forEach(tx => {
    const row = document.createElement("tr");
    const proofDisplay = tx.proofFile ? `📄 ${tx.proofFile}` : "None";
    row.innerHTML = `
      <td>${tx.timestamp}</td>
      <td style="font-weight: 700; color: var(--primary);">${tx.billName}</td>
      <td style="color: var(--success); font-weight: 700;">${formatCurrency(tx.amount)}</td>
      <td><span class="badge">${tx.mode}</span></td>
      <td>${proofDisplay}</td>
      <td style="color: var(--text-muted); font-size: 0.84rem;">${tx.notes || "—"}</td>
    `;
    rowsEl.appendChild(row);
  });
}

/* --- PERIOD SUMMARY ANALYTICS --- */
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

function renderPeriodSummary() {
  const periodType = document.getElementById("summary-period-selector").value;
  const summaryRows = document.getElementById("summary-rows");
  summaryRows.innerHTML = "";

  const groups = {};

  bills.forEach(bill => {
    const key = periodType === "monthly" ? getMonthLabel(bill.dueDate) : getWeekLabel(bill.dueDate);
    if (!groups[key]) groups[key] = { due: 0, paid: 0, count: 0 };
    groups[key].due += toCents(bill.amount);
    groups[key].count += 1;
  });

  transactions.forEach(tx => {
    const dateOnly = tx.timestamp.split(" ")[0] || tx.timestamp.split("T")[0];
    const key = periodType === "monthly" ? getMonthLabel(dateOnly) : getWeekLabel(dateOnly);
    if (!groups[key]) groups[key] = { due: 0, paid: 0, count: 0 };
    groups[key].paid += toCents(tx.amount);
  });

  const keys = Object.keys(groups);
  if (keys.length === 0) {
    summaryRows.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No period data available yet.</td></tr>`;
    return;
  }

  keys.forEach(periodKey => {
    const data = groups[periodKey];
    const dueVal = fromCents(data.due);
    const paidVal = fromCents(data.paid);
    const unpaidVal = Math.max(0, fromCents(data.due - data.paid));

    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 600;">${periodKey}</td>
      <td style="font-weight: 600;">${formatCurrency(dueVal)}</td>
      <td style="color: var(--success); font-weight: 600;">${formatCurrency(paidVal)}</td>
      <td style="color: ${unpaidVal > 0 ? 'var(--danger)' : 'var(--text)'}; font-weight: 700;">${formatCurrency(unpaidVal)}</td>
      <td>${data.count}</td>
    `;
    summaryRows.appendChild(row);
  });
}

/* --- CSV EXPORT --- */
function exportLedgerCSV() {
  if (transactions.length === 0) {
    alert("No transaction history available to export.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,Date Paid,Bill Name,Amount Paid (PHP),Mode,Proof of Payment,Notes\r\n";

  transactions.forEach(tx => {
    const row = [
      `"${tx.timestamp}"`,
      `"${tx.billName}"`,
      tx.amount.exports || tx.amount.toFixed(2),
      `"${tx.mode}"`,
      `"${tx.proofFile || ''}"`,
      `"${(tx.notes || '').replace(/"/g, '""')}"`
    ];
    csvContent += row.join(",") + "\r\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "payment_bills_ledger.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

window.onload = init;