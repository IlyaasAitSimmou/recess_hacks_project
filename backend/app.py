from flask import Flask, request, jsonify
from flask_cors import CORS
import hashlib
import jwt
import datetime
from functools import wraps
import sqlite3
import os
import json
import google.generativeai as genai
from supabase import create_client, Client
import os
from flask import Flask, request, jsonify

app = Flask(__name__)

SUPABASE_URL = "https://pmniwmjnvqrofgmkpkjp.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtbml3bWpudnFyb2ZnbWtwa2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5ODQ1ODIsImV4cCI6MjA3MTU2MDU4Mn0.nNsFtV30WZ8jQebR6uUzwNfEGW4u4FUYrEgYVo_V6kI"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
app.config['SECRET_KEY'] = 'your-secret-key-here'  # Change this in production
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

DATABASE = 'users.db'

# Configure Gemini AI (you'll need to set your API key)
# Get your free API key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'your-gemini-api-key-here')
if GEMINI_API_KEY != 'your-gemini-api-key-here':
    genai.configure(api_key=GEMINI_API_KEY)

# Create upload directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def init_db():
    """Initialize the database"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Folders table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            parent_id INTEGER,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (parent_id) REFERENCES folders (id)
        )
    ''')
    
    # Notes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT,
            folder_id INTEGER,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (folder_id) REFERENCES folders (id)
        )
    ''')
    
    # Attachments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (note_id) REFERENCES notes (id)
        )
    ''')
    
    conn.commit()
    conn.close()

def hash_password(password):
    """Hash a password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token(email):
    """Generate JWT token"""
    payload = {
        'email': email,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def token_required(f):
    """Decorator to require valid JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_email = data['email']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(current_user_email, *args, **kwargs)
    return decorated

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password')
    username = data.get('username') or email.split('@')[0]

    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400

    try:
        # Create user in Supabase
        user_data = supabase.auth.sign_up(
            {"email": email, "password": password, "options": {"data": {"username": username}}}
        )

        if user_data.user:
            # Generate a simple JWT token for compatibility with frontend
            token = generate_token(email)
            
            return jsonify({
                "token": token,
                "email": email,
                "message": "User created successfully"
            }), 201
        else:
            return jsonify({'error': 'Failed to create user'}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400

    try:
        session = supabase.auth.sign_in_with_password({"email": email, "password": password})

        if not session.user:
            return jsonify({'error': 'Invalid credentials'}), 401

        # Generate a simple JWT token for compatibility with frontend
        token = generate_token(email)

        return jsonify({
            "token": token,
            "email": email,
            "message": "Login successful"
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/logout', methods=['POST'])
@token_required
def logout(current_user_email):
    """User logout endpoint"""
    # In a real app, you might want to blacklist the token
    return jsonify({'message': 'Logout successful'}), 200

@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user_email):
    """Get user profile (protected route example)"""
    return jsonify({
        'email': current_user_email,
        'message': 'Profile data retrieved successfully'
    }), 200

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'API is running'}), 200

# Notes and Folders API Endpoints

@app.route('/api/folders', methods=['GET'])
@token_required
def get_folders(current_user_email):
    """Get all folders for the current user"""
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Get user ID
        cursor.execute('SELECT id FROM users WHERE email = ?', (current_user_email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user_id = user[0]
        
        # Get folders
        cursor.execute('''
            SELECT id, name, parent_id, created_at 
            FROM folders 
            WHERE user_id = ? 
            ORDER BY created_at ASC
        ''', (user_id,))
        
        folders = []
        for row in cursor.fetchall():
            folders.append({
                'id': row[0],
                'name': row[1],
                'parent_id': row[2],
                'created_at': row[3]
            })
        
        conn.close()
        return jsonify({'folders': folders}), 200
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/folders', methods=['POST'])
@token_required
def create_folder(current_user_email):
    """Create a new folder"""
    try:
        data = request.get_json()
        if not data or not data.get('name'):
            return jsonify({'error': 'Folder name is required'}), 400
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Get user ID
        cursor.execute('SELECT id FROM users WHERE email = ?', (current_user_email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user_id = user[0]
        
        # Create folder
        cursor.execute('''
            INSERT INTO folders (name, parent_id, user_id) 
            VALUES (?, ?, ?)
        ''', (data['name'], data.get('parent_id'), user_id))
        
        folder_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Folder created successfully',
            'folder_id': folder_id
        }), 201
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/notes', methods=['GET'])
@token_required
def get_notes(current_user_email):
    """Get all notes for the current user"""
    try:
        folder_id = request.args.get('folder_id')
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Get user ID
        cursor.execute('SELECT id FROM users WHERE email = ?', (current_user_email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user_id = user[0]
        
        # Get notes
        if folder_id:
            cursor.execute('''
                SELECT id, title, content, folder_id, created_at, updated_at 
                FROM notes 
                WHERE user_id = ? AND folder_id = ?
                ORDER BY updated_at DESC
            ''', (user_id, folder_id))
        else:
            cursor.execute('''
                SELECT id, title, content, folder_id, created_at, updated_at 
                FROM notes 
                WHERE user_id = ? AND folder_id IS NULL
                ORDER BY updated_at DESC
            ''', (user_id,))
        
        notes = []
        for row in cursor.fetchall():
            notes.append({
                'id': row[0],
                'title': row[1],
                'content': row[2],
                'folder_id': row[3],
                'created_at': row[4],
                'updated_at': row[5]
            })
        
        conn.close()
        return jsonify({'notes': notes}), 200
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/notes', methods=['POST'])
@token_required
def create_note(current_user_email):
    """Create a new note"""
    try:
        data = request.get_json()
        if not data or not data.get('title'):
            return jsonify({'error': 'Note title is required'}), 400
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Get user ID
        cursor.execute('SELECT id FROM users WHERE email = ?', (current_user_email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user_id = user[0]
        
        # Create note
        cursor.execute('''
            INSERT INTO notes (title, content, folder_id, user_id) 
            VALUES (?, ?, ?, ?)
        ''', (data['title'], data.get('content', ''), data.get('folder_id'), user_id))
        
        note_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Note created successfully',
            'note_id': note_id
        }), 201
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/notes/<int:note_id>', methods=['PUT'])
@token_required
def update_note(current_user_email, note_id):
    """Update a note"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        
        # Get user ID
        cursor.execute('SELECT id FROM users WHERE email = ?', (current_user_email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user_id = user[0]
        
        # Update note
        cursor.execute('''
            UPDATE notes 
            SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        ''', (data.get('title'), data.get('content'), note_id, user_id))
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'Note not found or access denied'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Note updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/ai/chat', methods=['POST'])
@token_required
def ai_chat(current_user_email):
    """Chat with AI about notes"""
    try:
        if GEMINI_API_KEY == 'your-gemini-api-key-here':
            return jsonify({'error': 'Gemini API key not configured'}), 503
            
        data = request.get_json()
        if not data or not data.get('message'):
            return jsonify({'error': 'Message is required'}), 400
        
        # Get user ID
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM users WHERE email = ?', (current_user_email,))
        user_result = cursor.fetchone()
        if not user_result:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        user_id = user_result[0]
        
        # Get all user's notes and folders for context
        cursor.execute('''
            SELECT n.id, n.title, n.content, n.folder_id, f.name as folder_name
            FROM notes n
            LEFT JOIN folders f ON n.folder_id = f.id
            WHERE n.user_id = ?
            ORDER BY n.updated_at DESC
        ''', (user_id,))
        all_notes = cursor.fetchall()
        
        cursor.execute('SELECT id, name, parent_id FROM folders WHERE user_id = ?', (user_id,))
        all_folders = cursor.fetchall()
        conn.close()
        
        # Initialize Gemini model
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Prepare comprehensive context
        user_message = data['message']
        current_note_context = data.get('context', '')
        current_note_id = data.get('note_id', None)
        
        # Format all notes for AI context
        notes_context = "All User's Notes:\n"
        for note in all_notes:
            note_id, title, content, folder_id, folder_name = note
            folder_info = f" (in folder: {folder_name})" if folder_name else " (in root)"
            notes_context += f"\n--- Note ID: {note_id} ---\nTitle: {title}{folder_info}\nContent: {content[:500]}{'...' if len(content) > 500 else ''}\n"
        
        # Format folders for AI context
        folders_context = "\nUser's Folders:\n"
        for folder in all_folders:
            folder_id, name, parent_id = folder
            parent_info = f" (parent: {parent_id})" if parent_id else " (root level)"
            folders_context += f"Folder ID: {folder_id}, Name: {name}{parent_info}\n"
        
        # Create comprehensive prompt
        prompt = f"""
        You are an advanced AI assistant for a note-taking application with full note management capabilities.
        
        CURRENT USER: {current_user_email}
        
        AVAILABLE ACTIONS:
        1. READ: You can see all user's notes and folders
        2. CREATE: Create new notes with rich formatting
        3. EDIT: Modify existing notes
        4. FORMAT: Use HTML formatting, LaTeX math, diagrams
        5. ORGANIZE: Suggest folder organization
        
        FORMATTING CAPABILITIES:
        - HTML tags: <b>, <i>, <u>, <h1>-<h6>, <p>, <ul>, <ol>, <li>
        - LaTeX math: Use $inline math$ or $$display math$$
        - Font sizes: <span style="font-size: 12px;">text</span>
        - Colors: <span style="color: red;">text</span>
        - Diagrams: ASCII art, flowcharts, or suggest drawing mode
        
        USER'S CURRENT CONTEXT:
        {notes_context}
        
        {folders_context}
        
        CURRENT NOTE CONTEXT: {current_note_context if current_note_context else "No specific note selected"}
        CURRENT NOTE ID: {current_note_id if current_note_id else "None"}
        
        USER MESSAGE: {user_message}
        
        INSTRUCTIONS:
        - If user asks to create/edit notes, provide the formatted content
        - Use LaTeX for any mathematical expressions
        - Suggest specific actions like "CREATE_NOTE", "EDIT_NOTE", "ORGANIZE_FOLDERS"
        - Be proactive in improving and organizing their notes
        - Create diagrams using ASCII art when helpful
        - Use rich HTML formatting for better readability
        
        Respond helpfully and take action on their notes when appropriate.
        """
        
        # Generate response
        response = model.generate_content(prompt)
        
        # Parse AI response for actions
        ai_response = response.text
        actions = []
        
        # Check if AI wants to create or edit notes
        if "CREATE_NOTE:" in ai_response:
            # Extract note creation instructions
            pass
        elif "EDIT_NOTE:" in ai_response:
            # Extract note editing instructions
            pass
        
        return jsonify({
            'response': ai_response,
            'actions': actions,
            'message': 'AI response with full note access generated successfully'
        }), 200
        
    except Exception as e:
        error_str = str(e)
        
        # Check if it's a quota/rate limit error
        if "429" in error_str or "RATE_LIMIT_EXCEEDED" in error_str or "Quota exceeded" in error_str:
            # Provide helpful fallback responses based on common queries
            user_message = data.get('message', '').lower()
            
            # Generate contextual fallback responses with note management
            if any(word in user_message for word in ['create', 'new note', 'make']):
                fallback_response = "I'd love to help you create a new note! I can format it with:\n\n• **Rich text formatting** (bold, italic, headers)\n• LaTeX math expressions like $x^2 + y^2 = r^2$\n• Organized structure with bullet points\n• Proper headings and sections\n\nWhat topic would you like me to create a note about?"
            elif any(word in user_message for word in ['edit', 'modify', 'change']):
                fallback_response = "I can help edit your notes with advanced formatting:\n\n• Add **mathematical equations** using LaTeX\n• Improve structure with headers and lists\n• Add diagrams and visual elements\n• Organize content by topics\n\nWhich note would you like me to enhance?"
            elif any(word in user_message for word in ['math', 'equation', 'formula']):
                fallback_response = "I can add mathematical content to your notes using LaTeX:\n\n• Inline math: $E = mc^2$\n• Display equations: $$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\n• Complex formulas with proper formatting\n• Chemical equations and scientific notation\n\nWhat mathematical content would you like me to add?"
            elif any(word in user_message for word in ['diagram', 'chart', 'visual']):
                fallback_response = "I can create diagrams and visual elements:\n\n```\n    ┌─────────┐\n    │ Process │\n    └─────────┘\n         │\n         ▼\n    ┌─────────┐\n    │ Result  │\n    └─────────┘\n```\n\nI can also suggest using the drawing mode for complex diagrams. What type of diagram do you need?"
            else:
                fallback_response = f"I'm experiencing high demand but I can still help you manage your notes! I can:\n\n• **Create new notes** with rich formatting\n• **Edit existing notes** with LaTeX math\n• **Organize your content** with proper structure\n• **Add diagrams** and visual elements\n• **Format text** with various styles and sizes\n\nWhat would you like me to help you with? '{user_message[:50]}...' sounds interesting!"
            
            return jsonify({
                'response': fallback_response + "\n\n💡 **Note**: I'm currently experiencing high demand. For full AI assistance, try again in a few minutes.",
                'actions': [],
                'message': 'Fallback response with note management features'
            }), 200
        else:
            return jsonify({'error': f'AI service error: {str(e)}'}), 500

# New endpoint for AI to create notes
@app.route('/api/ai/create-note', methods=['POST'])
@token_required
def ai_create_note(current_user_email):
    """Allow AI to create notes"""
    try:
        # Get user ID
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM users WHERE email = ?', (current_user_email,))
        user_result = cursor.fetchone()
        if not user_result:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        user_id = user_result[0]
        
        data = request.get_json()
        title = data.get('title', 'AI Generated Note')
        content = data.get('content', '')
        folder_id = data.get('folder_id', None)
        
        cursor.execute('''
            INSERT INTO notes (title, content, folder_id, user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ''', (title, content, folder_id, user_id))
        
        note_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({
            'note_id': note_id,
            'title': title,
            'content': content,
            'folder_id': folder_id,
            'message': 'Note created successfully by AI'
        }), 201
        
    except Exception as e:
        return jsonify({'error': 'Failed to create note'}), 500

# New endpoint for AI to edit notes
@app.route('/api/ai/edit-note/<int:note_id>', methods=['PUT'])
@token_required
def ai_edit_note(current_user_email, note_id):
    """Allow AI to edit notes"""
    try:
        # Get user ID
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM users WHERE email = ?', (current_user_email,))
        user_result = cursor.fetchone()
        if not user_result:
            conn.close()
            return jsonify({'error': 'User not found'}), 404
        user_id = user_result[0]
        
        # Check if note belongs to user
        cursor.execute('SELECT id, title, content FROM notes WHERE id = ? AND user_id = ?', (note_id, user_id))
        note = cursor.fetchone()
        if not note:
            conn.close()
            return jsonify({'error': 'Note not found'}), 404
        
        data = request.get_json()
        new_title = data.get('title')
        new_content = data.get('content')
        
        # Update note
        if new_title and new_content:
            cursor.execute('''
                UPDATE notes 
                SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            ''', (new_title, new_content, note_id, user_id))
        elif new_content:
            cursor.execute('''
                UPDATE notes 
                SET content = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            ''', (new_content, note_id, user_id))
        elif new_title:
            cursor.execute('''
                UPDATE notes 
                SET title = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            ''', (new_title, note_id, user_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'note_id': note_id,
            'message': 'Note updated successfully by AI'
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to update note'}), 500

@app.route('/api/render-video', methods=['POST'])
def render_video():
    """Render a video using Manim - NO FALLBACKS, MANIM MUST WORK"""
    try:
        data = request.get_json()
        manim_code = data.get('manimCode', '')
        print(f"Received Manim code:\n{manim_code}")
        file_name = data.get('fileName', 'untitled')
        topic = data.get('topic', 'Untitled Video')
        
        if not manim_code:
            return jsonify({'error': 'No Manim code provided'}), 400
        
        # Clean filename for safety
        safe_filename = "".join(c for c in file_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_filename = safe_filename.replace(' ', '_')
        
        # Create videos directory if it doesn't exist
        videos_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'videos')
        os.makedirs(videos_dir, exist_ok=True)
        
        # Create a temporary Python file with the Manim code
        temp_py_file = os.path.join(videos_dir, f'{safe_filename}_temp.py')
        
        with open(temp_py_file, 'w') as f:
            f.write(manim_code)
        
        try:
            import subprocess
            import shutil
            import re
            
            # Extract scene class name from the code
            scene_match = re.search(r'class\s+(\w+)\s*\(.*Scene.*\):', manim_code)
            scene_name = scene_match.group(1) if scene_match else 'VideoLesson'
            
            # Path to Python 3.12 virtual environment
            venv_python = os.path.join(os.path.dirname(__file__), 'venv312', 'bin', 'python')
            venv_manim = os.path.join(os.path.dirname(__file__), 'venv312', 'bin', 'manim')
            
            # Check if venv manim exists
            if not os.path.exists(venv_manim):
                raise Exception(f"Manim not found in virtual environment: {venv_manim}")
            
            # Run manim command using the virtual environment
            cmd = [
                venv_manim,
                '-pql',  # preview, quality low, write to file
                '--media_dir', videos_dir,
                temp_py_file,
                scene_name
            ]
            
            print(f"Running Manim command: {' '.join(cmd)}")
            
            # Run manim with timeout
            result = subprocess.run(
                cmd,
                timeout=180,  # 3 minute timeout
                capture_output=True,
                text=True,
                cwd=videos_dir
            )
            
            print(f"Manim exit code: {result.returncode}")
            print(f"Manim stdout: {result.stdout}")
            print(f"Manim stderr: {result.stderr}")
            
            if result.returncode != 0:
                raise Exception(f"Manim failed with exit code {result.returncode}: {result.stderr}")
            
            # Manim succeeded, find the generated video file
            # Manim typically outputs to: media_dir/videos/scene_file/quality/scene_name.mp4
            manim_output_dir = os.path.join(videos_dir, 'videos', os.path.splitext(os.path.basename(temp_py_file))[0], '480p15')
            expected_video = os.path.join(manim_output_dir, f'{scene_name}.mp4')
            
            print(f"Looking for video at: {expected_video}")
            
            if not os.path.exists(expected_video):
                # Try alternative output locations
                alternative_paths = [
                    os.path.join(videos_dir, 'videos', os.path.splitext(os.path.basename(temp_py_file))[0], '480p15', f'{scene_name}.mp4'),
                    os.path.join(videos_dir, 'videos', os.path.splitext(os.path.basename(temp_py_file))[0], '720p30', f'{scene_name}.mp4'),
                    os.path.join(videos_dir, 'videos', os.path.splitext(os.path.basename(temp_py_file))[0], '1080p60', f'{scene_name}.mp4'),
                ]
                
                for alt_path in alternative_paths:
                    print(f"Checking alternative path: {alt_path}")
                    if os.path.exists(alt_path):
                        expected_video = alt_path
                        break
                else:
                    # List what was actually created
                    if os.path.exists(os.path.join(videos_dir, 'videos')):
                        print("Contents of videos directory:")
                        for root, dirs, files in os.walk(os.path.join(videos_dir, 'videos')):
                            for file in files:
                                print(f"  {os.path.join(root, file)}")
                    raise Exception(f"Video file not found. Expected at: {expected_video}")
            
            final_video_path = os.path.join(videos_dir, f'{safe_filename}.mp4')
            
            # Move the video to our desired location
            shutil.move(expected_video, final_video_path)
            
            # Clean up temporary directories
            try:
                shutil.rmtree(os.path.join(videos_dir, 'videos'))
            except Exception as cleanup_error:
                print(f"Cleanup warning: {cleanup_error}")
            
            print(f"Video successfully created: {final_video_path}")
            
            return jsonify({
                'success': True,
                'video_path': f'/videos/{safe_filename}.mp4',
                'message': f'Video "{topic}" rendered successfully with Manim',
                'method': 'manim'
            }), 200
        
        finally:
            # Clean up temporary Python file
            if os.path.exists(temp_py_file):
                try:
                    os.remove(temp_py_file)
                except Exception as cleanup_error:
                    print(f"Temp file cleanup warning: {cleanup_error}")
        
    except Exception as e:
        error_msg = f'Manim video rendering failed: {str(e)}'
        print(error_msg)
        return jsonify({'error': error_msg}), 500

if __name__ == '__main__':
    # Initialize database on startup
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5001)