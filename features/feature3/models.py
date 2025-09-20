import os
import json
from datetime import datetime

class AdvancedDetectionModel:
    def __init__(self):
        """Initialize the advanced detection model"""
        try:
            # Import locally to avoid circular dependency
            from .detection_engine import CompleteObjectDetectionSystem
            self.detection_system = CompleteObjectDetectionSystem()
            self.initialized = True
        except Exception as e:
            print(f"Warning: Could not initialize YOLO models - {e}")
            self.initialized = False
            self.detection_system = None
    
    def process_images_web(self, image_paths, session_id, detection_filter='all'):
        if not self.initialized:
            return {
                'success': False,
                'error': 'Detection system not initialized. Please check YOLO model installation.'
            }
        
        try:
            return self.detection_system.process_images_web(image_paths, session_id, detection_filter)
        except Exception as e:
            return {
                'success': False,
                'error': f'Image processing failed: {str(e)}'
            }
    
    def process_videos_web(self, video_paths, session_id, active_sessions, detection_filter='all'):
        if not self.initialized:
            return {
                'success': False,
                'error': 'Detection system not initialized. Please check YOLO model installation.'
            }
        
        try:
            return self.detection_system.process_videos_web(video_paths, session_id, active_sessions, detection_filter)
        except Exception as e:
            return {
                'success': False,
                'error': f'Video processing failed: {str(e)}'
            }
    
    def get_model_info(self):
        """Get information about loaded models"""
        if not self.initialized:
            return {
                'initialized': False,
                'error': 'Models not loaded'
            }
        
        try:
            return {
                'initialized': True,
                'image_model': 'YOLO11x (Best Accuracy)',
                'video_model': 'YOLO11m (Balanced Performance)',
                'status': 'Ready',
                'supported_formats': {
                    'images': ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'],
                    'videos': ['.mp4', '.avi', '.mov', '.mkv', '.wmv']
                }
            }
        except Exception as e:
            return {
                'initialized': False,
                'error': str(e)
            }
    
    def get_detection_statistics(self, session_id):
        """Get detection statistics for a specific session"""
        try:
            report_path = f"static/processed/feature3/{session_id}/batch_report.json"
            
            if os.path.exists(report_path):
                with open(report_path, 'r') as f:
                    return json.load(f)
            else:
                return {
                    'error': 'Session report not found',
                    'session_id': session_id
                }
                
        except Exception as e:
            return {
                'error': f'Could not load statistics: {str(e)}',
                'session_id': session_id
            }
    
    def cleanup_old_sessions(self, max_age_hours=24):
        """Clean up old processing sessions"""
        try:
            base_upload_dir = "uploads/feature3"
            base_processed_dir = "static/processed/feature3"
            
            current_time = datetime.now().timestamp()
            max_age_seconds = max_age_hours * 3600
            
            # Cleanup upload folders
            if os.path.exists(base_upload_dir):
                for session_folder in os.listdir(base_upload_dir):
                    folder_path = os.path.join(base_upload_dir, session_folder)
                    if os.path.isdir(folder_path):
                        folder_age = current_time - os.path.getctime(folder_path)
                        if folder_age > max_age_seconds:
                            for file in os.listdir(folder_path):
                                os.remove(os.path.join(folder_path, file))
                            os.rmdir(folder_path)
            
            # Cleanup processed folders
            if os.path.exists(base_processed_dir):
                for session_folder in os.listdir(base_processed_dir):
                    folder_path = os.path.join(base_processed_dir, session_folder)
                    if os.path.isdir(folder_path):
                        folder_age = current_time - os.path.getctime(folder_path)
                        if folder_age > max_age_seconds:
                            for file in os.listdir(folder_path):
                                os.remove(os.path.join(folder_path, file))
                            os.rmdir(folder_path)
                            
        except Exception as e:
            print(f"Cleanup error: {e}")