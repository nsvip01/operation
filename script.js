import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";
import { getDatabase, ref, get, set, remove } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// ==========================================
// Firebase Configuration
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBeZRrnuglJDyds6O3x96LLMuu6YqqMJjM",
    authDomain: "operation-53ad6.firebaseapp.com",
    databaseURL: "https://operation-53ad6-default-rtdb.firebaseio.com",
    projectId: "operation-53ad6",
    storageBucket: "operation-53ad6.firebasestorage.app",
    messagingSenderId: "112380679613",
    appId: "1:112380679613:web:2dbd7161569b8716d2eed4",
    measurementId: "G-GTBS0VRSFN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics;
isSupported().then(yes => {
    if (yes) analytics = getAnalytics(app);
});

// تهيئة قاعدة البيانات في الوقت الفعلي (Realtime Database) بدلاً من Firestore
const db = getDatabase(app);
const opsRef = "operations"; // سنستخدمها لاحقاً لدمج المسار


// ==========================================
// Local Storage Fallback Setup
// ==========================================
// ==========================================
// App State & Data Management (Firebase)
// ==========================================
let operationsCache = [];

function getOperations() {
    return operationsCache;
}

async function fetchOperationsFromDB() {
    try {
        const snapshot = await promiseWithTimeout(get(ref(db, "operations")), 15000);
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Convert object to array
            operationsCache = Object.values(data);
        } else {
            operationsCache = [];
        }
        renderTable(filterDate.value);
        calculateStats();
        return true;
    } catch (error) {
        console.error("Error fetching operations from Firebase:", error);
        showToast(`فشل جلب البيانات من Firebase: ${error.message}`, "error");
        return false;
    }
}

async function saveOperationToDB(op) {
    try {
        await promiseWithTimeout(set(ref(db, "operations/" + op.id), op), 15000);
        await fetchOperationsFromDB(); // Refresh data
        return true;
    } catch (error) {
        console.error("Error saving operation to Firebase:", error);
        showToast(`فشل حفظ العملية إلى Firebase: ${error.message}`, "error");
        return false;
    }
}

async function removeOperationFromDB(id) {
    try {
        await promiseWithTimeout(remove(ref(db, "operations/" + id)), 15000);
        await fetchOperationsFromDB();
        return true;
    } catch (error) {
        console.error("Error deleting operation from Firebase:", error);
        showToast(`فشل حذف العملية من Firebase: ${error.message}`, "error");
        return false;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function promiseWithTimeout(promise, ms = 15000) {
    const timeout = new Promise((_, reject) => {
        const id = setTimeout(() => {
            clearTimeout(id);
            reject(new Error('طلب Firebase تجاوز المهلة (' + ms + 'مللي ثانية)'));
        }, ms);
    });
    return Promise.race([promise, timeout]);
}

// ==========================================
// UI Elements & State
// ==========================================

// Views
const viewHome = document.getElementById('view-home');
const viewForm = document.getElementById('view-form');

// Nav Buttons
const btnHome = document.getElementById('btn-home');
const btnAdd = document.getElementById('btn-add');

// Table & Empty State
const opsTableBody = document.getElementById('ops-table-body');
const emptyState = document.getElementById('empty-state');
const filterDate = document.getElementById('filter-date');

// Form Elements
const opForm = document.getElementById('op-form');
const formTitle = document.getElementById('form-title');
const opId = document.getElementById('op-id');
const opDate = document.getElementById('op-date');
const opTime = document.getElementById('op-time');
const opName = document.getElementById('op-name');
const opSurgeon = document.getElementById('op-surgeon');
const opRoom = document.getElementById('op-room');
const opNotes = document.getElementById('op-notes');
const btnCancel = document.getElementById('btn-cancel');

// Modal Elements
const deleteModal = document.getElementById('delete-modal');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');
const closeModals = document.querySelectorAll('.close-modal, .close-modal-btn');
let deleteTargetId = null;

// Sort State
let currentSort = { column: 'time', order: 'asc' };

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Set today's date in filter by default
    const today = new Date().toISOString().split('T')[0];
    filterDate.value = today;

    // Fetch data from Firebase
    fetchOperationsFromDB();
});

// ==========================================
// Navigation & View Switching
// ==========================================
btnHome.addEventListener('click', () => {
    switchView('home');
    renderTable(filterDate.value);
});

btnAdd.addEventListener('click', () => {
    resetForm();
    switchView('form');
});

btnCancel.addEventListener('click', () => {
    switchView('home');
});

