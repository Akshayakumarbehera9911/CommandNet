import cv2
import numpy as np
from ultralytics import YOLO
import threading
import time
import base64
from datetime import datetime
from collections import deque
import json

class LiveDetectionManager:
    def __init__(self):
        self.model = None
        self.cap = None
        self.is_running = False
        self.detection_thread = None
        self.latest_frame = None
        self.detection_log = deque(maxlen=1000)  # Keep last 1000 detections
        self.frame_lock = threading.Lock()
        
        # Performance settings
        self.frame_skip = 2  # Process every 2nd frame
        self.jpeg_quality = 70  # Lower quality for faster encoding
        self.max_frame_queue = 2  # Drop frames if processing falls behind
        self.frame_queue_count = 0
        
        # Object colors (BGR format for OpenCV)
        self.object_colors = {
            'person': (0, 0, 255),      # Red
            'car': (255, 0, 0),         # Blue
            'bicycle': (0, 255, 0),     # Green
            'motorcycle': (0, 255, 255), # Yellow
            'bus': (255, 0, 255),       # Magenta
            'truck': (255, 255, 0),     # Cyan
            'motorbike': (128, 0, 128), # Purple
            'cat': (255, 165, 0),       # Orange
            'dog': (255, 192, 203),     # Pink
            'horse': (165, 42, 42),     # Brown
            'sheep': (128, 128, 128),   # Gray
            'cow': (0, 128, 128),       # Teal
            'bird': (255, 20, 147),     # Deep Pink
            'bottle': (0, 191, 255),    # Deep Sky Blue
            'chair': (50, 205, 50),     # Lime Green
            'dining table': (255, 69, 0), # Red Orange
            'laptop': (138, 43, 226),   # Blue Violet
            'tv': (255, 140, 0),        # Dark Orange
            'cell phone': (30, 144, 255), # Dodger Blue
            'book': (220, 20, 60),      # Crimson
        }
        
        self.load_model()

    def load_model(self):
        """Load optimized YOLO model for live detection"""
        try:
            # Use YOLOv8n for fastest performance - will auto-download if needed
            print("📥 Loading YOLOv8n model (optimized for live detection)...")
            self.model = YOLO('yolov8n.pt')
            print("✅ YOLOv8n model loaded successfully")
        except Exception as e:
            print(f"❌ Error loading YOLO model: {e}")
            print("🔄 Trying backup model...")
            try:
                # Fallback to YOLOv11n if v8n fails
                self.model = YOLO('yolov11n.pt')
                print("✅ YOLOv11n model loaded as backup")
            except Exception as e2:
                print(f"❌ Error loading backup model: {e2}")
                self.model = None

    def get_available_cameras(self):
        """Get list of available camera sources with better error handling"""
        cameras = []
        
        # Test fewer camera indices with proper error handling
        for i in range(3):  # Reduced from 5 to 3
            try:
                cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)  # Use DirectShow on Windows
                if cap.isOpened():
                    ret, _ = cap.read()
                    if ret:
                        cameras.append({
                            'id': i,
                            'name': f'Camera {i}' + (' (Default)' if i == 0 else ''),
                            'type': 'usb'
                        })
                cap.release()
            except Exception as e:
                print(f"⚠️ Error testing camera {i}: {e}")
                continue
        
        # Add custom options
        cameras.extend([
            {'id': 'ip', 'name': 'IP Camera (Custom URL)', 'type': 'ip'},
            {'id': 'rtsp', 'name': 'RTSP Stream (Custom URL)', 'type': 'rtsp'}
        ])
        
        return cameras

    def start_detection(self, camera_source):
        """Start live detection with optimized settings"""
        if self.is_running:
            return False
            
        if self.model is None:
            return False

        # Handle different camera source types
        if isinstance(camera_source, str):
            if camera_source.startswith('http') or camera_source.startswith('rtsp'):
                cap_source = camera_source
            else:
                try:
                    cap_source = int(camera_source)
                except ValueError:
                    cap_source = 0
        else:
            cap_source = camera_source

        # Initialize camera with optimized settings
        self.cap = cv2.VideoCapture(cap_source)
        if not self.cap.isOpened():
            return False

        # Optimized camera properties for performance
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.cap.set(cv2.CAP_PROP_FPS, 30)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimize buffer lag

        self.is_running = True
        self.frame_queue_count = 0
        self.detection_thread = threading.Thread(target=self._detection_loop)
        self.detection_thread.daemon = True
        self.detection_thread.start()

        return True

    def stop_detection(self):
        """Stop live detection"""
        self.is_running = False
        
        if self.detection_thread and self.detection_thread.is_alive():
            self.detection_thread.join(timeout=2)
            
        if self.cap:
            self.cap.release()
            self.cap = None
            
        with self.frame_lock:
            self.latest_frame = None

    def _detection_loop(self):
        """Optimized detection loop running in separate thread"""
        frame_count = 0
        last_process_time = time.time()
        
        while self.is_running and self.cap and self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                break

            frame_count += 1
            current_time = time.time()
            
            # Frame dropping logic - skip if processing is falling behind
            if self.frame_queue_count > self.max_frame_queue:
                continue
                
            # Process every nth frame based on frame_skip setting
            if frame_count % self.frame_skip == 0:
                self.frame_queue_count += 1
                
                try:
                    processed_frame, detections = self._process_frame(frame)
                    
                    # Fast JPEG encoding with lower quality
                    encode_params = [cv2.IMWRITE_JPEG_QUALITY, self.jpeg_quality]
                    _, buffer = cv2.imencode('.jpg', processed_frame, encode_params)
                    frame_b64 = base64.b64encode(buffer).decode('utf-8')
                    
                    with self.frame_lock:
                        self.latest_frame = {
                            'frame': frame_b64,
                            'detections': detections,
                            'timestamp': datetime.now().isoformat(),
                            'fps': round(1.0 / (current_time - last_process_time), 1) if current_time != last_process_time else 0
                        }

                    # Add to detection log (only significant detections)
                    if detections:
                        for detection in detections:
                            if detection['confidence'] > 0.6:  # Only log high-confidence detections
                                self.detection_log.append({
                                    'timestamp': datetime.now().strftime('%H:%M:%S'),
                                    'object': detection['class'].upper(),
                                    'confidence': f"{detection['confidence']:.2f}"
                                })
                    
                    last_process_time = current_time
                    
                except Exception as e:
                    print(f"⚠️ Frame processing error: {e}")
                finally:
                    self.frame_queue_count = max(0, self.frame_queue_count - 1)

            # Adaptive sleep based on performance
            time.sleep(0.01)  # Minimal sleep for better responsiveness

    def _process_frame(self, frame):
        """Optimized frame processing with YOLO detection"""
        if self.model is None:
            return frame, []

        # Optimized YOLO inference settings
        results = self.model(frame, 
                           conf=0.6,      # Higher confidence threshold
                           iou=0.5,       # Higher IoU threshold  
                           verbose=False,
                           device='cpu',  # Explicitly use CPU (can change to 'cuda' if GPU available)
                           half=False)    # Disable half precision for stability
        
        detections = []

        for result in results:
            boxes = result.boxes
            if boxes is not None and len(boxes) > 0:
                for box in boxes:
                    try:
                        # Get box coordinates
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                        
                        # Get confidence and class
                        confidence = float(box.conf[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())
                        
                        # Safety check for class_id
                        if class_id < len(self.model.names):
                            class_name = self.model.names[class_id]
                        else:
                            continue  # Skip invalid class IDs
                        
                        # Get color for this object class
                        color = self.object_colors.get(class_name, (255, 255, 255))

                        # Draw bounding box
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

                        # Draw label with background
                        label = f"{class_name}: {confidence:.2f}"
                        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
                        
                        # Ensure label doesn't go out of frame bounds
                        label_y = max(y1 - 5, label_size[1] + 5)
                        
                        # Label background
                        cv2.rectangle(frame, (x1, label_y - label_size[1] - 5),
                                    (x1 + label_size[0] + 5, label_y + 5), color, -1)
                        
                        # Label text
                        cv2.putText(frame, label, (x1 + 2, label_y),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

                        # Add to detections list
                        detections.append({
                            'class': class_name,
                            'confidence': confidence,
                            'bbox': [int(x1), int(y1), int(x2), int(y2)],
                            'color': [int(c) for c in color]  # Ensure JSON serializable
                        })
                        
                    except Exception as e:
                        print(f"⚠️ Detection processing error: {e}")
                        continue

        return frame, detections

    def get_status(self):
        """Get current detection status with performance metrics"""
        status = {
            'is_running': self.is_running,
            'model_loaded': self.model is not None,
            'camera_active': self.cap is not None and self.cap.isOpened() if self.cap else False,
            'total_detections': len(self.detection_log),
            'frame_skip': self.frame_skip,
            'jpeg_quality': self.jpeg_quality,
            'queue_count': self.frame_queue_count
        }
        
        if self.model is not None:
            status['model_name'] = 'YOLOv8n (Optimized)'
            
        return status

    def get_latest_frame(self):
        """Get latest processed frame"""
        with self.frame_lock:
            return self.latest_frame

    def get_detection_log(self):
        """Get recent detection log"""
        return list(self.detection_log)[-50:]  # Return last 50 detections

    def clear_detection_log(self):
        """Clear detection log"""
        self.detection_log.clear()
        
    def adjust_performance(self, frame_skip=None, jpeg_quality=None):
        """Adjust performance settings on the fly"""
        if frame_skip is not None:
            self.frame_skip = max(1, min(5, frame_skip))  # Clamp between 1-5
        if jpeg_quality is not None:
            self.jpeg_quality = max(30, min(95, jpeg_quality))  # Clamp between 30-95
            
        return {
            'frame_skip': self.frame_skip,
            'jpeg_quality': self.jpeg_quality
        }