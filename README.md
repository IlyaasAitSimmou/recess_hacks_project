# Authentication App - Next.js + Flask

A full-stack authentication application with Next.js frontend and Flask backend, featuring a comprehensive notes system with AI integration.

## Features

- **Authentication**: User registration and login with JWT tokens
- **Notes System**: Hierarchical folder/note organization
- **Rich Text Editing**: Google Docs-like editor with formatting
- **Drawing Mode**: Canvas-based drawing for tablets/stylus
- **LaTeX Math**: Mathematical equation support
- **AI Assistant**: Google Gemini-powered chatbot for note analysis
- **File Attachments**: Image and file upload support
- **Responsive Design**: Works on desktop and mobile devices

## Project Structure

```
├── backend/
│   ├── app.py              # Flask application
│   ├── requirements.txt    # Python dependencies
│   └── users.db           # SQLite database (created automatically)
├── frontend/
│   ├── app/
│   │   ├── page.tsx       # Home page
│   │   ├── login/         # Login page
│   │   ├── signup/        # Signup page
│   │   └── dashboard/     # Protected dashboard
│   └── lib/
│       └── api.ts         # API client utilities
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up Gemini AI (Optional but recommended)**:
   - Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Set the environment variable:
     ```bash
     export GEMINI_API_KEY="your-api-key-here"
     ```
   - Or edit `app.py` and replace `'your-gemini-api-key-here'` with your actual key

4. Run the Flask server:
   ```bash
   python app.py
   ```

The backend will be available at `http://localhost:5001`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:3000` or `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/signup` - Register a new user
- `POST /api/login` - Login user
- `POST /api/logout` - Logout user (requires token)

### Notes System
- `GET /api/folders` - Get all folders for user
- `POST /api/folders` - Create a new folder
- `GET /api/notes` - Get notes (optional folder_id parameter)
- `POST /api/notes` - Create a new note
- `PUT /api/notes/<id>` - Update a note

### AI Integration
- `POST /api/ai/chat` - Chat with AI about notes

### Utility
- `GET /api/health` - Health check

## Usage

1. Start both the backend and frontend servers
2. Navigate to `http://localhost:3000`
3. Click "Sign Up" to create a new account
4. Login with your credentials
5. Access the protected dashboard

## Technology Stack

### Backend
- Flask - Python web framework
- Flask-CORS - Cross-origin resource sharing
- PyJWT - JSON Web Token implementation
- SQLite - Database
- hashlib - Password hashing

### Frontend
- Next.js 15 - React framework
- TypeScript - Type safety
- Tailwind CSS - Styling
- React Hooks - State management

## Security Features

- Password hashing using SHA-256
- JWT tokens for authentication
- CORS enabled for cross-origin requests
- Input validation and error handling
- Protected routes requiring authentication

## Development Notes

- The SQLite database is created automatically when the Flask app starts
- JWT tokens expire after 24 hours
- Frontend stores tokens in localStorage
- All API endpoints return JSON responses
- Error handling implemented on both frontend and backend
