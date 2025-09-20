from flask import Blueprint, render_template, request, session, redirect, url_for, jsonify, flash
from functools import wraps
import json
from database import DatabaseManager
from .models import MessageManager

feature5_bp = Blueprint('feature5', __name__, 
                       url_prefix='/feature5',
                       template_folder='templates')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def role_required(roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'username' not in session:
                return redirect(url_for('login'))
            
            try:
                with open('config/users.json', 'r') as file:
                    users_data = json.load(file)
                user_role = users_data['users'].get(session['username'], {}).get('role', '')
                if user_role not in roles:
                    return render_template('403.html'), 403
            except:
                return render_template('403.html'), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@feature5_bp.route('/')
@login_required
@role_required(['soldier', 'captain'])
def messaging():
    username = session.get('username')
    role = session.get('role')
    
    # Log feature access
    DatabaseManager.log_activity(
        username=username,
        role=role,
        action_type='feature_access',
        feature_name='feature5',
        session_id=session.get('session_id')
    )
    
    # Get all users for messaging
    all_users = MessageManager.get_all_users()
    available_users = [user for user in all_users if user != username]
    
    # Get messages
    messages = MessageManager.get_messages(username, role)
    
    # Get unread count
    unread_count = MessageManager.get_unread_count(username)
    
    return render_template(
        'messaging.html',
        username=username,
        role=role,
        available_users=available_users,
        messages=messages,
        unread_count=unread_count
    )

@feature5_bp.route('/send_message', methods=['POST'])
@login_required
@role_required(['soldier', 'captain'])
def send_message():
    try:
        data = request.get_json()
        sender = session.get('username')
        role = session.get('role')
        message_text = (data.get('message') or '').strip()
        recipient = (data.get('recipient') or '').strip()
        is_broadcast = data.get('is_broadcast', False)
        
        if not message_text:
            return jsonify({'success': False, 'error': 'Message cannot be empty'})
        
        # Check if broadcast is allowed (only captains)
        if is_broadcast and role != 'captain':
            return jsonify({'success': False, 'error': 'Only captains can broadcast messages'})
        
        # If not broadcast, need recipient
        if not is_broadcast and not recipient:
            return jsonify({'success': False, 'error': 'Recipient required for direct message'})
        
        # For broadcast, set recipient as None
        if is_broadcast:
            recipient = None
        
        # Send message
        message_id = MessageManager.send_message(sender, recipient, message_text, is_broadcast)
        
        if message_id:
            # Log activity
            DatabaseManager.log_activity(
                username=sender,
                role=role,
                action_type='message_sent',
                feature_name='feature5',
                session_id=session.get('session_id'),
                additional_data={
                    'recipient': recipient if recipient else 'broadcast',
                    'is_broadcast': is_broadcast,
                    'message_id': message_id
                }
            )
            
            return jsonify({'success': True, 'message_id': message_id})
        else:
            return jsonify({'success': False, 'error': 'Failed to send message'})
            
    except Exception as e:
        print(f"Error in send_message: {e}")
        return jsonify({'success': False, 'error': 'Server error occurred'})

@feature5_bp.route('/get_messages')
@login_required
@role_required(['soldier', 'captain'])
def get_messages():
    try:
        username = session.get('username')
        role = session.get('role')
        
        messages = MessageManager.get_messages(username, role)
        unread_count = MessageManager.get_unread_count(username)
        
        return jsonify({
            'success': True,
            'messages': messages,
            'unread_count': unread_count
        })
        
    except Exception as e:
        print(f"Error in get_messages: {e}")
        return jsonify({'success': False, 'error': 'Failed to load messages'})

@feature5_bp.route('/mark_read', methods=['POST'])
@login_required
@role_required(['soldier', 'captain'])
def mark_message_read():
    try:
        data = request.get_json()
        message_id = data.get('message_id')
        username = session.get('username')
        
        if message_id:
            MessageManager.mark_message_read(message_id, username)
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Message ID required'})
            
    except Exception as e:
        print(f"Error in mark_message_read: {e}")
        return jsonify({'success': False, 'error': 'Failed to mark message as read'})