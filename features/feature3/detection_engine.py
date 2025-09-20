from ultralytics import YOLO
import cv2
import numpy as np
import os
import glob
import json
from datetime import datetime
import time
from collections import Counter

class CompleteObjectDetectionSystem:
    def __init__(self):
        print("🚀 Initializing Object Detection System...")
        print("Loading models...")
        self.model = YOLO("yolo11x.pt")  # Best accuracy model for images/videos
        
        # Define colors for different object classes (BGR format)
        self.colors = [
            (0, 255, 0), (255, 0, 0), (0, 0, 255), (255, 255, 0),
            (255, 0, 255), (0, 255, 255), (128, 0, 128), (255, 165, 0),
            (0, 128, 255), (255, 192, 203), (0, 255, 127), (255, 20, 147),
            (75, 0, 130), (255, 140, 0), (50, 205, 50), (220, 20, 60)
        ]
        self.class_colors = {}
        self.detection_stats = []
        print("✅ System ready!")

    def get_class_color(self, class_name):
        """Assign consistent colors to object classes"""
        if class_name not in self.class_colors:
            self.class_colors[class_name] = self.colors[len(self.class_colors) % len(self.colors)]
        return self.class_colors[class_name]

    def filter_detections_by_type(self, detections, detection_filter):
        """Filter detections based on selected filter type"""
        if detection_filter == 'all':
            return detections
        
        filtered_detections = []
        for det in detections:
            class_name = det["class"].lower()
            
            if detection_filter == 'person':
                if class_name == 'person':
                    filtered_detections.append(det)
            elif detection_filter == 'car':
                # Include various car-related classes
                car_classes = ['car', 'truck', 'bus', 'motorcycle', 'bicycle']
                if any(car_class in class_name for car_class in car_classes):
                    filtered_detections.append(det)
            elif detection_filter == 'person_car':
                # Include both person and car classes
                car_classes = ['car', 'truck', 'bus', 'motorcycle', 'bicycle']
                if class_name == 'person' or any(car_class in class_name for car_class in car_classes):
                    filtered_detections.append(det)
        
        return filtered_detections

    def draw_detections(self, frame, results, detection_filter='all'):
        """Draw colorful bounding boxes and labels on frame with filtering"""
        all_detections = []
        if len(results[0].boxes) == 0:
            return frame, all_detections

        # Extract all detections first
        for box in results[0].boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            confidence = float(box.conf[0])
            class_id = int(box.cls[0])
            class_name = self.model.names[class_id]

            detection = {
                "class": class_name,
                "confidence": confidence,
                "bbox": [x1, y1, x2, y2]
            }
            all_detections.append(detection)

        # Filter detections based on selected filter
        filtered_detections = self.filter_detections_by_type(all_detections, detection_filter)

        # Draw only filtered detections
        for det in filtered_detections:
            x1, y1, x2, y2 = det["bbox"]
            class_name = det["class"]
            confidence = det["confidence"]
            
            # Get color for this class
            color = self.get_class_color(class_name)
            
            # Draw bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
            
            # Create label
            # label = f"{class_name}: {confidence:.2f}"
            # Customize label based on filter
            if detection_filter == 'car':
                if class_name.lower() in ['car', 'truck', 'bus', 'motorcycle', 'bicycle']:
                    display_name = 'vehicle'
                else:
                    display_name = class_name
            else:
                display_name = class_name

            label = f"{display_name}: {confidence:.2f}"
            
            # Draw label background
            (label_width, label_height), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
            cv2.rectangle(frame, (x1, y1 - label_height - 10), (x1 + label_width, y1), color, -1)
            
            # Draw label text
            cv2.putText(frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        return frame, filtered_detections

    # WEB WRAPPER METHODS - UPDATED WITH FILTERING
    def process_images_web(self, image_paths, session_id, detection_filter='all'):
        """Web wrapper for batch image processing with filtering"""
        try:
            from flask import current_app
            # Create output directory
            output_dir = os.path.join('static/processed/feature3', session_id)
            os.makedirs(output_dir, exist_ok=True)

            results = {
                'success': True,
                'processed_images': [],
                'total_objects': 0,
                'object_counts': {},
                'processing_time': 0,
                'detection_filter': detection_filter
            }

            start_time = time.time()
            all_detections = []

            for i, img_path in enumerate(image_paths):
                try:
                    # Read and process image
                    image = cv2.imread(img_path)
                    if image is None:
                        continue

                    # Run detection
                    detection_results = self.model.predict(source=image, conf=0.3, imgsz=1280, verbose=False)
                    output_image, detections = self.draw_detections(image, detection_results, detection_filter)

                    # Save processed image
                    filename = os.path.basename(img_path)
                    name, ext = os.path.splitext(filename)
                    output_filename = f"{name}_detected{ext}"
                    output_path = os.path.join(output_dir, output_filename)
                    cv2.imwrite(output_path, output_image)

                    # Store results
                    results['processed_images'].append({
                        'original_name': filename,
                        'processed_name': output_filename,
                        'detections': detections,
                        'object_count': len(detections),
                        'url': f'/static/processed/feature3/{session_id}/{output_filename}'
                    })

                    all_detections.extend(detections)

                except Exception as e:
                    print(f"Error processing {img_path}: {e}")
                    continue

            # Calculate statistics
            processing_time = time.time() - start_time
            object_counts = Counter([det["class"] for det in all_detections])

            results.update({
                'total_objects': len(all_detections),
                'object_counts': dict(object_counts),
                'processing_time': round(processing_time, 2),
                'average_confidence': round(np.mean([det["confidence"] for det in all_detections]), 2) if all_detections else 0
            })

            # Save session report
            report = {
                "mode": "web_batch_images",
                "session_id": session_id,
                "detection_filter": detection_filter,
                "total_images_processed": len(results['processed_images']),
                "processing_time": f"{processing_time:.2f} seconds",
                "total_objects": len(all_detections),
                "object_counts": dict(object_counts),
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

            report_path = os.path.join(output_dir, "batch_report.json")
            with open(report_path, 'w') as f:
                json.dump(report, f, indent=2)

            return results

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def process_videos_web(self, video_paths, session_id, active_sessions, detection_filter='all'):
        """Web wrapper for batch video processing with filtering"""
        try:
            # Create output directory
            output_dir = os.path.join('static/processed/feature3', session_id)
            os.makedirs(output_dir, exist_ok=True)

            results = {
                'success': True,
                'processed_videos': [],
                'total_objects': 0,
                'object_counts': {},
                'processing_time': 0,
                'detection_filter': detection_filter
            }

            start_time = time.time()
            all_detections = []

            for video_idx, video_path in enumerate(video_paths):
                try:
                    # Check for cancellation
                    if active_sessions[session_id].get('cancel_requested', False):
                        results['cancelled'] = True
                        break

                    # Update progress
                    active_sessions[session_id]['current_file'] = os.path.basename(video_path)
                    active_sessions[session_id]['progress'] = (video_idx / len(video_paths)) * 100

                    cap = cv2.VideoCapture(video_path)
                    if not cap.isOpened():
                        continue

                    # Get video properties
                    fps = int(cap.get(cv2.CAP_PROP_FPS))
                    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

                    # Setup output video
                    filename = os.path.basename(video_path)
                    name, ext = os.path.splitext(filename)
                    output_filename = f"{name}_detected.mp4"
                    output_path = os.path.join(output_dir, output_filename)
                    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

                    video_detections = []
                    frame_count = 0

                    while True:
                        # Check for cancellation
                        if active_sessions[session_id].get('cancel_requested', False):
                            break

                        ret, frame = cap.read()
                        if not ret:
                            break

                        frame_count += 1

                        # Run detection (every few frames for performance)
                        if frame_count % 1 == 0:  # Process every 1st frame
                            detection_results = self.model.predict(source=frame, conf=0.25, imgsz=640, verbose=False)
                            annotated_frame, detections = self.draw_detections(frame, detection_results, detection_filter)
                            video_detections.extend(detections)
                        else:
                            annotated_frame = frame

                        out.write(annotated_frame)

                        # Update progress within video
                        if frame_count % 50 == 0:
                            video_progress = (frame_count / total_frames) * 100
                            overall_progress = (video_idx / len(video_paths)) * 100 + (video_progress / len(video_paths))
                            active_sessions[session_id]['progress'] = overall_progress

                    cap.release()
                    out.release()

                    # Store results
                    results['processed_videos'].append({
                        'original_name': filename,
                        'processed_name': output_filename,
                        'total_frames': total_frames,
                        'detections': len(video_detections),
                        'url': f'/static/processed/feature3/{session_id}/{output_filename}'
                    })

                    all_detections.extend(video_detections)

                except Exception as e:
                    print(f"Error processing {video_path}: {e}")
                    continue

            # Calculate final statistics
            processing_time = time.time() - start_time
            object_counts = Counter([det["class"] for det in all_detections])

            results.update({
                'total_objects': len(all_detections),
                'object_counts': dict(object_counts),
                'processing_time': round(processing_time, 2)
            })

            return results

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    # ORIGINAL CONSOLE METHODS - UNCHANGED
    def process_single_image(self):
        """Process a single image"""
        print("\n📷 Image Processing Mode")
        input_path = input("Enter input image path: ").strip()
        if not os.path.exists(input_path):
            print("❌ Image file not found!")
            return

        print("Processing image...")
        start_time = time.time()

        # Read image
        image = cv2.imread(input_path)
        if image is None:
            print("❌ Could not load image!")
            return

        # Run detection
        results = self.model.predict(source=image, conf=0.3, imgsz=1280, verbose=False)

        # Draw detections
        output_image, detections = self.draw_detections(image, results)

        # Save output
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        output_path = f"{base_name}_detected.jpg"
        cv2.imwrite(output_path, output_image)

        # Generate statistics
        processing_time = time.time() - start_time
        object_counts = Counter([det["class"] for det in detections])
        avg_confidence = np.mean([det["confidence"] for det in detections]) if detections else 0

        # Save report
        report = {
            "mode": "single_image",
            "input_file": input_path,
            "output_file": output_path,
            "processing_time": f"{processing_time:.2f} seconds",
            "total_objects": len(detections),
            "object_counts": dict(object_counts),
            "average_confidence": f"{avg_confidence:.2f}",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        report_path = f"{base_name}_report.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"✅ Processing complete!")
        print(f"📊 Found {len(detections)} objects: {dict(object_counts)}")
        print(f"💾 Output saved: {output_path}")
        print(f"📋 Report saved: {report_path}")

    def process_batch_images(self):
        """Process multiple images"""
        print("\n🖼️ Batch Image Processing Mode")
        input_folder = input("Enter input folder path: ").strip()
        if not os.path.exists(input_folder):
            print("❌ Folder not found!")
            return

        # Find all images
        extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp', '*.tiff', '*.webp']
        image_files = []
        for ext in extensions:
            image_files.extend(glob.glob(os.path.join(input_folder, ext)))
            image_files.extend(glob.glob(os.path.join(input_folder, ext.upper())))

        if not image_files:
            print("❌ No images found!")
            return

        print(f"Found {len(image_files)} images to process...")

        # Create output folder
        output_folder = f"{input_folder}_processed"
        os.makedirs(output_folder, exist_ok=True)

        all_detections = []
        start_time = time.time()

        for i, img_path in enumerate(image_files):
            print(f"Processing {i+1}/{len(image_files)}: {os.path.basename(img_path)}")
            image = cv2.imread(img_path)
            if image is None:
                continue

            results = self.model.predict(source=image, conf=0.3, imgsz=1280, verbose=False)
            output_image, detections = self.draw_detections(image, results)

            # Save processed image
            filename = os.path.basename(img_path)
            name, ext = os.path.splitext(filename)
            output_path = os.path.join(output_folder, f"{name}_detected{ext}")
            cv2.imwrite(output_path, output_image)

            all_detections.extend(detections)

        # Generate batch report
        processing_time = time.time() - start_time
        object_counts = Counter([det["class"] for det in all_detections])
        avg_confidence = np.mean([det["confidence"] for det in all_detections]) if all_detections else 0

        batch_report = {
            "mode": "batch_images",
            "input_folder": input_folder,
            "output_folder": output_folder,
            "total_images_processed": len(image_files),
            "processing_time": f"{processing_time:.2f} seconds",
            "total_objects": len(all_detections),
            "object_counts": dict(object_counts),
            "average_confidence": f"{avg_confidence:.2f}",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        report_path = os.path.join(output_folder, "batch_report.json")
        with open(report_path, 'w') as f:
            json.dump(batch_report, f, indent=2)

        print(f"✅ Batch processing complete!")
        print(f"📊 Processed {len(image_files)} images, found {len(all_detections)} objects")
        print(f"💾 All outputs saved in: {output_folder}")

    def process_video(self):
        """Process video file"""
        print("\n🎥 Video Processing Mode")
        input_path = input("Enter input video path: ").strip()
        if not os.path.exists(input_path):
            print("❌ Video file not found!")
            return

        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            print("❌ Could not open video!")
            return

        # Get video properties
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        print(f"Video info: {width}x{height}, {fps} FPS, {total_frames} frames")

        # Setup output video
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        output_path = f"{base_name}_detected.mp4"
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        all_detections = []
        frame_count = 0
        start_time = time.time()

        print("Processing video...")

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1

            # Run detection
            results = self.model.predict(source=frame, conf=0.25, imgsz=640, verbose=False)
            annotated_frame, detections = self.draw_detections(frame, results)

            # Write frame
            out.write(annotated_frame)
            all_detections.extend(detections)

            # Show progress (less verbose)
            if frame_count % 50 == 0:
                progress = (frame_count / total_frames) * 100
                print(f"Progress: {progress:.1f}% ({frame_count}/{total_frames})")

        cap.release()
        out.release()

        # Generate video report
        processing_time = time.time() - start_time
        object_counts = Counter([det["class"] for det in all_detections])
        avg_confidence = np.mean([det["confidence"] for det in all_detections]) if all_detections else 0
        frames_with_objects = len(set([i for i, det in enumerate(all_detections)]))

        video_report = {
            "mode": "video_processing",
            "input_file": input_path,
            "output_file": output_path,
            "total_frames": total_frames,
            "processing_time": f"{processing_time:.2f} seconds",
            "total_objects": len(all_detections),
            "object_counts": dict(object_counts),
            "average_confidence": f"{avg_confidence:.2f}",
            "coverage": f"{(frames_with_objects/total_frames)*100:.1f}% of frames had objects",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        report_path = f"{base_name}_video_report.json"
        with open(report_path, 'w') as f:
            json.dump(video_report, f, indent=2)

        print(f"✅ Video processing complete!")
        print(f"📊 Found {len(all_detections)} objects across {total_frames} frames")
        print(f"💾 Output saved: {output_path}")
        print(f"📋 Report saved: {report_path}")

    def show_menu(self):
        """Display main menu"""
        print("\n" + "="*50)
        print("🎯 COMPLETE OBJECT DETECTION SYSTEM")
        print("="*50)
        print("1. 📷 Process Single Image")
        print("2. 🖼️ Process Multiple Images (Batch)")
        print("3. 🎥 Process Video File")
        print("4. ❌ Exit")
        print("="*50)

    def run(self):
        """Main application loop"""
        while True:
            self.show_menu()
            choice = input("Select option (1-4): ").strip()

            if choice == '1':
                self.process_single_image()
            elif choice == '2':
                self.process_batch_images()
            elif choice == '3':
                self.process_video()
            elif choice == '4':
                print("👋 Goodbye!")
                break
            else:
                print("❌ Invalid choice! Please select 1-4.")

            input("\nPress Enter to continue...")


if __name__ == "__main__":
    try:
        system = CompleteObjectDetectionSystem()
        system.run()
    except KeyboardInterrupt:
        print("\n\n👋 System interrupted by user. Goodbye!")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("Make sure you have installed: pip install ultralytics opencv-python")