const API_BASE = 'http://localhost:5000/api';

// DOM Elements
const fileInput = document.getElementById('file-input');
const fileName = document.getElementById('file-name');
const dwlFileInput = document.getElementById('dwl-file-input');
const dwlFileName = document.getElementById('dwl-file-name');
const configSection = document.getElementById('config-section');
const resultsSection = document.getElementById('results-section');
const loadingDiv = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');

// Config Elements
const sourceColumnSelect = document.getElementById('source-column');
const targetColumnSelect = document.getElementById('target-column');
const startRowInput = document.getElementById('start-row');
const validateBtn = document.getElementById('validate-btn');
const newValidationBtn = document.getElementById('new-validation-btn');

// State
let currentFile = null;
let currentDwlFile = null;
let columns = [];
let hasDwlFile = false;

// File upload handling
fileInput.addEventListener('change', handleFileSelect);
dwlFileInput.addEventListener('change', handleDwlFileSelect);
validateBtn.addEventListener('click', handleValidate);
newValidationBtn.addEventListener('click', resetForm);

// Tab handling
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        switchTab(tabName);
    });
});

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        currentFile = file;
        fileName.textContent = file.name;
        loadPreview(file);
    }
}

function handleDwlFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        currentDwlFile = file;
        dwlFileName.textContent = file.name;
        hasDwlFile = true;
    }
}

