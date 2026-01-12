# Email Configuration Guide - OTP Verification

## Overview
Email-based OTP (One-Time Password) verification has been implemented for user authentication. Users receive a 6-digit code via email during registration and can request new codes when logging in if not verified.

## Features Implemented
- ✅ 6-digit OTP generation and validation
- ✅ Email verification during registration
- ✅ Email verification requirement on login
- ✅ Code expiration (10 minutes)
- ✅ Resend code functionality with cooldown (60 seconds)
- ✅ Support for any email provider (Gmail, Outlook, Yahoo, etc.)
- ✅ Beautiful verification UI with real-time validation

## Email Provider Setup

### For Gmail
1. **Enable 2-Factor Authentication** on your Google account
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password

3. **Set environment variables**:
```bash
# Windows PowerShell
$env:MAIL_SERVER="smtp.gmail.com"
$env:MAIL_PORT="587"
$env:MAIL_USE_TLS="true"
$env:MAIL_USERNAME="your-email@gmail.com"
$env:MAIL_PASSWORD="your-app-password"
$env:MAIL_DEFAULT_SENDER="your-email@gmail.com"
```

### For Outlook/Hotmail
```bash
$env:MAIL_SERVER="smtp-mail.outlook.com"
$env:MAIL_PORT="587"
$env:MAIL_USE_TLS="true"
$env:MAIL_USERNAME="your-email@outlook.com"
$env:MAIL_PASSWORD="your-password"
$env:MAIL_DEFAULT_SENDER="your-email@outlook.com"
```

### For Yahoo
```bash
$env:MAIL_SERVER="smtp.mail.yahoo.com"
$env:MAIL_PORT="587"
$env:MAIL_USE_TLS="true"
$env:MAIL_USERNAME="your-email@yahoo.com"
$env:MAIL_PASSWORD="your-app-password"
$env:MAIL_DEFAULT_SENDER="your-email@yahoo.com"
```

### For Custom SMTP Server
```bash
$env:MAIL_SERVER="smtp.yourdomain.com"
$env:MAIL_PORT="587"  # or 465 for SSL
$env:MAIL_USE_TLS="true"  # or "false" if using SSL
$env:MAIL_USE_SSL="false"  # set to "true" if using port 465
$env:MAIL_USERNAME="your-email@yourdomain.com"
$env:MAIL_PASSWORD="your-password"
$env:MAIL_DEFAULT_SENDER="your-email@yourdomain.com"
```

## Database Migration
The User model has been updated with new fields. You need to either:

### Option 1: Fresh Start (Delete existing database)
```bash
# Stop the backend if running
# Then delete the database file
Remove-Item backend/instance/radio_link_planner.db
# Restart the backend - it will create a new database
```

### Option 2: Add columns manually (Keep existing data)
```python
# Run this in Python console from backend directory
from app import app, db
from sqlalchemy import text

with app.app_context():
    with db.engine.connect() as conn:
        conn.execute(text('ALTER TABLE users ADD COLUMN verification_code VARCHAR(6)'))
        conn.execute(text('ALTER TABLE users ADD COLUMN code_expiry DATETIME'))
        conn.execute(text('ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0'))
        conn.commit()
```

## Installation Steps

1. **Install Python dependencies**:
```bash
cd backend
pip install -r requirements.txt
```

2. **Set email environment variables** (see provider-specific instructions above)

3. **Delete old database** (or migrate - see above):
```bash
Remove-Item instance/radio_link_planner.db
```

4. **Start the backend**:
```bash
python app.py
```

5. **Frontend should automatically pick up changes** (it will restart if dev server is running)

## Testing the Flow

### Registration Flow
1. User fills registration form with username, email, and password
2. Backend creates user account and sends 6-digit code to email
3. User redirected to verification page
4. User enters code from email
5. Upon successful verification, user is logged in

### Login Flow (Unverified User)
1. User attempts to login
2. Backend detects unverified account
3. New verification code sent to email
4. User redirected to verification page
5. User enters code and completes verification

## API Endpoints

### POST /api/auth/register
Creates user and sends verification email.
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

Response:
```json
{
  "success": true,
  "message": "Registration successful. Please check your email for verification code.",
  "user_id": 1,
  "email": "john@example.com",
  "requires_verification": true
}
```

### POST /api/auth/verify-code
Verifies the OTP code.
```json
{
  "user_id": 1,
  "code": "123456"
}
```

Response:
```json
{
  "success": true,
  "message": "Email verified successfully",
  "user": { ... },
  "token": "jwt-token-here"
}
```

### POST /api/auth/resend-code
Resends verification code.
```json
{
  "user_id": 1
}
```

Response:
```json
{
  "success": true,
  "message": "Verification code resent successfully"
}
```

### POST /api/auth/login
Login with email verification check.
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

Response (if not verified):
```json
{
  "success": false,
  "message": "Email not verified. A new verification code has been sent to your email.",
  "requires_verification": true,
  "user_id": 1
}
```

## Troubleshooting

### Emails Not Sending
1. **Check environment variables** are set correctly
2. **Verify SMTP credentials** are correct
3. **Check spam folder** - verification emails might be flagged
4. **Check backend logs** for detailed error messages
5. **For Gmail**: Make sure you're using an App Password, not your regular password
6. **Firewall**: Ensure port 587 (or 465) is not blocked

### Code Expired
- Codes expire after 10 minutes
- User can click "Resend Code" to get a new one
- 60-second cooldown between resend requests

### Frontend Not Redirecting
- Check browser console for errors
- Verify router is configured in app.config.ts
- Clear session storage and try again

### Database Errors
- If you get column errors, you need to migrate the database (see Database Migration section)
- Easiest solution: delete the database file and let it recreate

## Security Considerations

1. **Codes expire in 10 minutes** - prevents replay attacks
2. **6-digit numeric codes** - balance between security and usability
3. **Resend cooldown** - prevents spam/abuse
4. **Codes stored hashed** - could be added for extra security
5. **Email verification required** - ensures valid email addresses
6. **Environment variables** - sensitive data not hardcoded

## Email Template Customization

The verification email template is in `backend/app.py` in the `send_verification_email()` function. You can customize:
- Subject line
- Email body text
- Sender name
- HTML formatting (upgrade to HTML emails)

## Future Enhancements
- SMS verification option
- HTML email templates with styling
- Rate limiting on verification attempts
- Remember verified devices
- Multi-language support for emails
- Email service integration (SendGrid, Mailgun, AWS SES)
