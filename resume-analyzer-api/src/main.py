import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))  # DON'T CHANGE THIS !!!

from flask import Flask, request, jsonify # type: ignore
from flask_cors import CORS # type: ignore
import os
from werkzeug.utils import secure_filename # type: ignore
import tempfile
import json

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}} ) # Enable CORS for all routes

# Configure upload settings
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), 'resume_uploads')
ALLOWED_EXTENSIONS = {'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Import routes
from src.routes.analyzer import analyzer_bp

# Register blueprints
app.register_blueprint(analyzer_bp, url_prefix='/api/analyzer')

@app.route('/')
def index():
    return jsonify({
        "status": "success",
        "message": "Resume Analyzer API is running",
        "version": "1.0.0"
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
