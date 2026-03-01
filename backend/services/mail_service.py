"""
Mail Service
------------
Handles sending verification emails and other system notifications.
(Restored placeholder after surgical merge)
"""

class MailService:
    async def send_verification_email(self, email: str, code: str):
        """Placeholder for sending verification email."""
        print(f"[MAIL] Sending verification code {code} to {email}")
        return True

    async def send_password_reset(self, email: str, token: str):
        """Placeholder for password reset."""
        print(f"[MAIL] Sending reset token to {email}")
        return True

mail_service = MailService()
