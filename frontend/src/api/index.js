import apiClient from "./client";


// Get current logged in user ID dynamically
export const getCurrentUserId = () => {
  const userIdStr = localStorage.getItem("medicare_user_id");
  return userIdStr ? parseInt(userIdStr) : null;
};

// Simulated HTTP adapter for any legacy components calling `api.get` / `api.put` directly
const api = {
  get: async (path) => {
    if (path === "/profile") {
      const data = await authAPI.getProfile();
      return { data };
    }
    throw new Error(`GET Path ${path} not implemented inside Supabase Adapter`);
  },
  put: async (path, body) => {
    if (path === "/profile") {
      const data = await authAPI.updateProfile(body);
      return { data };
    }
    throw new Error(`PUT Path ${path} not implemented inside Supabase Adapter`);
  }
};

export const authAPI = {
  login: async (username, password) => {
    const response = await apiClient.post(
      "/auth/login",
      {
        username,
        password
      }
    );

    localStorage.setItem(
      "medicare_token",
      response.data.access_token
    );

    // Fetch user profile immediately to populate localStorage identifiers
    const profile = await authAPI.getProfile();
    localStorage.setItem("medicare_user_id", profile.id.toString());
    localStorage.setItem("medicare_username", profile.username);
    localStorage.setItem("medicare_user_fullname", profile.full_name);

    return response.data;
  },
  register: async (
    username,
    email,
    password,
    gender
  ) => {
    const response = await apiClient.post(
      "/auth/register",
      {
        username,
        email,
        password,
        gender
      }
    );

    return response.data;
  },
  getProfile: async () => {
    const response = await apiClient.get("/profile");
    if (response.data) {
      localStorage.setItem("medicare_user_id", response.data.id.toString());
      localStorage.setItem("medicare_username", response.data.username);
      localStorage.setItem("medicare_user_fullname", response.data.full_name);
    }
    return response.data;
  },
  updateProfile: async (profile) => {
    const response = await apiClient.put("/profile", profile);
    if (response.data) {
      localStorage.setItem("medicare_user_fullname", response.data.full_name);
    }
    return response.data;
  },
  logout: async () => {
    localStorage.removeItem("medicare_token");
    localStorage.removeItem("medicare_user_id");
    localStorage.removeItem("medicare_username");
    localStorage.removeItem("medicare_user_fullname");
  }
};

export const dashboardAPI = {
  getSummary: async () => {
    const response = await apiClient.get("/dashboard");
    return response.data;
  }
};

export const medicinesAPI = {
  getAll: async () => {
    const response = await apiClient.get(
      "/medicines"
    );
    return response.data;
  },
  create: async (medicine) => {
    const response = await apiClient.post(
      "/medicines",
      medicine
    );
    return response.data;
  },
  updateStatus: async (
    id,
    status
  ) => {
    const response = await apiClient.put(
      `/medicines/${id}`,
      { status }
    );
    return response.data;
  },
  delete: async (id) => {
    const response = await apiClient.delete(
      `/medicines/${id}`
    );
    return response.data;
  },
  update: async (id, medicine) => {
    const response = await apiClient.put(
      `/medicines/${id}`,
      medicine
    );
    return response.data;
  }
};

export const appointmentsAPI = {
  getAll: async () => {
    const response = await apiClient.get("/appointments");
    return response.data;
  },
  book: async (appointment) => {
    const response = await apiClient.post("/appointments", appointment);
    return response.data;
  },
  update: async (id, apptData) => {
    const response = await apiClient.put(`/appointments/${id}`, apptData);
    return response.data;
  },
  cancel: async (id) => {
    const response = await apiClient.delete(`/appointments/${id}`);
    return response.data;
  }
};

export const healthAPI = {
  getMetrics: async () => {
    const response = await apiClient.get("/health-metrics");
    return response.data;
  },
  logMetric: async (metrics) => {
    const response = await apiClient.post("/health-metrics", {
      systolic_bp: parseInt(metrics.systolic_bp) || null,
      diastolic_bp: parseInt(metrics.diastolic_bp) || null,
      heart_rate: parseInt(metrics.heart_rate) || null,
      blood_sugar: parseInt(metrics.blood_sugar) || null,
    });
    return response.data;
  }
};

