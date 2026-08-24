const API_BASE = 'http://localhost:5000/api';

const mappingFileInput = document.getElementById('mapping-file');
const dwlFileInput = document.getElementById('dwl-file');
const mappingFileName = document.getElementById('mapping-name');
const dwlFileName = document.getElementById('dwl-name');
const validateBtn = document.getElementById('validate-btn');
const resultsSection = document.getElementById('results-section');
const loadingDiv = document.getElementById('loading');
const tabBtns = document.querySelectorAll('.tab-btn');

// File input listeners
mappingFileInput.addEventListener('change', (e) => {
    const fileName = (e.target.files[0]) ? e.target.files[0].name : 'No file selected';
    mappingFileName.textContent = fileName;
    mappingFileName.classList.toggle('active', e.target.files.length > 0);
    updateValidateBtn();
});

dwlFileInput.addEventListener('change', (e) => {
    const fileName = (e.target.files[0]) ? e.target.files[0].name : 'No file selected';
    dwlFileName.textContent = fileName;
    dwlFileName.classList.toggle('active', e.target.files.length > 0);
    updateValidateBtn();
});

// Tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        switchTab(tabName, btn);
    });
});

// Validate button
validateBtn.addEventListener('click', handleValidate);

function updateValidateBtn() {
    const hasMapping = mappingFileInput.files.length > 0;
    const hasDwl = dwlFileInput.files.length > 0;
    validateBtn.disabled = !hasMapping || !hasDwl;
}

function switchTab(tabName, clickedBtn) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    clickedBtn.classList.add('active');
}

async function handleValidate() {
    const formData = new FormData();
    formData.append('mapping_file', mappingFileInput.files[0]);
    formData.append('dwl_file', dwlFileInput.files[0]);
    
    loadingDiv.style.display = 'block';
    resultsSection.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/validate`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Validation failed');
        }
        
        const result = await response.json();
        displayResults(result);
    } catch (error) {
        console.error('Error:', error);
        alert(`Error: ${error.message}`);
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function displayResults(result) {
    const summary = result.summary;
    const validations = result.validations;
    const errors = result.errors;
    const warnings = result.warnings;
    
    // Display summary
    const summaryHtml = `
        <h3>Summary</h3>
        <div class="summary-stats">
            <div class="stat">
                <div class="stat-value">${summary.total_mappings}</div>
                <div class="stat-label">Total Mappings</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #28a745;">${summary.passed}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #dc3545;">${summary.failed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #ffc107;">${summary.total_warnings}</div>
                <div class="stat-label">Warnings</div>
            </div>
        </div>
        <div style="text-align: center; margin-top: 15px;">
            <span class="status-badge ${summary.overall_status.toLowerCase()}">
                Overall: ${summary.overall_status}
            </span>
        </div>
    `;
    document.getElementById('summary').innerHTML = summaryHtml;
    
    // Display validations
    const validationsHtml = validations.length > 0 ? validations.map(v => `
        <div class="validation-item ${v.status.toLowerCase()}">
            <div class="validation-header">
                <span class="validation-field">📋 ${v.source_field}</span>
                <span class="validation-badge ${v.status.toLowerCase()}">${v.status}</span>
            </div>
            <div class="validation-message">${v.message}</div>
            ${v.xpath ? `<div class="validation-details"><strong>XPath:</strong> <code>${escapeHtml(v.xpath)}</code></div>` : ''}
            ${v.predicates ? `<div class="validation-details"><strong>Predicates:</strong><br>${v.predicates.map(p => `${p.field} = ${p.value}`).join('<br>')}</div>` : ''}
        </div>
    `).join('') : '<div class="empty-state"><p>No validations to display</p></div>';
    document.getElementById('validations').innerHTML = validationsHtml;
    
    // Display errors
    const errorsHtml = errors.length > 0 ? `
        <ul class="error-list">
            ${errors.map(e => `<li class="error-item">${escapeHtml(e)}</li>`).join('')}
        </ul>
    ` : '<div class="empty-state"><p>No errors found</p></div>';
    document.getElementById('errors').innerHTML = errorsHtml;
    
    // Display warnings
    const warningsHtml = warnings.length > 0 ? `
        <ul class="warning-list">
            ${warnings.map(w => `<li class="warning-item">${escapeHtml(w)}</li>`).join('')}
        </ul>
    ` : '<div class="empty-state"><p>No warnings found</p></div>';
    document.getElementById('warnings').innerHTML = warningsHtml;
    
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
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
