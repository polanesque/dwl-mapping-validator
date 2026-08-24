from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename
from mapping_validator import MappingValidator
import tempfile

app = Flask(__name__)
CORS(app)

ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'csv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file format. Allowed: xlsx, xls, csv'}), 400
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False) as tf:
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
    Expects JSON with:
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
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file format'}), 400
        
        if not source_column or not target_column:
            return jsonify({'error': 'source_column and target_column are required'}), 400
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False) as tf:
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

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
