from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, send_file
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
import zipfile
import io
from .models import UAVDetector

feature2_bp = Blueprint('feature2', __name__, template_folder='templates')

# Configuration
UPLOAD_FOLDER = 'static/uploads/feature2'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB per file

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def ensure_upload_dir():
    """Ensure upload directory exists"""
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)

@feature2_bp.route('/feature2')
def feature2_main():
    """Main Feature 2 page - Captain only"""
    if 'username' not in session:
        return redirect(url_for('login'))
    
    if session.get('role') not in ['captain', 'soldier', 'commander']:
        return redirect(url_for('dashboard')), 403
    
    return render_template('feature2.html')

@feature2_bp.route('/feature2/debug-session')
def debug_session():
    """Debug route to check session state"""
    return jsonify({
        'session': dict(session),
        'username': session.get('username'),
        'role': session.get('role'),
        'session_keys': list(session.keys()),
        'has_username': 'username' in session,
        'role_check': session.get('role') in ['captain', 'soldier', 'commander']
    })

@feature2_bp.route('/feature2/upload', methods=['POST'])
def upload_images():
    """Handle multiple image uploads and process with YOLO"""
    print("=" * 50)
    print("UPLOAD REQUEST DEBUG")
    print("=" * 50)
    print(f"Session contents: {dict(session)}")
    print(f"Username in session: {session.get('username', 'NOT_FOUND')}")
    print(f"Role in session: {session.get('role', 'NOT_FOUND')}")
    print("=" * 50)
    
    if 'username' not in session:
        print("❌ Upload failed: No username in session")
        return jsonify({'error': 'Authentication required - please login again'}), 403
    
    if session.get('role') not in ['captain', 'soldier', 'commander']:
        print(f"❌ Upload failed: Invalid role {session.get('role')}")
        return jsonify({'error': 'Unauthorized access'}), 403
    
    try:
        ensure_upload_dir()
        
        if 'images' not in request.files:
            return jsonify({'error': 'No images provided'}), 400
        
        files = request.files.getlist('images')
        if not files or files[0].filename == '':
            return jsonify({'error': 'No images selected'}), 400
        
        # Initialize detector
        detector = UAVDetector()
        results = []
        processed_files = []
        
        # Create session-specific folder
        session_id = str(uuid.uuid4())[:8]
        session_folder = os.path.join(UPLOAD_FOLDER, session_id)
        os.makedirs(session_folder, exist_ok=True)
        
        print(f"Created session folder: {session_folder}")
        
        for file in files:
            if file and allowed_file(file.filename):
                # Check file size
                file.seek(0, 2)  # Seek to end
                file_size = file.tell()
                file.seek(0)  # Reset to beginning
                
                if file_size > MAX_FILE_SIZE:
                    results.append({
                        'filename': file.filename,
                        'error': f'File too large ({file_size/1024/1024:.1f}MB > 16MB)',
                        'success': False
                    })
                    continue
                
                # Save original file
                filename = secure_filename(file.filename)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                unique_filename = f"{timestamp}_{filename}"
                
                original_path = os.path.join(session_folder, f"original_{unique_filename}")
                processed_path = os.path.join(session_folder, f"processed_{unique_filename}")
                
                file.save(original_path)
                processed_files.append(original_path)
                
                print(f"Saved original: {original_path}")
                
                # Process with YOLO
                detection_result = detector.detect_objects(original_path, processed_path)
                
                # Verify processed file was created
                if detection_result['success']:
                    if os.path.exists(processed_path):
                        print(f"✓ Processed file created: {processed_path}")
                        print(f"File size: {os.path.getsize(processed_path)} bytes")
                        
                        results.append({
                            'filename': filename,
                            'original_path': original_path,
                            'processed_path': processed_path,
                            'detections': detection_result['detections'],
                            'detection_count': detection_result['detection_count'],
                            'processed_url': f'/static/uploads/feature2/{session_id}/processed_{unique_filename}',
                            'success': True
                        })
                    else:
                        print(f"✗ Processed file NOT created: {processed_path}")
                        results.append({
                            'filename': filename,
                            'error': 'Processed file not created by YOLO model',
                            'success': False
                        })
                else:
                    results.append({
                        'filename': filename,
                        'error': detection_result['error'],
                        'success': False
                    })
            else:
                results.append({
                    'filename': file.filename,
                    'error': 'Invalid file type or no file selected',
                    'success': False
                })
        
        print(f"✅ Upload processing complete. Session ID: {session_id}")
        return jsonify({
            'success': True,
            'results': results,
            'session_id': session_id,
            'total_processed': len([r for r in results if r.get('success')])
        })
        
    except Exception as e:
        print(f"❌ Upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500

@feature2_bp.route('/feature2/download/<session_id>')
def download_processed_images(session_id):
    """Download all processed images as ZIP - with enhanced debugging"""
    
    # ENHANCED DEBUGGING
    print("=" * 50)
    print("DOWNLOAD REQUEST DEBUG")
    print("=" * 50)
    print(f"Session ID requested: {session_id}")
    print(f"Flask session contents: {dict(session)}")
    print(f"Session username: {session.get('username', 'NOT_FOUND')}")
    print(f"Session role: {session.get('role', 'NOT_FOUND')}")
    print(f"Session keys: {list(session.keys())}")
    print(f"Request headers: {dict(request.headers)}")
    print("=" * 50)
    
    # Check if user is logged in
    if 'username' not in session:
        print("❌ FAIL: No username in session")
        print("Available session keys:", list(session.keys()))
        return jsonify({
            'error': 'Authentication required - please refresh page and login again',
            'debug': 'No username in session',
            'session_keys': list(session.keys())
        }), 403
    
    # Check user role with more permissive check
    user_role = session.get('role', '').lower()
    allowed_roles = ['captain', 'soldier', 'commander']
    
    print(f"User role (lowercase): '{user_role}'")
    print(f"Allowed roles: {allowed_roles}")
    print(f"Role check result: {user_role in allowed_roles}")
    
    if user_role not in allowed_roles:
        print(f"❌ FAIL: Role '{user_role}' not in allowed roles")
        return jsonify({
            'error': f'Access denied for role: {user_role}',
            'debug': f'Role {user_role} not in {allowed_roles}',
            'original_role': session.get('role')
        }), 403
    
    print("✅ Authentication passed")
    
    try:
        session_folder = os.path.join(UPLOAD_FOLDER, session_id)
        print(f"Looking for session folder: {session_folder}")
        print(f"Folder exists: {os.path.exists(session_folder)}")
        
        if not os.path.exists(session_folder):
            print(f"❌ Session folder not found: {session_folder}")
            # List available session folders for debugging
            if os.path.exists(UPLOAD_FOLDER):
                available_sessions = os.listdir(UPLOAD_FOLDER)
                print(f"Available sessions: {available_sessions}")
            return jsonify({
                'error': 'Session not found or expired',
                'debug': f'Folder {session_folder} does not exist'
            }), 404
        
        # List all files in session folder
        all_files = os.listdir(session_folder)
        processed_files = [f for f in all_files if f.startswith('processed_')]
        
        print(f"All files in session: {all_files}")
        print(f"Processed files found: {processed_files}")
        
        if not processed_files:
            print("❌ No processed files found")
            return jsonify({
                'error': 'No processed files found',
                'debug': f'No processed_ files in {session_folder}',
                'all_files': all_files
            }), 404
        
        # Create ZIP file in memory
        memory_file = io.BytesIO()
        file_count = 0
        
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for filename in processed_files:
                file_path = os.path.join(session_folder, filename)
                if os.path.exists(file_path):
                    file_size = os.path.getsize(file_path)
                    print(f"Adding to ZIP: {filename} (size: {file_size} bytes)")
                    zf.write(file_path, filename)
                    file_count += 1
                else:
                    print(f"⚠️  File not found: {file_path}")
        
        if file_count == 0:
            print("❌ No files were added to ZIP")
            return jsonify({
                'error': 'No valid files to download',
                'debug': 'No files could be added to ZIP'
            }), 404
        
        memory_file.seek(0)
        zip_size = len(memory_file.getvalue())
        print(f"✅ ZIP created successfully, {file_count} files, size: {zip_size} bytes")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"uav_detection_results_{timestamp}.zip"
        
        return send_file(
            memory_file,
            as_attachment=True,
            download_name=zip_filename,
            mimetype='application/zip'
        )
        
    except Exception as e:
        print(f"❌ EXCEPTION in download: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f'Download failed: {str(e)}',
            'debug': 'Internal server error during download'
        }), 500

@feature2_bp.route('/feature2/cleanup/<session_id>', methods=['POST'])
def cleanup_session(session_id):
    """Clean up session files"""
    print(f"Cleanup request for session: {session_id}")
    print(f"User: {session.get('username')}, Role: {session.get('role')}")
    
    if 'username' not in session or session.get('role') not in ['captain', 'soldier', 'commander']:
        return jsonify({'error': 'Unauthorized access'}), 403
    
    try:
        session_folder = os.path.join(UPLOAD_FOLDER, session_id)
        
        if os.path.exists(session_folder):
            import shutil
            shutil.rmtree(session_folder)
            print(f"✅ Cleaned up session folder: {session_folder}")
        else:
            print(f"⚠️  Session folder not found: {session_folder}")
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"❌ Cleanup error: {str(e)}")
        return jsonify({'error': f'Cleanup failed: {str(e)}'}), 500