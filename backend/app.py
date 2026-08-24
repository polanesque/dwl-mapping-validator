from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename
from mapping_validator import MappingValidator
import tempfile

app = Flask(__name__)
CORS(app)

ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'csv'}
DWL_EXTENSIONS = {'dwl', 'txt'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def allowed_dwl_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in DWL_EXTENSIONS

@app.route('/api/preview', methods=['POST'])
def preview_file():
    """
    Preview uploaded mapping document to show columns and data.
    Returns first 10 rows and list of all columns.
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'File is required'}), 400
        
        file = request.files['file']
        
        if not file.filename:
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': f'Invalid file format. Allowed: xlsx, xls, csv. Got: {file.filename}'}), 400
        
        # Get file extension from original filename
        _, ext = os.path.splitext(file.filename)
        
        # Save to temporary file with proper extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tf:
            file.save(tf.name)
            temp_path = tf.name
        
        try:
            validator = MappingValidator(temp_path)
            preview = validator.get_preview()
            return jsonify(preview), 200
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/validate', methods=['POST'])
def validate_mapping():
    """
    Validate the mapping with user-specified configuration.
    Expects multipart form data with:
    - file: mapping document (file upload)
    - source_column: column name for source fields
    - target_column: column name for target fields
    - start_row: which row to start from (1-indexed)
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'File is required'}), 400
        
        file = request.files['file']
        source_column = request.form.get('source_column')
        target_column = request.form.get('target_column')
        start_row = int(request.form.get('start_row', 1))
        
        if not file.filename:
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': f'Invalid file format. Allowed: xlsx, xls, csv. Got: {file.filename}'}), 400
        
        if not source_column or not target_column:
            return jsonify({'error': 'source_column and target_column are required'}), 400
        
        # Get file extension from original filename
        _, ext = os.path.splitext(file.filename)
        
        # Save to temporary file with proper extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tf:
            file.save(tf.name)
            temp_path = tf.name
        
        try:
            validator = MappingValidator(temp_path)
            result = validator.validate(source_column, target_column, start_row)
            return jsonify(result), 200
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/validate-against-dwl', methods=['POST'])
def validate_against_dwl():
    """
    Validate Excel mapping document against a DWL file.
    Checks if all source and target fields are referenced in the DWL.
    
    Expects multipart form data with:
    - mapping_file: Excel mapping document
    - dwl_file: DWL transformation script
    - source_column: column name for source fields
    - target_column: column name for target fields
    - start_row: which row to start from (1-indexed)
    """
    try:
        if 'mapping_file' not in request.files:
            return jsonify({'error': 'mapping_file is required'}), 400
        
        if 'dwl_file' not in request.files:
            return jsonify({'error': 'dwl_file is required'}), 400
        
        mapping_file = request.files['mapping_file']
        dwl_file = request.files['dwl_file']
        source_column = request.form.get('source_column')
        target_column = request.form.get('target_column')
        start_row = int(request.form.get('start_row', 1))
        
        if not mapping_file.filename:
            return jsonify({'error': 'No mapping file selected'}), 400
        
        if not dwl_file.filename:
            return jsonify({'error': 'No DWL file selected'}), 400
        
        if not allowed_file(mapping_file.filename):
            return jsonify({'error': f'Invalid mapping file format. Allowed: xlsx, xls, csv'}), 400
        
        if not allowed_dwl_file(dwl_file.filename):
            return jsonify({'error': f'Invalid DWL file format. Allowed: dwl, txt'}), 400
        
        if not source_column or not target_column:
            return jsonify({'error': 'source_column and target_column are required'}), 400
        
        # Get file extensions from original filenames
        _, mapping_ext = os.path.splitext(mapping_file.filename)
        _, dwl_ext = os.path.splitext(dwl_file.filename)
        
        # Save to temporary files with proper extensions
        with tempfile.NamedTemporaryFile(delete=False, suffix=mapping_ext) as tf:
            mapping_file.save(tf.name)
            mapping_path = tf.name
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=dwl_ext) as tf:
            dwl_file.save(tf.name)
            dwl_path = tf.name
        
        try:
            # Read DWL file content
            with open(dwl_path, 'r', encoding='utf-8') as f:
                dwl_content = f.read()
            
            # Validate
            validator = MappingValidator(mapping_path)
            result = validator.validate_against_dwl(source_column, target_column, dwl_content, start_row)
            return jsonify(result), 200
        finally:
            if os.path.exists(mapping_path):
                os.remove(mapping_path)
            if os.path.exists(dwl_path):
                os.remove(dwl_path)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
