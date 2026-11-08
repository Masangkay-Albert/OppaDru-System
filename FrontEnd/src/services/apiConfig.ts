const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    // When running on localhost, default to local backend unless explicitly directed to another local port
    if (isLocalhost) {
      if (envUrl && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
        return envUrl;
      }
      return 'http://localhost:8000/api';
    }
  }

  return envUrl || 'https://oppadru-system-1.onrender.com/api';
};

export const API_URL = getApiUrl();