function switchView(viewName) {
    if (viewName === 'home') {
        viewHome.classList.remove('hidden');
        viewForm.classList.add('hidden');
        btnHome.classList.add('active');
        btnAdd.classList.remove('active');
    } else {
        viewForm.classList.remove('hidden');
        viewHome.classList.add('hidden');
        btnAdd.classList.add('active');
        btnHome.classList.remove('active');
    }
}

// ==========================================
// Table Rendering & Filtering
// ==========================================
filterDate.addEventListener('change', (e) => {
    renderTable(e.target.value);
});

function renderTable(dateString) {
    const allOps = getOperations();

    // Filter by selected date
    let filteredOps = allOps;
    if (dateString) {
        filteredOps = allOps.filter(op => op.date === dateString);
    }

    // Sort based on currentSort state
    filteredOps.sort((a, b) => {
        let valA = a[currentSort.column];
        let valB = b[currentSort.column];

        // Fallbacks
        if (valA === undefined) valA = '';
        if (valB === undefined) valB = '';

        // Special handling for date and time sorting
        if (currentSort.column === 'date') {
            valA = new Date(a.date + (a.time ? 'T' + a.time : '')).getTime() || 0;
            valB = new Date(b.date + (b.time ? 'T' + b.time : '')).getTime() || 0;
        }

        if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
        return 0;
    });

    opsTableBody.innerHTML = '';

    if (filteredOps.length === 0) {
        emptyState.classList.remove('hidden');
        document.querySelector('.ops-table').classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        document.querySelector('.ops-table').classList.remove('hidden');

        filteredOps.forEach(op => {
            const tr = document.createElement('tr');

            // Format datetime
            let datetimeHTML = `<strong>${formatDate(op.date)}</strong>`;
            if (op.time) {
                datetimeHTML += `<br><span style="color:var(--text-muted); font-size:0.9em">${formatTime(op.time)}</span>`;
            }

            tr.innerHTML = `
                <td>${datetimeHTML}</td>
                <td><strong>${op.name}</strong></td>
                <td>${op.surgeon}</td>
                <td><span style="background:var(--primary-light); color:var(--primary-dark); padding:4px 8px; border-radius:4px; font-weight:bold;">${op.room}</span></td>
                <td>${op.notes || '-'}</td>
                <td>
                    <button class="action-btn btn-edit" onclick="editOperation('${op.id}')" title="تعديل">
                        <i class='bx bx-edit'></i>
                    </button>
                    <button class="action-btn btn-delete" onclick="promptDelete('${op.id}')" title="حذف">
                        <i class='bx bx-trash'></i>
                    </button>
                </td>
            `;
            opsTableBody.appendChild(tr);
        });
    }
}

// ==========================================
// Form Handling (Add/Edit)
// ==========================================
opForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // UI Loading state
    const submitBtn = opForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = "<i class='bx bx-loader bx-spin'></i> جاري الحفظ...";
    submitBtn.disabled = true;

    const newOp = {
        id: opId.value || generateId(),
        date: opDate.value,
        time: opTime.value,
        name: opName.value.trim(),
        surgeon: opSurgeon.value.trim(),
        room: opRoom.value,
        notes: opNotes.value.trim()
    };

    let success = false;
    try {
        success = await saveOperationToDB(newOp);
    } catch (error) {
        console.error('Unexpected error in submit handler:', error);
        showToast(`حدث خطأ غير متوقع: ${error.message}`, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }

    if (success) {
        showToast(opId.value ? 'تم تحديث بيانات العملية بنجاح' : 'تم إضافة العملية الجديدة بنجاح');

        // Switch back to home and filter to the date of the added/edited op
        filterDate.value = newOp.date;
        switchView('home');
    }
});

function editOperation(id) {
    const allOps = getOperations();
    const op = allOps.find(o => o.id === id);

    if (op) {
        opId.value = op.id;
        opDate.value = op.date;
        opTime.value = op.time || '';
        opName.value = op.name;
        opSurgeon.value = op.surgeon;
        opRoom.value = op.room;
        opNotes.value = op.notes || '';

        formTitle.innerHTML = `<i class='bx bx-edit'></i> تعديل العملية`;
        switchView('form');
    }
}

function resetForm() {
    opForm.reset();
    opId.value = '';
    // Default to selected filter date
    opDate.value = filterDate.value || new Date().toISOString().split('T')[0];
    formTitle.innerHTML = `<i class='bx bx-calendar-plus'></i> إضافة عملية جديدة`;
}

// ==========================================
// Deletion Handling
// ==========================================
function promptDelete(id) {
    deleteTargetId = id;
    deleteModal.classList.add('active');
}

