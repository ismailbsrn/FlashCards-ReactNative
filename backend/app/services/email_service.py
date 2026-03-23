import secrets
from datetime import datetime, timedelta, timezone
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr
from app.core.config import settings

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

fast_mail = FastMail(conf)


def generate_verification_token() -> str:
    """Generate a secure random token for email verification"""
    return secrets.token_urlsafe(32)


def get_verification_expiry() -> datetime:
    """Get expiration time for verification token"""
    return datetime.now(timezone.utc) + timedelta(hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS)


async def send_verification_email(email: EmailStr, token: str, user_name: str = None):
    """Send email verification email"""
    
    if not settings.ENABLE_EMAIL_VERIFICATION:
        print("\n" + "="*60)
        print("📧 [DEV MODE] Email Verification")
        print("="*60)
        print(f"To: {email}")
        print(f"Name: {user_name or 'User'}")
        print(f"Token: {token}")
        print(f"Verify URL: {settings.FRONTEND_URL}/api/auth/verify-email?token={token}")
        print("="*60 + "\n")
        return True
    
    verification_url = f"{settings.FRONTEND_URL}/api/auth/verify-email?token={token}"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4CAF50;">Welcome to Flashcards App!</h2>
                
                <p>Hi {user_name or 'there'},</p>
                
                <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_url}" 
                       style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Verify Email Address
                    </a>
                </div>
                
                <p>Or copy and paste this link into your browser:</p>
                <p style="color: #666; word-break: break-all;">{verification_url}</p>
                
                <p>This link will expire in {settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS} hours.</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px;">
                    If you didn't create an account, you can safely ignore this email.
                </p>
            </div>
        </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Verify your email address",
        recipients=[email],
        body=html_content,
        subtype="html"
    )
    
    try:
        await fast_mail.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


async def send_password_reset_email(email: EmailStr, token: str, user_name: str = None):
    """Send password reset email"""
    
    if settings.ENVIRONMENT == "development":
        print("\n" + "="*60)
        print("Password Reset")
        print("="*60)
        print(f"To: {email}")
        print(f"Name: {user_name or 'User'}")
        print(f"Token: {token}")
        print(f"Reset URL: {settings.FRONTEND_URL}/api/auth/reset-password?token={token}")
        print("="*60 + "\n")
        return True
    
    reset_url = f"{settings.FRONTEND_URL}/api/auth/reset-password?token={token}"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2196F3;">Password Reset Request</h2>
                
                <p>Hi {user_name or 'there'},</p>
                
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" 
                       style="background-color: #2196F3; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                
                <p>Or copy and paste this link into your browser:</p>
                <p style="color: #666; word-break: break-all;">{reset_url}</p>
                
                <p>This link will expire in {settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS} hours.</p>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                
                <p style="color: #999; font-size: 12px;">
                    If you didn't request a password reset, you can safely ignore this email. 
                    Your password will not be changed.
                </p>
            </div>
        </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Reset your password",
        recipients=[email],
        body=html_content,
        subtype="html"
    )
    
    try:
        await fast_mail.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False
