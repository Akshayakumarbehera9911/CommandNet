from flask import Blueprint, render_template, request, jsonify, send_file, session, redirect, url_for
from werkzeug.utils import secure_filename
import os
import json
import uuid
import zipfile
import tempfile
from datetime import datetime
import threading

# Import with error handling
try:
    from .models import CamouflageDetectionModel
except ImportError:
    try:
        from features.feature6.models import CamouflageDetectionModel
    except ImportError:
        print("Error: Could not import CamouflageDetectionModel")
        raise

feature6_bp = Blueprint('feature6', __name__, 
                       url_prefix='/feature6',
                       template_folder='templates',
                       static_folder='static')

# Configuration
UPLOAD_FOLDER = 'uploads/feature6'
PROCESSED_FOLDER = 'static/processed/feature6'
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB per file
MAX_TOTAL_SIZE = 200 * 1024 * 1024  # 200MB total per session

# Create required directories at startup
def create_feature6_directories():
    directories = [
        UPLOAD_FOLDER,
        PROCESSED_FOLDER,
        'static/processed/feature6'
    ]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)

# Create directories
create_feature6_directories()
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

def cleanup_all_files():
    """Clean up all uploaded and processed files on startup"""
    try:
        import shutil
        if os.path.exists(UPLOAD_FOLDER):
            shutil.rmtree(UPLOAD_FOLDER)
        if os.path.exists(PROCESSED_FOLDER):
            shutil.rmtree(PROCESSED_FOLDER)
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(PROCESSED_FOLDER, exist_ok=True)
        print("Feature 6: All files cleaned up on startup")
    except Exception as e:
        print(f"Feature 6 cleanup error: {e}")

# Initialize camouflage detection model with error handling
try:
    detection_model = CamouflageDetectionModel()
    print("✅ Feature 6: Camouflage detection model initialized successfully")
except Exception as e:
    print(f"❌ Feature 6: Error initializing camouflage detection model: {e}")
    detection_model = None

# Clean up all files on startup
cleanup_all_files()

def allowed_file(filename):
    return any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS)

def get_file_size(file_path):
    return os.path.getsize(file_path)

def cleanup_session_files(session_id):
    """Clean up files for a specific session"""
    try:
        session_folder = os.path.join(UPLOAD_FOLDER, session_id)
        processed_folder = os.path.join(PROCESSED_FOLDER, session_id)
        
        if os.path.exists(session_folder):
            for file in os.listdir(session_folder):
                os.remove(os.path.join(session_folder, file))
            os.rmdir(session_folder)
        
        if os.path.exists(processed_folder):
            for file in os.listdir(processed_folder):
                os.remove(os.path.join(processed_folder, file))
            os.rmdir(processed_folder)
    except Exception as e:
        print(f"Feature 6 cleanup error: {e}")

# =====================================================
# MAIN ROUTES
# =====================================================

@feature6_bp.route('/')
def index():
    if 'username' not in session or 'role' not in session:
        return redirect(url_for('login'))
    
    if session['role'] not in ['captain', 'soldier']:
        return render_template('403.html'), 403
    
    return render_template('feature6.html')

# =====================================================
# IMAGE UPLOAD AND PROCESSING ROUTES
# =====================================================

@feature6_bp.route('/upload_images', methods=['POST'])
def upload_images():
    if 'username' not in session or session['role'] not in ['captain', 'soldier']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        files = request.files.getlist('images')
        if not files:
            return jsonify({'error': 'No files uploaded'}), 400
        
        session_id = str(uuid.uuid4())
        session_folder = os.path.join(UPLOAD_FOLDER, session_id)
        os.makedirs(session_folder, exist_ok=True)
        
        uploaded_files = []
        total_size = 0
        
        for file in files:
            if file.filename == '':
                continue
            
            if not allowed_file(file.filename):
                return jsonify({'error': f'File type not allowed: {file.filename}'}), 400
            
            filename = secure_filename(file.filename)
            temp_path = os.path.join(session_folder, filename)
            file.save(temp_path)
            
            file_size = get_file_size(temp_path)
            
            if file_size > MAX_FILE_SIZE:
                os.remove(temp_path)
                cleanup_session_files(session_id)
                return jsonify({'error': f'File too large: {filename} ({file_size/1024/1024:.1f}MB > 50MB)'}), 400
            
            total_size += file_size
            if total_size > MAX_TOTAL_SIZE:
                cleanup_session_files(session_id)
                return jsonify({'error': f'Total upload size too large ({total_size/1024/1024:.1f}MB > 200MB)'}), 400
            
            uploaded_files.append(temp_path)
        
        if not uploaded_files:
            cleanup_session_files(session_id)
            return jsonify({'error': 'No valid files uploaded'}), 400
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'uploaded_count': len(uploaded_files),
            'total_size_mb': round(total_size / 1024 / 1024, 2)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@feature6_bp.route('/process_images', methods=['POST'])
def process_images():
    if 'username' not in session or session['role'] not in ['captain', 'soldier']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if detection_model is None:
        return jsonify({'error': 'Camouflage detection model not available'}), 500
    
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({'error': 'No session ID provided'}), 400
        
        # Get uploaded files
        session_folder = os.path.join(UPLOAD_FOLDER, session_id)
        if not os.path.exists(session_folder):
            return jsonify({'error': 'Session not found'}), 404
        
        image_files = []
        for filename in os.listdir(session_folder):
            if allowed_file(filename):
                image_files.append(os.path.join(session_folder, filename))
        
        if not image_files:
            return jsonify({'error': 'No valid images found'}), 400
        
        # Process images with camouflage detection
        results = detection_model.process_images_web(image_files, session_id)
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =====================================================
# DOWNLOAD ROUTES
# =====================================================

@feature6_bp.route('/download_image/<session_id>/<filename>')
def download_image(session_id, filename):
    if 'username' not in session or session['role'] not in ['captain', 'soldier']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        processed_folder = os.path.join(PROCESSED_FOLDER, session_id)
        file_path = os.path.join(processed_folder, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(file_path, as_attachment=True)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@feature6_bp.route('/download_all_images/<session_id>')
def download_all_images(session_id):
    if 'username' not in session or session['role'] not in ['captain', 'soldier']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        processed_folder = os.path.join(PROCESSED_FOLDER, session_id)
        
        if not os.path.exists(processed_folder):
            return jsonify({'error': 'Session not found'}), 404
        
        zip_path = os.path.join(tempfile.gettempdir(), f'camouflage_detected_images_{session_id}.zip')
        
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for filename in os.listdir(processed_folder):
                if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp')):
                    file_path = os.path.join(processed_folder, filename)
                    zipf.write(file_path, filename)
        
        return send_file(zip_path, as_attachment=True, download_name=f'camouflage_detected_images_{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =====================================================
# CLEANUP ROUTES
# =====================================================

@feature6_bp.route('/cleanup_session/<session_id>', methods=['POST'])
def cleanup_session(session_id):
    if 'username' not in session or session['role'] not in ['captain', 'soldier']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        cleanup_session_files(session_id)
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500