async function loadPreview(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    loadingDiv.style.display = 'block';
    loadingText.textContent = 'Loading preview...';
    
    try {
        const response = await fetch(`${API_BASE}/preview`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        const result = await response.json();
        columns = result.columns;
        
        // Populate column selectors
        populateColumnSelects(columns);
        
        // Show config section
        configSection.style.display = 'block';
    } catch (error) {
        alert(`Error: ${error.message}`);
        fileInput.value = '';
        fileName.textContent = 'Choose file';
        currentFile = null;
        configSection.style.display = 'none';
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function populateColumnSelects(cols) {
    sourceColumnSelect.innerHTML = '';
    targetColumnSelect.innerHTML = '';
    
    cols.forEach(col => {
        const opt1 = document.createElement('option');
        opt1.value = col;
        opt1.textContent = col;
        sourceColumnSelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = col;
        opt2.textContent = col;
        targetColumnSelect.appendChild(opt2);
    });
    
    // Default: if columns exist, set first as source, second as target
    if (cols.length >= 2) {
        sourceColumnSelect.value = cols[0];
        targetColumnSelect.value = cols[1];
    }
}

async function handleValidate() {
    const sourceColumn = sourceColumnSelect.value;
    const targetColumn = targetColumnSelect.value;
    const startRow = parseInt(startRowInput.value);
    
    if (!sourceColumn || !targetColumn) {
        alert('Please select both source and target columns');
        return;
    }
    
    if (isNaN(startRow) || startRow < 1) {
        alert('Please enter a valid start row');
        return;
    }
    
    if (hasDwlFile && !currentDwlFile) {
        alert('DWL file was selected but not loaded');
        return;
    }
    
    loadingDiv.style.display = 'block';
    loadingText.textContent = hasDwlFile ? 'Validating against DWL...' : 'Validating mapping...';
    
    try {
        const formData = new FormData();
        formData.append('file', currentFile);
        formData.append('source_column', sourceColumn);
        formData.append('target_column', targetColumn);
        formData.append('start_row', startRow);
        
        let endpoint = `${API_BASE}/validate`;
        if (hasDwlFile) {
            endpoint = `${API_BASE}/validate-against-dwl`;
            formData.set('mapping_file', currentFile);
            formData.append('dwl_file', currentDwlFile);
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        const result = await response.json();
        displayResults(result);
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function displayResults(result) {
    // Clear previous results
    document.getElementById('mapped-list').innerHTML = '';
    document.getElementById('unmapped-list').innerHTML = '';
    document.getElementById('source-found-list').innerHTML = '';
    document.getElementById('source-not-found-list').innerHTML = '';
    document.getElementById('target-found-list').innerHTML = '';
    document.getElementById('target-not-found-list').innerHTML = '';
    
    // Show/hide DWL tab
    const dwlTab = document.getElementById('dwl-tab');
    if (hasDwlFile) {
        dwlTab.style.display = 'block';
        displayDwlResults(result);
    } else {
        dwlTab.style.display = 'none';
        displayMappingResults(result);
    }
    
    // Show results section and reset to first tab
    resultsSection.style.display = 'block';
    switchTab('mapped');
}

function displayMappingResults(result) {
    // Mapped fields
    const mappedList = document.getElementById('mapped-list');
    if (result.mapped && result.mapped.length > 0) {
        mappedList.innerHTML = result.mapped.map(m => `
            <div class="field-item">
                <div class="field-header">
                    <span class="field-name">${escapeHtml(m.source)}</span>
                    <span class="field-arrow">→</span>
                    <span class="field-name">${escapeHtml(m.target)}</span>
                </div>
                <div class="field-details">Row ${m.row}</div>
            </div>
        `).join('');
    } else {
        mappedList.innerHTML = '<div class="empty-state">No mapped fields found</div>';
    }
    
    // Unmapped fields
    const unmappedList = document.getElementById('unmapped-list');
    if (result.unmapped && result.unmapped.length > 0) {
        unmappedList.innerHTML = result.unmapped.map(u => `
            <div class="field-item error">
                <div class="field-header">
                    <span class="field-name">${escapeHtml(u.source)}</span>
                    <span class="field-arrow">→</span>
                    <span class="field-name" style="color: #dc3545;">⚠️ ${escapeHtml(u.target)}</span>
                </div>
                <div class="field-details">Row ${u.row}</div>
            </div>
        `).join('');
    } else {
        unmappedList.innerHTML = '<div class="empty-state">No unmapped fields</div>';
    }
}

function displayDwlResults(result) {
    // Source fields found
    const sourceFoundList = document.getElementById('source-found-list');
    if (result.source_fields.found_list && result.source_fields.found_list.length > 0) {
        sourceFoundList.innerHTML = result.source_fields.found_list.map(item => `
            <div class="field-item">
                <div class="field-header">
                    <span class="field-name">${escapeHtml(item.field)}</span>
                </div>
                <div class="field-details">Row ${item.row}</div>
            </div>
        `).join('');
    } else {
        sourceFoundList.innerHTML = '<div class="empty-state">No source fields found in DWL</div>';
    }
    
    // Source fields not found
    const sourceNotFoundList = document.getElementById('source-not-found-list');
    if (result.source_fields.not_found_list && result.source_fields.not_found_list.length > 0) {
        sourceNotFoundList.innerHTML = result.source_fields.not_found_list.map(item => `
            <div class="field-item error">
                <div class="field-header">
                    <span class="field-name">⚠️ ${escapeHtml(item.field)}</span>
                </div>
                <div class="field-details">Row ${item.row}</div>
            </div>
        `).join('');
    } else {
        sourceNotFoundList.innerHTML = '<div class="empty-state">All source fields found</div>';
    }
    
    // Target fields found
    const targetFoundList = document.getElementById('target-found-list');
    if (result.target_fields.found_list && result.target_fields.found_list.length > 0) {
        targetFoundList.innerHTML = result.target_fields.found_list.map(item => `
            <div class="field-item">
                <div class="field-header">
                    <span class="field-name">${escapeHtml(item.field)}</span>
                </div>
                <div class="field-details">Row ${item.row}</div>
            </div>
        `).join('');
    } else {
        targetFoundList.innerHTML = '<div class="empty-state">No target fields found in DWL</div>';
    }
    
    // Target fields not found
    const targetNotFoundList = document.getElementById('target-not-found-list');
    if (result.target_fields.not_found_list && result.target_fields.not_found_list.length > 0) {
        targetNotFoundList.innerHTML = result.target_fields.not_found_list.map(item => `
            <div class="field-item error">
                <div class="field-header">
                    <span class="field-name">⚠️ ${escapeHtml(item.field)}</span>
                </div>
                <div class="field-details">Row ${item.row}</div>
            </div>
        `).join('');
    } else {
        targetNotFoundList.innerHTML = '<div class="empty-state">All target fields found</div>';
    }
}

function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked button
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

function resetForm() {
    fileInput.value = '';
    fileName.textContent = 'Choose file';
    dwlFileInput.value = '';
    dwlFileName.textContent = 'Choose file';
    currentFile = null;
    currentDwlFile = null;
    hasDwlFile = false;
    columns = [];
    configSection.style.display = 'none';
    resultsSection.style.display = 'none';
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
