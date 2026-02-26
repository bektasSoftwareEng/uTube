import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import json

def send_verification_email(to_email: str, code: str) -> bool:
    """
    Sends an OTP verification email to the user.
    If SMTP credentials are not configured in the environment,
    it mocks the email by logging the code to the terminal.
    """
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", "587")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    sender_email = os.getenv("SMTP_SENDER_EMAIL", "noreply@utube.local")

    # MOCK MODE: If no SMTP defined, just print to console
    if not smtp_server or not smtp_username or not smtp_password:
        print("\n" + "="*50)
        print("✉️  [MOCK EMAIL SERVICE] ✉️")
        print(f"To: {to_email}")
        print(f"Subject: Your uTube Verification Code: {code}")
        print("\nBody:")
        print(f"Welcome to uTube! Your verification code is: {code}")
        print("Please enter this code to complete your registration.")
        print("="*50 + "\n")
        return True

    # REAL MODE: Send via SMTP
    try:
        msg = MIMEMultipart()
        msg["From"] = sender_email
        msg["To"] = to_email
        msg["Subject"] = f"Your uTube Verification Code"
        
        body = f"""
        <html>
            <body>
                <h2>Welcome to uTube!</h2>
                <p>To complete your registration, please apply the following verification code:</p>
                <h1 style="color: #FF0000; letter-spacing: 5px;">{code}</h1>
                <p>This code will expire in 15 minutes.</p>
                <p>If you did not request this, please ignore this email.</p>
            </body>
        </html>
        """
        
        msg.attach(MIMEText(body, "html"))
        
        with smtplib.SMTP(smtp_server, int(smtp_port)) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)
            
        print(f"[EMAIL] Verification code successfully sent to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send verification email to {to_email}: {e}")
        return False
