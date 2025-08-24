# Authentication App - Next.js + Flask

The app is a digital assistant and productivity hub that helps teens learn, organize, and manage their lives more independently, with strong support for both academic and practical life skills.

A full-stack authentication application with Next.js frontend and Flask backend, featuring a comprehensive notes system with AI integration.

## Features

- **Authentication**: User registration and login with JWT tokens
- **Notes System**: Hierarchical folder/note organization
- **Rich Text Editing**: Google Docs-like editor with formatting
- **Drawing Mode**: Canvas-based drawing for tablets/stylus
- **LaTeX Math**: Mathematical equation support
- **AI Assistant**: Google Gemini-powered chatbot for note analysis
- **File Attachments**: Image and file upload support
<img width="770" height="804" alt="Screenshot 2025-08-24 184908" src="https://github.com/user-attachments/assets/2f142ae7-380e-4bdc-be62-11587175f6b2" />

## Project Structure

```
├── backend/
│   ├── app.py              
│   ├── requirements.txt    
│   └── users.db           
├── frontend/
│   ├── app/
│   │   ├── page.tsx       
│   │   ├── login/         
│   │   ├── signup/        
│   │   └── dashboard/     
│   └── lib/
│       └── api.ts         
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

3. **Set up Gemini AI**:

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

# Technology Stack

## Backend

- Flask - Python web framework, connecting to Gemini
- Flask-CORS - Cross-origin resource sharing
- PyJWT - JSON Web Token implementation
- Supabase - Securely stores all user data, including authentication, notes, budgets, and other records
- hashlib - Password hashing
- Nomnitin - Maps API
- Manim - Math Video Explainer 

## Frontend

- Next.js 15 - React framework providing a fast, responsive, and modern interface
- TypeScript / TSX - Type safety for frontend development
- Tailwind CSS - Styling
- React Hooks - State management

## Security Features

- Password hashing using SHA-256
- JWT tokens for authentication
- CORS enabled for cross-origin requests
- Input validation and error handling
- Protected routes requiring authentication

## Development Notes

- JWT tokens expire after 24 hours
- Frontend stores tokens in localStorage
- All API endpoints return JSON responses
- Error handling implemented on both frontend and backend
