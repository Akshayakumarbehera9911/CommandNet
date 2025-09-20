import torch
import cv2
import numpy as np
import os
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class UAVDetector:
    def __init__(self):
        """Initialize YOLO model for UAV object detection"""
        self.model_path = "config/best.pt"
        self.model = None
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.img_size = 640
        self.conf_threshold = 0.25
        self.iou_threshold = 0.45
        
        self.load_model()
    
    def load_model(self):
        """Load the YOLO model"""
        try:
            # Verify model file exists
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found at {self.model_path}")
            
            # Load YOLOv5 model
            self.model = torch.hub.load('ultralytics/yolov5', 
                                      'custom', 
                                      path=self.model_path,
                                      force_reload=True)
            
            # Set model parameters
            self.model.conf = self.conf_threshold
            self.model.iou = self.iou_threshold
            
            # Move to GPU if available
            if self.device == 'cuda':
                self.model.cuda()
                logger.info("Model loaded on GPU")
            else:
                logger.info("Model loaded on CPU")
                
            logger.info("YOLO model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {str(e)}")
            raise
    
    def detect_objects(self, image_path, output_path):
        """
        Detect objects in an image and save annotated result
        
        Args:
            image_path (str): Path to input image
            output_path (str): Path to save annotated image
            
        Returns:
            dict: Detection results with success status, detections, and count
        """
        try:
            # Load image
            img = cv2.imread(image_path)
            if img is None:
                return {
                    'success': False,
                    'error': 'Failed to load image'
                }
            
            # Convert BGR to RGB for YOLO
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # Run inference
            with torch.no_grad():
                results = self.model(img_rgb)
            
            # Get detections
            detections = self.parse_detections(results)
            
            # Render results on image
            annotated_imgs = results.render()  # Returns list of annotated images
            annotated_img = annotated_imgs[0]  # Get first image
            
            # Convert back to BGR for saving
            annotated_bgr = cv2.cvtColor(annotated_img, cv2.COLOR_RGB2BGR)
            
            # Save annotated image
            cv2.imwrite(output_path, annotated_bgr)
            
            return {
                'success': True,
                'detections': detections,
                'detection_count': len(detections),
                'output_path': output_path
            }
            
        except Exception as e:
            logger.error(f"Detection failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def parse_detections(self, results):
        """
        Parse YOLO detection results
        
        Args:
            results: YOLO detection results
            
        Returns:
            list: List of detection dictionaries
        """
        detections = []
        
        try:
            # Get detection data from results
            df = results.pandas().xyxy[0]  # Detections as pandas DataFrame
            
            for index, detection in df.iterrows():
                det_dict = {
                    'class': detection['name'],
                    'confidence': round(float(detection['confidence']), 2),
                    'bbox': {
                        'xmin': int(detection['xmin']),
                        'ymin': int(detection['ymin']),
                        'xmax': int(detection['xmax']),
                        'ymax': int(detection['ymax'])
                    }
                }
                detections.append(det_dict)
                
        except Exception as e:
            logger.warning(f"Failed to parse detections: {str(e)}")
            # Fallback: try to get basic detection info
            try:
                pred = results.pred[0]
                if len(pred) > 0:
                    for detection in pred:
                        x1, y1, x2, y2, conf, cls = detection.tolist()
                        class_name = self.model.names[int(cls)] if hasattr(self.model, 'names') else f"Class_{int(cls)}"
                        
                        det_dict = {
                            'class': class_name,
                            'confidence': round(conf, 2),
                            'bbox': {
                                'xmin': int(x1),
                                'ymin': int(y1),
                                'xmax': int(x2),
                                'ymax': int(y2)
                            }
                        }
                        detections.append(det_dict)
            except:
                pass
        
        return detections
    
    def get_model_info(self):
        """Get model information"""
        if self.model is None:
            return None
            
        try:
            info = {
                'device': self.device,
                'model_path': self.model_path,
                'img_size': self.img_size,
                'conf_threshold': self.conf_threshold,
                'iou_threshold': self.iou_threshold,
                'classes': getattr(self.model, 'names', 'Unknown')
            }
            return info
        except:
            return None

# Utility functions for web interface
def validate_image(file_path):
    """Validate that file is a valid image"""
    try:
        img = cv2.imread(file_path)
        return img is not None
    except:
        return False

def get_image_info(file_path):
    """Get basic image information"""
    try:
        img = cv2.imread(file_path)
        if img is None:
            return None
            
        height, width, channels = img.shape
        file_size = os.path.getsize(file_path)
        
        return {
            'width': width,
            'height': height,
            'channels': channels,
            'file_size': file_size,
            'file_size_mb': round(file_size / (1024 * 1024), 2)
        }
    except:
        return None