import os
from twilio.rest import Client

def send_emergency_sms(to_number: str, body: str) -> bool:
    """Send emergency SMS via Twilio API. Falls back to console log if credentials missing."""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER")
    
    if account_sid:
        account_sid = account_sid.strip().strip("'").strip('"')
    if auth_token:
        auth_token = auth_token.strip().strip("'").strip('"')
    if from_number:
        from_number = from_number.strip().strip("'").strip('"')
        
    if not account_sid or not auth_token or not from_number:
        safe_body = body.encode('ascii', errors='replace').decode('ascii')
        print(f"[Twilio SMS Fallback] To: {to_number} | Msg: {safe_body}")
        return True # Treat as sent/logged in fallback mode
        
    try:
        # Clean formatting
        to_clean = to_number.replace(" ", "")
        if not to_clean.startswith("+"):
            if len(to_clean) == 10:
                to_clean = "+91" + to_clean
            else:
                to_clean = "+" + to_clean
                
        client = Client(account_sid, auth_token)
        message = client.messages.create(
            to=to_clean,
            from_=from_number,
            body=body
        )
        print(f"[Twilio SMS] SMS alert sent successfully! SID: {message.sid}")
        return True
    except Exception as e:
        print(f"[Twilio SMS] Failed to send SMS: {e}")
        return False
