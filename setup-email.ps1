# Email Configuration Setup Script
# Run this script to set up email environment variables for OTP verification

Write-Host "=== Email OTP Configuration Setup ===" -ForegroundColor Cyan
Write-Host ""

# Ask user to select email provider
Write-Host "Select your email provider:" -ForegroundColor Yellow
Write-Host "1. Gmail"
Write-Host "2. Outlook/Hotmail"
Write-Host "3. Yahoo"
Write-Host "4. Custom SMTP Server"
Write-Host ""

$provider = Read-Host "Enter choice (1-4)"

switch ($provider) {
    "1" {
        Write-Host "`nConfiguring for Gmail..." -ForegroundColor Green
        $env:MAIL_SERVER = "smtp.gmail.com"
        $env:MAIL_PORT = "587"
        $env:MAIL_USE_TLS = "true"
        $env:MAIL_USE_SSL = "false"
        
        Write-Host "`nIMPORTANT: For Gmail, you need to:" -ForegroundColor Yellow
        Write-Host "1. Enable 2-Factor Authentication"
        Write-Host "2. Generate an App Password at: https://myaccount.google.com/apppasswords"
        Write-Host ""
    }
    "2" {
        Write-Host "`nConfiguring for Outlook/Hotmail..." -ForegroundColor Green
        $env:MAIL_SERVER = "smtp-mail.outlook.com"
        $env:MAIL_PORT = "587"
        $env:MAIL_USE_TLS = "true"
        $env:MAIL_USE_SSL = "false"
    }
    "3" {
        Write-Host "`nConfiguring for Yahoo..." -ForegroundColor Green
        $env:MAIL_SERVER = "smtp.mail.yahoo.com"
        $env:MAIL_PORT = "587"
        $env:MAIL_USE_TLS = "true"
        $env:MAIL_USE_SSL = "false"
        
        Write-Host "`nNOTE: Yahoo requires an App Password" -ForegroundColor Yellow
        Write-Host ""
    }
    "4" {
        Write-Host "`nConfiguring custom SMTP server..." -ForegroundColor Green
        $env:MAIL_SERVER = Read-Host "Enter SMTP server address (e.g., smtp.example.com)"
        $env:MAIL_PORT = Read-Host "Enter SMTP port (usually 587 for TLS or 465 for SSL)"
        
        $useTLS = Read-Host "Use TLS? (y/n)"
        $env:MAIL_USE_TLS = if ($useTLS -eq "y") { "true" } else { "false" }
        
        $useSSL = Read-Host "Use SSL? (y/n)"
        $env:MAIL_USE_SSL = if ($useSSL -eq "y") { "true" } else { "false" }
    }
    default {
        Write-Host "Invalid choice. Exiting." -ForegroundColor Red
        exit
    }
}

# Get email credentials
Write-Host ""
$email = Read-Host "Enter your email address"
$env:MAIL_USERNAME = $email
$env:MAIL_DEFAULT_SENDER = $email

Write-Host ""
Write-Host "Enter your email password (or App Password for Gmail/Yahoo)" -ForegroundColor Yellow
$password = Read-Host "Password" -AsSecureString
$env:MAIL_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
)

# Display configuration
Write-Host "`n=== Configuration Set ===" -ForegroundColor Green
Write-Host "MAIL_SERVER: $env:MAIL_SERVER"
Write-Host "MAIL_PORT: $env:MAIL_PORT"
Write-Host "MAIL_USE_TLS: $env:MAIL_USE_TLS"
Write-Host "MAIL_USE_SSL: $env:MAIL_USE_SSL"
Write-Host "MAIL_USERNAME: $env:MAIL_USERNAME"
Write-Host "MAIL_PASSWORD: ********" -ForegroundColor DarkGray
Write-Host "MAIL_DEFAULT_SENDER: $env:MAIL_DEFAULT_SENDER"
Write-Host ""

Write-Host "Environment variables have been set for this session!" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT NOTES:" -ForegroundColor Yellow
Write-Host "- These variables are only set for the current PowerShell session"
Write-Host "- You need to run the Flask backend from THIS terminal window"
Write-Host "- To make permanent, add them to your system environment variables"
Write-Host ""

$startBackend = Read-Host "Do you want to start the backend now? (y/n)"

if ($startBackend -eq "y") {
    Write-Host "`nStarting backend..." -ForegroundColor Cyan
    Set-Location backend
    python app.py
} else {
    Write-Host "`nTo start the backend later, run:" -ForegroundColor Cyan
    Write-Host "cd backend"
    Write-Host "python app.py"
}
