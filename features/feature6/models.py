import sys
import torch
import torch.nn.functional as F
import cv2
import numpy as np
import os
import base64
from .Network_Res2Net_GRA_NCD import Network

class CamouflageDetectionModel:
    def __init__(self, weight_path="Net_epoch_best.pth"):
        self.weight_path = weight_path
        self.model = None
        self.load_model()
    
    def load_model(self):
        """Load the SINet-V2 model"""
        try:
            self.model = Network(channel=32, imagenet_pretrained=False)
            self.model.load_state_dict(torch.load(self.weight_path, map_location="cpu"))
            self.model.eval()
            print(f"✅ Camouflage detection model loaded from {self.weight_path}")
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            raise e
    
    def preprocess(self, image_path, size=352):
        """Preprocess image for model input"""
        img = cv2.imread(image_path)
        if img is None:
            raise FileNotFoundError(f"Could not read image: {image_path}")
        
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img_resized = cv2.resize(img_rgb, (size, size))
        img_tensor = torch.from_numpy(img_resized).permute(2, 0, 1).unsqueeze(0).float()
        img_tensor = img_tensor / 255.0  # normalize to [0,1]
        return img, img_tensor
    
    def postprocess(self, pred, orig_img):
        """Postprocess model prediction"""
        pred = F.interpolate(pred, size=orig_img.shape[:2], mode="bilinear", align_corners=False)
        pred = torch.sigmoid(pred).squeeze().detach().cpu().numpy()
        pred = (pred * 255).astype(np.uint8)
        return pred
    
    def overlay_heatmap(self, orig_img, mask):
        """Create heatmap overlay on original image"""
        heatmap = cv2.applyColorMap(mask, cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(orig_img, 0.6, heatmap, 0.4, 0)
        return overlay
    
    def process_single_image(self, image_path, output_path):
        """Process a single image and save result"""
        try:
            # Preprocess
            orig_img, img_tensor = self.preprocess(image_path)
            
            # Run inference
            with torch.no_grad():
                S_g_pred, S_5_pred, S_4_pred, S_3_pred = self.model(img_tensor)
                mask = self.postprocess(S_g_pred, orig_img)
            
            # Create heatmap overlay
            result = self.overlay_heatmap(orig_img, mask)
            
            # Save result
            cv2.imwrite(output_path, result)
            
            return {
                'success': True,
                'input_path': image_path,
                'output_path': output_path,
                'detection_confidence': float(np.mean(mask) / 255.0)
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'input_path': image_path
            }
    
    def process_images_web(self, image_files, session_id):
        """Process multiple images for web interface"""
        processed_folder = os.path.join('static/processed/feature6', session_id)
        os.makedirs(processed_folder, exist_ok=True)
        
        results = {
            'success': True,
            'processed_images': [],
            'total_processed': 0,
            'total_failed': 0,
            'session_id': session_id
        }
        
        for image_path in image_files:
            filename = os.path.basename(image_path)
            name, ext = os.path.splitext(filename)
            output_filename = f"detected_{name}{ext}"
            output_path = os.path.join(processed_folder, output_filename)
            
            result = self.process_single_image(image_path, output_path)
            
            if result['success']:
                # Create web-accessible path
                web_path = f"/static/processed/feature6/{session_id}/{output_filename}"
                
                image_result = {
                    'original_filename': filename,
                    'processed_filename': output_filename,
                    'processed_path': web_path,
                    'detection_confidence': result['detection_confidence'],
                    'download_url': f"/feature6/download_image/{session_id}/{output_filename}"
                }
                
                results['processed_images'].append(image_result)
                results['total_processed'] += 1
            else:
                results['total_failed'] += 1
                results['processed_images'].append({
                    'original_filename': filename,
                    'error': result['error'],
                    'failed': True
                })
        
        if results['total_failed'] > 0:
            results['success'] = False
        
        return results