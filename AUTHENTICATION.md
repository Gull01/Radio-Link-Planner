# Authentication System

## Overview
The Radio Link Planner now includes a complete authentication system with user registration, login, and session management.

## Features

### 🔐 User Authentication
- **Email-based authentication** with secure password hashing
- **JWT token** authentication for secure API access
- **Password validation** with strength requirements:
  - Minimum 6 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number

### 🎨 Beautiful UI with Animations
- **Welcome Screen**: Smooth animated introduction with floating elements and particle effects
- **Login/Register Forms**: Clean, modern forms with smooth transitions and validation feedback
- **User Menu**: Dropdown menu showing user info and logout option

### 🚀 User Flow
1. **Welcome Screen**: Animated welcome screen with app introduction
2. **Login/Register**: Seamless toggle between sign-in and sign-up
3. **Main Application**: Full access to map, projects, and analysis tools
4. **User Profile**: User info displayed in header with logout option

## Technical Implementation

### Frontend (Angular)
- **AuthService**: Handles authentication logic, token management, and user state
- **LoginComponent**: Beautiful login/register form with animations
- **WelcomeComponent**: Enhanced with smooth animations and hover effects
- **Integration**: Authentication flow integrated into main app component

### Backend (Flask)
- **User Model**: SQLAlchemy model with password hashing using Werkzeug
- **Auth Endpoints**:
  - `POST /api/auth/register` - Create new user account
  - `POST /api/auth/login` - Authenticate user and get JWT token
- **JWT Tokens**: 30-day expiration, stored in localStorage
- **Password Security**: Bcrypt hashing via Werkzeug's security module

## API Endpoints

### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "created_at": "2025-12-23T10:00:00"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "created_at": "2025-12-23T10:00:00"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Animation Features

### Welcome Screen
- **Particle Background**: Animated grid pattern
- **Floating Animation**: Content floats gently
- **Tower Animation**: Pulse and bounce effects on radio towers
- **Interactive Button**: Ripple effect on hover with arrow bounce
- **Feature Cards**: Staggered fade-in with hover lift effect

### Login/Register Screen
- **Slide Animations**: Smooth transitions when toggling modes
- **Pulse Animation**: Logo pulses continuously
- **Shake Effect**: Error feedback animation
- **Smooth Transitions**: All state changes animated
- **Loading States**: Spinner animation during API calls

### User Interface
- **Dropdown Animation**: Smooth slide-down with fade
- **User Avatar**: Gradient circle with initial letter
- **Hover Effects**: All interactive elements have smooth hover states
- **Color Scheme**: Consistent purple gradient theme throughout

## Security Notes

⚠️ **Production Recommendations**:
1. Change the `SECRET_KEY` in `backend/app.py` (currently using a default value)
2. Use environment variables for sensitive configuration
3. Implement HTTPS for production deployment
4. Add rate limiting to prevent brute force attacks
5. Implement email verification for new accounts
6. Add password reset functionality

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Usage

1. **Start the application** - Both frontend and backend will run
2. **View welcome screen** - Animated introduction with "Get Started" button
3. **Create account** - Toggle to "Sign Up" and enter details
4. **Login** - Use your email and password
5. **Use the app** - Full access to all features
6. **Logout** - Click user menu in header and select logout

## Files Modified/Created

### Frontend
- `src/app/services/auth.service.ts` - Authentication service
- `src/app/components/login/` - Login/register component
- `src/app/components/welcome/welcome.css` - Enhanced animations
- `src/app/components/tabs/tabs.ts` - Added user menu and logout
- `src/app/components/tabs/tabs.html` - User menu UI
- `src/app/components/tabs/tabs.css` - User menu styles
- `src/app/app.ts` - Auth flow integration
- `src/app/app.html` - Conditional rendering

### Backend
- `backend/models.py` - Added User model
- `backend/app.py` - Added auth endpoints
- `backend/requirements.txt` - Added PyJWT dependency

## Future Enhancements

- [ ] Email verification
- [ ] Password reset via email
- [ ] Social login (Google, GitHub)
- [ ] Two-factor authentication
- [ ] User profile management
- [ ] Account settings page
- [ ] Remember me functionality
- [ ] Session timeout notifications
