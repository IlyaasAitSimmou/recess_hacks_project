# Authentication App - Next.js + Flask

A full-stack authentication application with Next.js frontend and Flask backend.

## Features

- User registration and login
- JWT-based authentication
- Protected routes
- Responsive design with Tailwind CSS
- RESTful API endpoints

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

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the Flask server:
   ```bash
   python app.py
   ```

The backend will be available at `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/signup` - Register a new user
- `POST /api/login` - Login user
- `POST /api/logout` - Logout user (requires token)

### Protected Routes
- `GET /api/profile` - Get user profile (requires token)

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
