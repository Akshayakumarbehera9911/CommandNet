# Military WebApp

Role-based military decision support platform with ML integration and real-time detection.

## Features

- **Feature 1**: Battlefield Decision Support AI
- **Feature 2**: UAV Object Detection  
- **Feature 3**: Advanced Image & Video Processing
- **Feature 4**: Real-time Live Detection System
- **Feature 5**: Military Communication System
- **Feature 6**: Additional Detection Module

## Requirements

- Python 3.8+
- MySQL 8.0+
- 8GB+ RAM
- Modern web browser

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/military-webapp.git
cd military-webapp
pip install -r requirements.txt
```

## Database Setup

```sql
CREATE DATABASE military_webapp;
```

## Running

```bash
python app.py
```

Access at `http://localhost:5000`

## Default Users

| Username | Password | Role |
|----------|----------|------|
| captain1 | pass123  | Captain |
| soldier1 | pass123  | Soldier |
| soldier2 | pass123  | Soldier |
| soldier3 | pass123  | Soldier |

## Models

The following YOLO models are included:
- yolo11x.pt (114MB) - Highest accuracy
- yolo11m.pt (40MB) - Balanced performance  
- yolov5s.pt (14MB) - Lightweight
- yolov8n.pt (6MB) - Ultra lightweight
- Net_epoch_best.pth (108MB) - Custom model
- config/best.pt (14MB) - Configuration model