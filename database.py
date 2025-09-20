import mysql.connector
from datetime import datetime
import json
from contextlib import contextmanager

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',  # Replace with your MySQL username
    'password': '0000',  # Replace with your MySQL password
    'database': 'military_webapp',  # Replace with your database name
    'auth_plugin': 'mysql_native_password'
}

class DatabaseManager:
    @staticmethod
    @contextmanager
    def get_db_connection():
        """Context manager for database connections"""
        connection = None
        try:
            connection = mysql.connector.connect(**DB_CONFIG)
            yield connection
        except mysql.connector.Error as err:
            print(f"Database error: {err}")
            if connection:
                connection.rollback()
            raise
        finally:
            if connection and connection.is_connected():
                connection.close()

    @staticmethod
    def init_database():
        """Initialize database tables and clear previous session data"""
        with DatabaseManager.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Create activity logs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS activity_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL,
                    role VARCHAR(20) NOT NULL,
                    action_type VARCHAR(50) NOT NULL,
                    feature_name VARCHAR(100),
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ip_address VARCHAR(45),
                    session_id VARCHAR(100),
                    additional_data JSON,
                    INDEX idx_username (username),
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_action_type (action_type)
                )
            """)
            
            # Create session tracking table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL,
                    role VARCHAR(20) NOT NULL,
                    login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    logout_time DATETIME NULL,
                    ip_address VARCHAR(45),
                    session_id VARCHAR(100) UNIQUE,
                    is_active BOOLEAN DEFAULT TRUE,
                    INDEX idx_username (username),
                    INDEX idx_session_id (session_id),
                    INDEX idx_is_active (is_active)
                )
            """)
            
            # Add after existing table creation in init_database method:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    sender VARCHAR(50) NOT NULL,
                    recipient VARCHAR(50) NULL,
                    message TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_broadcast BOOLEAN DEFAULT FALSE,
                    is_read BOOLEAN DEFAULT FALSE,
                    INDEX idx_sender (sender),
                    INDEX idx_recipient (recipient),
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_is_read (is_read)
                )
            """)
            
            # Clear all previous session data to start fresh
            print("Clearing previous session data...")
            cursor.execute("DELETE FROM activity_logs")
            cursor.execute("DELETE FROM user_sessions") 
            cursor.execute("DELETE FROM messages")
            
            # Reset auto-increment counters to start from 1
            cursor.execute("ALTER TABLE activity_logs AUTO_INCREMENT = 1")
            cursor.execute("ALTER TABLE user_sessions AUTO_INCREMENT = 1")
            cursor.execute("ALTER TABLE messages AUTO_INCREMENT = 1")
           
            conn.commit()
            print("Database tables initialized successfully - Starting with fresh session data")

    @staticmethod
    def log_activity(username, role, action_type, feature_name=None, ip_address=None, session_id=None, additional_data=None):
        """Log user activity"""
        try:
            with DatabaseManager.get_db_connection() as conn:
                cursor = conn.cursor()
                
                query = """
                    INSERT INTO activity_logs 
                    (username, role, action_type, feature_name, ip_address, session_id, additional_data)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """
                
                # Convert additional_data to JSON string if it's a dict
                if additional_data and isinstance(additional_data, dict):
                    additional_data = json.dumps(additional_data)
                
                cursor.execute(query, (username, role, action_type, feature_name, ip_address, session_id, additional_data))
                conn.commit()
                
        except Exception as e:
            print(f"Error logging activity: {e}")

    @staticmethod
    def log_login(username, role, ip_address=None, session_id=None):
        """Log user login"""
        try:
            with DatabaseManager.get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Insert new session
                query = """
                    INSERT INTO user_sessions 
                    (username, role, ip_address, session_id)
                    VALUES (%s, %s, %s, %s)
                """
                
                cursor.execute(query, (username, role, ip_address, session_id))
                conn.commit()
                
                # Also log as activity
                DatabaseManager.log_activity(username, role, 'login', ip_address=ip_address, session_id=session_id)
                
        except Exception as e:
            print(f"Error logging login: {e}")

    @staticmethod
    def log_logout(session_id):
        """Log user logout"""
        try:
            with DatabaseManager.get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Update session
                query = """
                    UPDATE user_sessions 
                    SET logout_time = NOW(), is_active = FALSE
                    WHERE session_id = %s
                """
                
                cursor.execute(query, (session_id,))
                
                # Get user info for activity log
                cursor.execute("SELECT username, role FROM user_sessions WHERE session_id = %s", (session_id,))
                result = cursor.fetchone()
                
                if result:
                    username, role = result
                    DatabaseManager.log_activity(username, role, 'logout', session_id=session_id)
                
                conn.commit()
                
        except Exception as e:
            print(f"Error logging logout: {e}")

    @staticmethod
    def get_activity_logs(username=None, limit=100, action_type=None, date_from=None, date_to=None):
        """Get activity logs with filtering"""
        try:
            with DatabaseManager.get_db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                
                query = "SELECT * FROM activity_logs WHERE 1=1"
                params = []
                
                if username:
                    query += " AND username = %s"
                    params.append(username)
                    
                if action_type:
                    query += " AND action_type = %s"
                    params.append(action_type)
                    
                if date_from:
                    query += " AND timestamp >= %s"
                    params.append(date_from)
                    
                if date_to:
                    query += " AND timestamp <= %s"
                    params.append(date_to)
                
                query += " ORDER BY timestamp DESC LIMIT %s"
                params.append(limit)
                
                cursor.execute(query, params)
                return cursor.fetchall()
                
        except Exception as e:
            print(f"Error getting activity logs: {e}")
            return []

    @staticmethod
    def get_dashboard_stats():
        """Get dashboard statistics for commander"""
        try:
            with DatabaseManager.get_db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                
                stats = {}
                
                # Total soldiers
                cursor.execute("SELECT COUNT(DISTINCT username) as count FROM activity_logs WHERE role = 'soldier'")
                result = cursor.fetchone()
                stats['total_soldiers'] = result['count'] if result else 0
                
                # Active sessions today
                cursor.execute("""
                    SELECT COUNT(*) as count FROM user_sessions 
                    WHERE DATE(login_time) = CURDATE() AND role = 'soldier'
                """)
                result = cursor.fetchone()
                stats['active_today'] = result['count'] if result else 0
                
                # Most used features
                cursor.execute("""
                    SELECT feature_name, COUNT(*) as usage_count 
                    FROM activity_logs 
                    WHERE action_type = 'feature_access' AND feature_name IS NOT NULL
                    GROUP BY feature_name 
                    ORDER BY usage_count DESC 
                    LIMIT 5
                """)
                stats['popular_features'] = cursor.fetchall()
                
                # Recent activity (last 10)
                cursor.execute("""
                    SELECT username, action_type, feature_name, timestamp 
                    FROM activity_logs 
                    ORDER BY timestamp DESC 
                    LIMIT 10
                """)
                stats['recent_activity'] = cursor.fetchall()
                
                # Soldier activity summary
                cursor.execute("""
                    SELECT 
                        username,
                        COUNT(*) as total_actions,
                        MAX(timestamp) as last_activity,
                        COUNT(DISTINCT DATE(timestamp)) as active_days
                    FROM activity_logs 
                    WHERE role = 'soldier'
                    GROUP BY username
                    ORDER BY last_activity DESC
                """)
                stats['soldier_summary'] = cursor.fetchall()
                
                return stats
                
        except Exception as e:
            print(f"Error getting dashboard stats: {e}")
            return {}

# Initialize database when module is imported
try:
    DatabaseManager.init_database()
except Exception as e:
    print(f"Failed to initialize database: {e}")