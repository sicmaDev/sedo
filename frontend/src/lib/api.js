import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Injecte le token JWT à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sedo_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirige vers /login si 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sedo_token');
      localStorage.removeItem('sedo_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
