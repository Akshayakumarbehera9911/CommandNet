from database import DatabaseManager
from datetime import datetime
import json

class MessageManager:
    @staticmethod
    def send_message(sender, recipient, message, is_broadcast=False):
        """Send a message to a user or broadcast to all"""
        try:
            with DatabaseManager.get_db_connection() as conn:
                cursor = conn.cursor()
                
                query = """
                    INSERT INTO messages (sender, recipient, message, is_broadcast)
                    VALUES (%s, %s, %s, %s)
                """
                
                cursor.execute(query, (sender, recipient, message, is_broadcast))
                conn.commit()
                return cursor.lastrowid
                
        except Exception as e:
            print(f"Error sending message: {e}")
            return None
    
    @staticmethod
    def get_messages(username, role):
        """Get messages for a specific user"""
        try:
            with DatabaseManager.get_db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                
                # Get messages sent to user directly or broadcast messages
                query = """
                    SELECT m.*, 
                           CASE WHEN m.sender = %s THEN 'sent' ELSE 'received' END as message_type
                    FROM messages m
                    WHERE (m.recipient = %s OR (m.is_broadcast = TRUE AND m.sender != %s))
                    ORDER BY m.timestamp DESC
                    LIMIT 100
                """
                
                cursor.execute(query, (username, username, username))
                messages = cursor.fetchall()
                
                # Convert datetime to string for JSON serialization
                for msg in messages:
                    if msg.get('timestamp'):
                        msg['timestamp'] = msg['timestamp'].isoformat()
                
                return messages
                
        except Exception as e:
            print(f"Error getting messages: {e}")
            return []
    
    @staticmethod
    def mark_message_read(message_id, username):
        """Mark a message as read"""
        try:
            with DatabaseManager.get_db_connection() as conn:
                cursor = conn.cursor()
                
                query = """
                    UPDATE messages 
                    SET is_read = TRUE 
                    WHERE id = %s AND recipient = %s
                """
                
                cursor.execute(query, (message_id, username))
                conn.commit()
                
        except Exception as e:
            print(f"Error marking message as read: {e}")
    
    @staticmethod
    def get_unread_count(username):
        """Get count of unread messages for user"""
        try:
            with DatabaseManager.get_db_connection() as conn:
                cursor = conn.cursor()
                
                query = """
                    SELECT COUNT(*) as count 
                    FROM messages 
                    WHERE (recipient = %s OR (is_broadcast = TRUE AND sender != %s))
                    AND is_read = FALSE
                """
                
                cursor.execute(query, (username, username))
                result = cursor.fetchone()
                return result[0] if result else 0
                
        except Exception as e:
            print(f"Error getting unread count: {e}")
            return 0
    
    @staticmethod
    def get_all_users():
        """Get all users for messaging"""
        try:
            with open('config/users.json', 'r') as f:
                users_data = json.load(f)
                return list(users_data['users'].keys())
        except Exception as e:
            print(f"Error loading users: {e}")
            return []
    
    @staticmethod
    def get_user_role(username):
        """Get user role"""
        try:
            with open('config/users.json', 'r') as f:
                users_data = json.load(f)
                return users_data['users'].get(username, {}).get('role', 'soldier')
        except Exception as e:
            print(f"Error getting user role: {e}")
            return 'soldier'