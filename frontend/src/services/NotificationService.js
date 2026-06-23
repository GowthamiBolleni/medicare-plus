import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Helper to construct authenticated API request headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("medicare_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

class NotificationService {
  constructor() {
    this.token = localStorage.getItem("medicare_fcm_token") || null;
    this.permission = typeof Notification !== "undefined" ? Notification.permission : "default";
  }

  async requestPermission() {
    console.log("[NotificationService] Requesting permission...");
    if (typeof Notification === "undefined") {
      console.log("[NotificationService] Notifications not supported in this client.");
      return { status: "unsupported", token: null };
    }
    
    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      console.log("[NotificationService] Permission response:", permission);

      if (permission === "granted") {
        // Retrieve or generate FCM Token
        // For development/mock fallback mode:
        let activeToken = this.token;
        if (!activeToken) {
          activeToken = `mock-fcm-token-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
          this.token = activeToken;
          localStorage.setItem("medicare_fcm_token", activeToken);
        }
        
        await this.registerToken(activeToken);
        return { status: "granted", token: activeToken };
      } else {
        return { status: permission, token: null };
      }
    } catch (error) {
      console.error("[NotificationService] Error requesting permission:", error);
      return { status: "denied", token: null };
    }
  }

  async registerToken(token) {
    try {
      const response = await axios.post(
        `${API_URL}/api/notifications/device-token`,
        {
          device_token: token,
          device_name: navigator.userAgent.substring(0, 100)
        },
        { headers: getAuthHeaders() }
      );
      console.log("[NotificationService] Device token registered successfully:", response.data);
      return response.data;
    } catch (error) {
      console.error("[NotificationService] Failed to register device token with backend:", error);
      throw error;
    }
  }

  async sendTestNotification() {
    try {
      const response = await axios.post(
        `${API_URL}/api/notifications/test`,
        {},
        { headers: getAuthHeaders() }
      );
      console.log("[NotificationService] Test notification triggered:", response.data);
      return response.data;
    } catch (error) {
      console.error("[NotificationService] Failed to send test notification:", error);
      throw error;
    }
  }
}

export default new NotificationService();