closeModals.forEach(btn => {
    btn.addEventListener('click', () => {
        deleteModal.classList.remove('active');
        deleteTargetId = null;
    });
});

btnConfirmDelete.addEventListener('click', async () => {
    if (deleteTargetId) {
        // UI Loading state
        const originalText = btnConfirmDelete.innerHTML;
        btnConfirmDelete.innerHTML = "جاري الحذف...";
        btnConfirmDelete.disabled = true;

        const success = await removeOperationFromDB(deleteTargetId);

        btnConfirmDelete.innerHTML = originalText;
        btnConfirmDelete.disabled = false;

        if (success) {
            showToast('تم حذف العملية', 'error');
            deleteModal.classList.remove('active');
            deleteTargetId = null;
        }
    }
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
        deleteModal.classList.remove('active');
    }
});

// ==========================================
// Statistics
// ==========================================
function calculateStats() {
    const allOps = getOperations();
    const todayStr = new Date().toISOString().split('T')[0];

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let todayCount = 0;
    let monthCount = 0;

    allOps.forEach(op => {
        if (op.date === todayStr) {
            todayCount++;
        }

        const opDateObj = new Date(op.date);
        if (opDateObj.getMonth() === currentMonth && opDateObj.getFullYear() === currentYear) {
            monthCount++;
        }
    });

    document.getElementById('stat-today').innerText = todayCount;
    document.getElementById('stat-month').innerText = monthCount;
}

// ==========================================
// Utilities
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'warning' ? 'toast-warning' : 'toast-success'}`;

    let icon;
    if (type === 'success') {
        icon = "<i class='bx bx-check-circle' style='color:var(--success-color); font-size:1.5rem'></i>";
    } else if (type === 'warning') {
        icon = "<i class='bx bx-error-circle' style='color:var(--warning-color); font-size:1.5rem'></i>";
    } else {
        icon = "<i class='bx bx-error-circle' style='color:var(--danger-color); font-size:1.5rem'></i>";
    }

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => {
            container.removeChild(toast);
        }, 400); // 400ms matches transition time in CSS
    }, 3000);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ar-EG', options);
}

function formatTime(timeString) {
    if (!timeString) return '';
    // timeString is like "14:30"
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ==========================================
// Sorting feature
// ==========================================
function sortTable(column) {
    if (currentSort.column === column) {
        // Toggle order
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.order = 'asc';
    }

    // Update Icons in headers
    const headers = document.querySelectorAll('th.sortable i');
    headers.forEach(icon => {
        icon.className = 'bx bx-sort';
    });

    // Find the header that was clicked and set its icon
    const headerElement = document.querySelector(`th.sortable[onclick="sortTable('${column}')"] i`);
    if (headerElement) {
        if (currentSort.order === 'asc') {
            headerElement.className = 'bx bx-sort-up';
        } else {
            headerElement.className = 'bx bx-sort-down';
        }
    }

    renderTable(filterDate.value);
}

// ==========================================
// Export Features
// ==========================================
function exportToExcel() {
    const allOps = getOperations();
    const dateStr = filterDate.value;

    let filteredOps = allOps;
    if (dateStr) {
        filteredOps = allOps.filter(op => op.date === dateStr);
    }

    if (filteredOps.length === 0) {
        showToast('لا توجد بيانات للتصدير', 'error');
        return;
    }

    // Prepare data for Excel
    const excelData = filteredOps.map(op => ({
        "الوقت والتاريخ": formatDate(op.date) + (op.time ? ' ' + formatTime(op.time) : ''),
        "العملية": op.name,
        "الجراح": op.surgeon,
        "غرفة العمليات": op.room,
        "ملاحظات": op.notes || '-'
    }));

    // Create a worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Create a new workbook and add the worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "العمليات");

    // Convert to Excel file and trigger download
    XLSX.writeFile(workbook, `operations_${dateStr || 'all'}.xlsx`);
    showToast('تم تصدير الجدول إلى Excel');
}

function exportToPDF() {
    // 1. Easy way: Using window.print() and CSS @media print
    window.print();

    // 2. Alternatively, if html2pdf is specifically requested:
    /*
    const element = document.querySelector('.table-responsive');
    const opt = {
        margin:       1,
        filename:     'operations.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
    */
}

// ==========================================
// Expose functions globally for HTML inline handlers
// ==========================================
window.editOperation = editOperation;
window.promptDelete = promptDelete;
window.sortTable = sortTable;
window.exportToExcel = exportToExcel;
window.exportToPDF = exportToPDF;

