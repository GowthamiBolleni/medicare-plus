import os
import json
import logging

logger = logging.getLogger("fcm_service")

# Try to import firebase_admin, if not installed we will run in mock mode
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    HAS_FIREBASE_SDK = True
except ImportError:
    HAS_FIREBASE_SDK = False

firebase_app = None

def get_firebase_app():
    global firebase_app
    if not HAS_FIREBASE_SDK:
        return None
    if firebase_app:
        return firebase_app
        
    # Look for firebase credentials in env variables or file
    creds_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    creds_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-service-account.json")
    
    try:
        # Check if already initialized by another component or library
        if firebase_admin._apps:
            firebase_app = firebase_admin.get_app()
            print("[FCM Service] Retrieved already initialized Firebase Admin App.")
            return firebase_app

        if creds_json:
            creds_data = json.loads(creds_json)
            cred = credentials.Certificate(creds_data)
            firebase_app = firebase_admin.initialize_app(cred)
            print("[FCM Service] Initialized Firebase Admin from env credentials JSON.")
        elif os.path.exists(creds_path):
            cred = credentials.Certificate(creds_path)
            firebase_app = firebase_admin.initialize_app(cred)
            print(f"[FCM Service] Initialized Firebase Admin from file: {creds_path}")
        else:
            # Try default initialization
            try:
                firebase_app = firebase_admin.initialize_app()
                print("[FCM Service] Initialized Firebase Admin using application default credentials.")
            except Exception:
                print("[FCM Service] Firebase Credentials missing. Running in mock/dry-run mode.")
                return None
    except Exception as e:
        print(f"[FCM Service] Failed to initialize Firebase Admin SDK: {e}. Running in mock/dry-run mode.")
        return None
        
    return firebase_app

def send_fcm_notification(device_token: str, title: str, body: str, data: dict = None) -> bool:
    """Send push notification to a single device token. Falls back to mock logging on failure/dev."""
    app = get_firebase_app()
    
    if data is None:
        data = {}
    
    # Ensure data values are strings
    data_str = {k: str(v) for k, v in data.items()}
    
    if not HAS_FIREBASE_SDK or app is None:
        # Mock/development fallback logging
        print(f"[FCM Mock Send] Token: {device_token} | Title: {title} | Body: {body} | Data: {data_str}")
        return True
        
    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data=data_str,
            token=device_token
        )
        response = messaging.send(message)
        print(f"[FCM Service] Push sent successfully! Response ID: {response}")
        return True
    except Exception as e:
        print(f"[FCM Service] Error sending FCM message to {device_token}: {e}")
        # Log mock delivery as backup
        print(f"[FCM Fallback Mock] Token: {device_token} | Title: {title} | Body: {body} | Data: {data_str}")
        return True # Fallback mode returns True to handle gracefully in dev

def send_multicast_fcm_notification(device_tokens: list, title: str, body: str, data: dict = None) -> bool:
    """Send push notification to multiple device tokens."""
    # Filter empty tokens
    device_tokens = [t for t in device_tokens if t]
    if not device_tokens:
        return True
        
    app = get_firebase_app()
    
    if data is None:
        data = {}
    data_str = {k: str(v) for k, v in data.items()}
    
    if not HAS_FIREBASE_SDK or app is None:
        print(f"[FCM Multicast Mock] Tokens: {device_tokens} | Title: {title} | Body: {body} | Data: {data_str}")
        return True
        
    try:
        # If multicast token list is very large, chunking might be needed, but for typical users it's fine.
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data=data_str,
            tokens=device_tokens
        )
        response = messaging.send_multicast(message)
        print(f"[FCM Service] Multicast push sent. Success count: {response.success_count}, Failure count: {response.failure_count}")
        return True
    except Exception as e:
        print(f"[FCM Service] Error sending multicast FCM message: {e}")
        print(f"[FCM Multicast Fallback Mock] Tokens: {device_tokens} | Title: {title} | Body: {body} | Data: {data_str}")
        return True
