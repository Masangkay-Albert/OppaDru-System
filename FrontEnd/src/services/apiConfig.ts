const getFallbackApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000/api';
    }
  }
  return 'https://oppadru-system-1.onrender.com/api';
};

export const API_URL = import.meta.env.VITE_API_URL
  || import.meta.env.VITE_API_BASE_URL
  || getFallbackApiUrl();