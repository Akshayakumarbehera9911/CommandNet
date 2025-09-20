from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from functools import wraps
from .models import BattlefieldAI, BattlefieldSituation
import time

feature1_bp = Blueprint('feature1', __name__, template_folder='templates')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def feature_access_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'role' not in session:
            return redirect(url_for('login'))
        
        # Both soldiers and captains can access Feature 1
        allowed_roles = ['soldier', 'captain']
        if session.get('role') not in allowed_roles:
            return render_template('403.html'), 403
        return f(*args, **kwargs)
    return decorated_function

@feature1_bp.route('/feature1')
@login_required
@feature_access_required
def feature1_page():
    """Display the Battlefield Decision Support interface"""
    return render_template('feature1.html', 
                         username=session.get('username', ''),
                         role=session.get('role', ''))

@feature1_bp.route('/feature1/analyze', methods=['POST'])
@login_required
@feature_access_required
def analyze_battlefield():
    """Process battlefield analysis request"""
    try:
        # Get form data
        data = request.get_json()
        
        # Validate required fields
        required_fields = [
            'friendly_forces', 'enemy_forces', 'terrain', 'weather',
            'visibility', 'intel_confidence', 'mission_type', 
            'time_constraint', 'civilian_presence'
        ]
        
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Create battlefield situation
        situation = BattlefieldSituation(
            friendly_forces=int(data['friendly_forces']),
            enemy_forces=int(data['enemy_forces']),
            terrain=data['terrain'],
            weather=data['weather'],
            visibility=int(data['visibility']),
            intel_confidence=int(data['intel_confidence']),
            mission_type=data['mission_type'],
            time_constraint=data['time_constraint'],
            civilian_presence=data['civilian_presence'] == 'true'
        )
        
        # Initialize AI and generate recommendations
        ai = BattlefieldAI()
        
        # Add processing delay for realism
        time.sleep(2)  # Simulate processing time
        
        # Get tactical options
        tactical_options = ai.generate_tactical_options(situation)
        
        # Calculate additional analysis
        fog_factor = ai.calculate_fog_of_war_factor(situation)
        force_ratio = situation.friendly_forces / max(situation.enemy_forces, 1)
        
        # Format response
        response = {
            'success': True,
            'tactical_options': [
                {
                    'rank': i + 1,
                    'name': option.name,
                    'description': option.description,
                    'success_probability': round(option.success_probability * 100, 1),
                    'confidence_score': round(option.confidence_score * 100, 1),
                    'risk_level': option.risk_level.name,
                    'expected_casualties': option.expected_casualties,
                    'time_required': option.time_required,
                    'resource_requirement': option.resource_requirement
                }
                for i, option in enumerate(tactical_options)
            ],
            'fog_of_war': {
                'uncertainty_factor': round(fog_factor * 100, 1),
                'intelligence_quality': f"{situation.intel_confidence}/10",
                'visibility_conditions': f"{situation.visibility}/10"
            },
            'force_analysis': {
                'force_ratio': f"{force_ratio:.2f}:1",
                'assessment': get_force_assessment(force_ratio)
            },
            'commander_recommendation': {
                'recommended_action': tactical_options[0].name,
                'rationale': f"{round(tactical_options[0].success_probability * 100, 1)}% success probability",
                'confidence': f"{round(tactical_options[0].confidence_score * 100, 1)}%"
            }
        }
        
        return jsonify(response)
        
    except ValueError as e:
        return jsonify({'error': f'Invalid input data: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500

def get_force_assessment(force_ratio):
    """Convert force ratio to assessment text"""
    if force_ratio >= 2.0:
        return "Significant tactical advantage"
    elif force_ratio >= 1.5:
        return "Moderate tactical advantage"
    elif force_ratio >= 1.0:
        return "Even forces - proceed with caution"
    else:
        return "Numerical disadvantage - consider alternatives"