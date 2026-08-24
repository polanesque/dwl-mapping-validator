const API_BASE = 'http://localhost:5000/api';

// DOM Elements - Upload Step
const fileInput = document.getElementById('file-input');
const fileName = document.getElementById('file-name');
const uploadStep = document.getElementById('step-upload');
const configStep = document.getElementById('step-config');
const dwlUploadStep = document.getElementById('step-dwl-upload');
const validationModeStep = document.getElementById('step-validation-mode');
const resultsStep = document.getElementById('step-results');
const loadingDiv = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');

// DOM Elements - Config Step
const sourceColumnSelect = document.getElementById('source-column');
const targetColumnSelect = document.getElementById('target-column');
const startRowInput = document.getElementById('start-row');
const previewTable = document.getElementById('preview-table');

// DOM Elements - DWL Upload Step
const dwlFileInput = document.getElementById('dwl-file-input');
const dwlFileName = document.getElementById('dwl-file-name');
const dwlPreviewSection = document.getElementById('dwl-preview-section');
const dwlPreviewBox = document.getElementById('dwl-preview-box');
const validateDwlBtn = document.getElementById('validate-dwl-btn');

// DOM Elements - Buttons
const backBtn = document.getElementById('back-btn');
const nextDwlBtn = document.getElementById('next-dwl-btn');
const backDwlBtn = document.getElementById('back-dwl-btn');
const backModeBtn = document.getElementById('back-mode-btn');
const validateMappingOnlyBtn = document.getElementById('validate-mapping-only-btn');
const validateWithDwlBtn = document.getElementById('validate-with-dwl-btn');
const startOverBtn = document.getElementById('start-over-btn');

// State
let currentFile = null;
let currentDwlFile = null;
let columns = [];
let validationMode = null; // 'mapping-only' or 'with-dwl'

// File upload handling
fileInput.addEventListener('change', handleFileSelect);
dwlFileInput.addEventListener('change', handleDwlFileSelect);

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
        loadDwlPreview(file);
        validateDwlBtn.disabled = false;
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

function loadDwlPreview(file) {
    try {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const text = e.target.result;
            const lines = text.split('\n');
            const previewLines = lines.slice(0, 20).join('\n');
            const hasMoreLines = lines.length > 20;
            
            dwlPreviewBox.innerHTML = `<pre>${escapeHtml(previewLines)}${hasMoreLines ? '\n... (truncated)' : ''}</pre>`;
            dwlPreviewSection.style.display = 'block';
        };
        
        reader.onerror = function() {
            throw new Error('Failed to read file');
        };
        
        reader.readAsText(file);
    } catch (error) {
        alert(`Error reading DWL file: ${error.message}`);
        dwlFileInput.value = '';
        dwlFileName.textContent = '';
        currentDwlFile = null;
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

// Step Navigation
backBtn.addEventListener('click', () => {
    uploadStep.style.display = 'block';
    configStep.style.display = 'none';
    fileInput.value = '';
    fileName.textContent = '';
    currentFile = null;
});

nextDwlBtn.addEventListener('click', () => {
    configStep.style.display = 'none';
    dwlUploadStep.style.display = 'block';
});

backDwlBtn.addEventListener('click', () => {
    configStep.style.display = 'block';
    dwlUploadStep.style.display = 'none';
    dwlFileInput.value = '';
    dwlFileName.textContent = '';
    currentDwlFile = null;
    dwlPreviewSection.style.display = 'none';
    validateDwlBtn.disabled = true;
});

backModeBtn.addEventListener('click', () => {
    dwlUploadStep.style.display = 'block';
    validationModeStep.style.display = 'none';
});

validateMappingOnlyBtn.addEventListener('click', async () => {
    validationMode = 'mapping-only';
    await handleValidateMappingOnly();
});

validateWithDwlBtn.addEventListener('click', async () => {
    validationMode = 'with-dwl';
    await handleValidateWithDwl();
});

validateDwlBtn.addEventListener('click', () => {
    validationModeStep.style.display = 'block';
    dwlUploadStep.style.display = 'none';
});

startOverBtn.addEventListener('click', () => {
    uploadStep.style.display = 'block';
    configStep.style.display = 'none';
    dwlUploadStep.style.display = 'none';
    validationModeStep.style.display = 'none';
    resultsStep.style.display = 'none';
    fileInput.value = '';
    fileName.textContent = '';
    dwlFileInput.value = '';
    dwlFileName.textContent = '';
    currentFile = null;
    currentDwlFile = null;
    validationMode = null;
    dwlPreviewSection.style.display = 'none';
    validateDwlBtn.disabled = true;
});

async function handleValidateMappingOnly() {
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
    loadingText.textContent = 'Validating mapping...';
    
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
        displayMappingResults(result);
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        loadingDiv.style.display = 'none';
    }
}

