from flask import Blueprint, render_template, request, redirect, url_for, session, flash
import json
from werkzeug.security import check_password_hash

auth_bp = Blueprint('auth', __name__)

def load_users():
    try:
        with open('config/users.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {"users": {}}

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        users_data = load_users()
        user = users_data['users'].get(username)
        
        if user and user['password'] == password:
            session['username'] = username
            session['role'] = user['role']
            session['features'] = user['features']
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password', 'error')
    
    return render_template('login.html')

@auth_bp.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out successfully', 'info')
    return redirect(url_for('auth.login'))