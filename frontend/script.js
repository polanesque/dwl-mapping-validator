const API_BASE = 'http://localhost:5000/api';

const fileInput = document.getElementById('file-input');
const fileName = document.getElementById('file-name');
const uploadStep = document.getElementById('step-upload');
const configStep = document.getElementById('step-config');
const resultsStep = document.getElementById('step-results');
const loadingDiv = document.getElementById('loading');

const sourceColumnSelect = document.getElementById('source-column');
const targetColumnSelect = document.getElementById('target-column');
const startRowInput = document.getElementById('start-row');
const previewTable = document.getElementById('preview-table');

const backBtn = document.getElementById('back-btn');
const validateBtn = document.getElementById('validate-btn');
const startOverBtn = document.getElementById('start-over-btn');

let currentFile = null;
let columns = [];

// File upload handling
fileInput.addEventListener('change', handleFileSelect);

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        currentFile = file;
        fileName.textContent = file.name;
        loadPreview(file);
    }
}

async function loadPreview(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    loadingDiv.style.display = 'block';
    
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
        
        // Show preview
        showPreview(result.preview, columns);
        
        // Move to config step
        uploadStep.style.display = 'none';
        configStep.style.display = 'block';
    } catch (error) {
        alert(`Error: ${error.message}`);
        fileInput.value = '';
        fileName.textContent = '';
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

function showPreview(rows, cols) {
    let html = '<table class="preview-table"><thead><tr>';
    
    cols.forEach(col => {
        html += `<th>${escapeHtml(col)}</th>`;
    });
    
    html += '</tr></thead><tbody>';
    
    rows.forEach((row, idx) => {
        html += '<tr>';
        cols.forEach(col => {
            const value = row[col] || '';
            html += `<td>${escapeHtml(String(value))}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    previewTable.innerHTML = html;
}

backBtn.addEventListener('click', () => {
    uploadStep.style.display = 'block';
    configStep.style.display = 'none';
    fileInput.value = '';
    fileName.textContent = '';
    currentFile = null;
});

validateBtn.addEventListener('click', handleValidate);

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
    
    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('source_column', sourceColumn);
    formData.append('target_column', targetColumn);
    formData.append('start_row', startRow);
    
    loadingDiv.style.display = 'block';
    
    try {
        const response = await fetch(`${API_BASE}/validate`, {
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
    // Display summary
    const summaryHtml = `
        <h3>Summary</h3>
        <div class="summary-stats">
            <div class="stat">
                <div class="stat-value">${result.total_fields}</div>
                <div class="stat-label">Total Fields</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #28a745;">${result.mapped_count}</div>
                <div class="stat-label">Mapped</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #dc3545;">${result.unmapped_count}</div>
                <div class="stat-label">Unmapped</div>
            </div>
        </div>
        <div style="text-align: center; margin-top: 10px;">
            <span class="status-badge ${result.validation_status.toLowerCase()}">
                ${result.validation_status}
            </span>
        </div>
    `;
    document.getElementById('summary').innerHTML = summaryHtml;
    
    // Display mapped fields
    const mappedHtml = result.mapped.length > 0 ? result.mapped.map(m => `
        <div class="result-item">
            <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span class="result-item-source">${escapeHtml(m.source)}</span>
                <span class="result-item-arrow">→</span>
                <span class="result-item-target">${escapeHtml(m.target)}</span>
                <span class="result-item-row">(Row ${m.row})</span>
            </div>
        </div>
    `).join('') : '<div class="empty-state">No mapped fields</div>';
    document.getElementById('mapped-list').innerHTML = mappedHtml;
    document.getElementById('mapped-count').textContent = result.mapped_count;
    
    // Display unmapped fields (if any)
    const unmappedSection = document.getElementById('unmapped-section');
    if (result.unmapped_count > 0) {
        unmappedSection.style.display = 'block';
        const unmappedHtml = result.unmapped.map(u => `
            <div class="result-item">
                <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span class="result-item-source">${escapeHtml(u.source)}</span>
                    <span class="result-item-arrow">→</span>
                    <span class="result-item-target" style="color: #dc3545; font-weight: 500;">${escapeHtml(u.target)}</span>
                    <span class="result-item-row">(Row ${u.row})</span>
                </div>
            </div>
        `).join('');
        document.getElementById('unmapped-list').innerHTML = unmappedHtml;
        document.getElementById('unmapped-count').textContent = result.unmapped_count;
    } else {
        unmappedSection.style.display = 'none';
    }
    
    configStep.style.display = 'none';
    resultsStep.style.display = 'block';
}

startOverBtn.addEventListener('click', () => {
    uploadStep.style.display = 'block';
    configStep.style.display = 'none';
    resultsStep.style.display = 'none';
    fileInput.value = '';
    fileName.textContent = '';
    currentFile = null;
});

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
