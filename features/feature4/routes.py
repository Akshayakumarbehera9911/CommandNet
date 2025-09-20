from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from flask_socketio import emit
import cv2
import threading
import time
from datetime import datetime
from .models import LiveDetectionManager

feature4_bp = Blueprint('feature4', __name__,
                       url_prefix='/feature4',
                       template_folder='templates',
                       static_folder='static')

# Global detection manager
detection_manager = LiveDetectionManager()

@feature4_bp.route('/')
def feature4_home():
    """Main live detection interface"""
    if 'username' not in session:
        return redirect(url_for('login'))
    
    # Check if user has permission for this feature
    user_role = session.get('role')
    if user_role not in ['captain', 'soldier']:
        return render_template('error.html', 
                             message="Access denied. Captain access required."), 403
    
    # Get available cameras
    cameras = detection_manager.get_available_cameras()
    return render_template('feature4.html', cameras=cameras)

def register_socketio_handlers(socketio):
    """Register SocketIO handlers - placeholder for your app.py compatibility"""
    pass

@feature4_bp.route('/api/cameras')
def get_cameras():
    """API endpoint to get available cameras"""
    try:
        cameras = detection_manager.get_available_cameras()
        return jsonify({'success': True, 'cameras': cameras})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@feature4_bp.route('/api/start', methods=['POST'])
def start_detection():
    """Start live detection"""
    try:
        data = request.get_json()
        camera_source = data.get('camera_source', 0)
        
        success = detection_manager.start_detection(camera_source)
        
        if success:
            return jsonify({'success': True, 'message': 'Detection started'})
        else:
            return jsonify({'success': False, 'error': 'Failed to start camera'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@feature4_bp.route('/api/stop', methods=['POST'])
def stop_detection():
    """Stop live detection"""
    try:
        detection_manager.stop_detection()
        return jsonify({'success': True, 'message': 'Detection stopped'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@feature4_bp.route('/api/status')
def get_status():
    """Get detection status"""
    try:
        status = detection_manager.get_status()
        return jsonify(status)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@feature4_bp.route('/api/frame')
def get_frame():
    """Get latest processed frame"""
    try:
        frame_data = detection_manager.get_latest_frame()
        if frame_data:
            return jsonify({
                'success': True,
                'frame': frame_data['frame'],
                'detections': frame_data['detections']
            })
        else:
            return jsonify({'success': False, 'error': 'No frame available'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@feature4_bp.route('/api/detections')
def get_detections():
    """Get latest detection log"""
    try:
        detections = detection_manager.get_detection_log()
        return jsonify({'success': True, 'detections': detections})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})