async function handleValidateWithDwl() {
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
    
    if (!currentDwlFile) {
        alert('Please select a DWL file');
        return;
    }
    
    const formData = new FormData();
    formData.append('mapping_file', currentFile);
    formData.append('dwl_file', currentDwlFile);
    formData.append('source_column', sourceColumn);
    formData.append('target_column', targetColumn);
    formData.append('start_row', startRow);
    
    loadingDiv.style.display = 'block';
    loadingText.textContent = 'Validating against DWL...';
    
    try {
        const response = await fetch(`${API_BASE}/validate-against-dwl`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error);
        }
        
        const result = await response.json();
        displayDwlValidationResults(result);
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function displayMappingResults(result) {
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
    document.getElementById('validation-type-badge').innerHTML = '<span class="info-badge">📋 Mapping Only Validation</span>';
    
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
    
    // Hide DWL results section
    document.getElementById('dwl-results-section').style.display = 'none';
    
    validationModeStep.style.display = 'none';
    resultsStep.style.display = 'block';
}

function displayDwlValidationResults(result) {
    // Display summary
    const summaryHtml = `
        <h3>Summary</h3>
        <div class="summary-stats">
            <div class="stat">
                <div class="stat-value">${result.total_mappings}</div>
                <div class="stat-label">Total Mappings</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #28a745;">${result.source_fields.found + result.target_fields.found}</div>
                <div class="stat-label">Fields Found in DWL</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #dc3545;">${result.source_fields.not_found + result.target_fields.not_found}</div>
                <div class="stat-label">Fields Not Found</div>
            </div>
        </div>
        <div style="text-align: center; margin-top: 10px;">
            <span class="status-badge ${result.validation_status.toLowerCase()}">
                ${result.validation_status}
            </span>
        </div>
    `;
    document.getElementById('summary').innerHTML = summaryHtml;
    document.getElementById('validation-type-badge').innerHTML = '<span class="info-badge">⚙️ DWL Script Validation</span>';
    
    // Hide basic mapping section
    document.getElementById('mapped-section').style.display = 'none';
    document.getElementById('unmapped-section').style.display = 'none';
    
    // Show DWL results section
    const dwlResultsSection = document.getElementById('dwl-results-section');
    dwlResultsSection.style.display = 'block';
    
    // Display source fields found
    const sourceFoundSection = document.getElementById('source-found-section');
    if (result.source_fields.found > 0) {
        sourceFoundSection.style.display = 'block';
        const sourceFoundHtml = result.source_fields.found_list.map(item => `
            <div class="result-item">
                <span class="result-item-field">${escapeHtml(item.field)}</span>
                <span class="result-item-row">(Row ${item.row})</span>
            </div>
        `).join('');
        document.getElementById('source-found-list').innerHTML = sourceFoundHtml;
        document.getElementById('source-found-count').textContent = result.source_fields.found;
    } else {
        sourceFoundSection.style.display = 'none';
    }
    
    // Display source fields not found
    const sourceNotFoundSection = document.getElementById('source-not-found-section');
    if (result.source_fields.not_found > 0) {
        sourceNotFoundSection.style.display = 'block';
        const sourceNotFoundHtml = result.source_fields.not_found_list.map(item => `
            <div class="result-item">
                <span class="result-item-field" style="color: #dc3545; font-weight: 500;">${escapeHtml(item.field)}</span>
                <span class="result-item-row">(Row ${item.row})</span>
            </div>
        `).join('');
        document.getElementById('source-not-found-list').innerHTML = sourceNotFoundHtml;
        document.getElementById('source-not-found-count').textContent = result.source_fields.not_found;
    } else {
        sourceNotFoundSection.style.display = 'none';
    }
    
    // Display target fields found
    const targetFoundSection = document.getElementById('target-found-section');
    if (result.target_fields.found > 0) {
        targetFoundSection.style.display = 'block';
        const targetFoundHtml = result.target_fields.found_list.map(item => `
            <div class="result-item">
                <span class="result-item-field">${escapeHtml(item.field)}</span>
                <span class="result-item-row">(Row ${item.row})</span>
            </div>
        `).join('');
        document.getElementById('target-found-list').innerHTML = targetFoundHtml;
        document.getElementById('target-found-count').textContent = result.target_fields.found;
    } else {
        targetFoundSection.style.display = 'none';
    }
    
    // Display target fields not found
    const targetNotFoundSection = document.getElementById('target-not-found-section');
    if (result.target_fields.not_found > 0) {
        targetNotFoundSection.style.display = 'block';
        const targetNotFoundHtml = result.target_fields.not_found_list.map(item => `
            <div class="result-item">
                <span class="result-item-field" style="color: #dc3545; font-weight: 500;">${escapeHtml(item.field)}</span>
                <span class="result-item-row">(Row ${item.row})</span>
            </div>
        `).join('');
        document.getElementById('target-not-found-list').innerHTML = targetNotFoundHtml;
        document.getElementById('target-not-found-count').textContent = result.target_fields.not_found;
    } else {
        targetNotFoundSection.style.display = 'none';
    }
    
    validationModeStep.style.display = 'none';
    resultsStep.style.display = 'block';
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