export const expensesAPI = {
  getAll: async () => {
    const response = await apiClient.get("/expenses");
    return response.data;
  },
  create: async (expense) => {
    const response = await apiClient.post("/expenses", expense);
    return response.data;
  },
  uploadBill: async (formData) => {
    const response = await apiClient.post(
      "/expenses/upload-bill",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      }
    );
    return response.data;
  },
  delete: async (id) => {
    const response = await apiClient.delete(`/expenses/${id}`);
    return response.data;
  },
  update: async (id, expense) => {
    const response = await apiClient.put(`/expenses/${id}`, expense);
    return response.data;
  }
};

export const chatAPI = {
  getHistory: async () => {
    const response = await apiClient.get("/chat/history");
    return response.data;
  },
  sendMessage: async (content) => {
    const response = await apiClient.post("/chat", { sender: "user", content });
    return response.data;
  }
};

export const emergencyAPI = {
  triggerSOS: async (latitude, longitude) => {
    const response = await apiClient.post(
      "/emergency/sos",
      {
        latitude,
        longitude
      }
    );
    return response.data;
  },
  getNearestHospitals: async (lat, lng) => {
    const params = lat && lng ? { lat, lng } : {};
    const response = await apiClient.get("/emergency/hospitals", { params });
    return response.data;
  }
};

export const medicalHistoryAPI = {
  getAll: async () => {
    const response = await apiClient.get(
      "/medical-history"
    );
    return response.data;
  },
  create: async (record) => {
    const response = await apiClient.post(
      "/medical-history",
      record
    );
    return response.data;
  },
  delete: async (id) => {
    const response = await apiClient.delete(
      `/medical-history/${id}`
    );
    return response.data;
  }
};

export const reportsAPI = {
  getAll: async () => {
    const response = await apiClient.get("/reports");
    return response.data;
  },
  get: async (id) => {
    const response = await apiClient.get(`/reports/${id}`);
    return response.data;
  },
  upload: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post("/reports/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return response.data;
  },
  delete: async (id) => {
    const response = await apiClient.delete(`/reports/${id}`);
    return response.data;
  },
  analyze: async (id) => {
    const response = await apiClient.post(`/reports/${id}/analyze`);
    return response.data;
  },
  getAnalysis: async (id) => {
    const response = await apiClient.get(`/reports/${id}/analysis`);
    return response.data;
  }
};

export const familyAPI = {
  getAll: async () => {
    const response = await apiClient.get("/family");
    return response.data;
  },
  create: async (member) => {
    const response = await apiClient.post("/family", {
      name: member.name,
      relation: member.relation,
      phone: member.phone || "",
      is_emergency_contact: member.is_emergency_contact || false,
      age: member.age ? parseInt(member.age, 10) : null,
      health_score: member.health_score ? parseInt(member.health_score, 10) : 95
    });
    return response.data;
  },
  update: async (id, member) => {
    const response = await apiClient.put(`/family/${id}`, {
      name: member.name,
      relation: member.relation,
      phone: member.phone || "",
      is_emergency_contact: member.is_emergency_contact || false,
      age: member.age ? parseInt(member.age, 10) : null,
      health_score: member.health_score ? parseInt(member.health_score, 10) : 95
    });
    return response.data;
  },
  delete: async (id) => {
    const response = await apiClient.delete(`/family/${id}`);
    return response.data;
  }
};

export const notificationsAPI = {
  getAll: async () => {
    const response = await apiClient.get("/notifications");
    return response.data;
  },
  create: async (data) => {
    const response = await apiClient.post("/notifications", data);
    return response.data;
  },
  markRead: async (id) => {
    const response = await apiClient.put(`/notifications/${id}`);
    return response.data;
  },
  delete: async (id) => {
    const response = await apiClient.delete(`/notifications/${id}`);
    return response.data;
  }
};

export const hospitalsAPI = {
  getNearby: async (lat, lng) => {
    const response = await apiClient.get("/nearby-hospitals", {
      params: { lat, lng }
    });
    return response.data;
  }
};

export const bmiAPI = {
  get: async () => {
    const response = await apiClient.get("/bmi");
    return response.data;
  }
};

export default api;
