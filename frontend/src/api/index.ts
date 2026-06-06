import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const getAbnormalDashboard = (params?: {
  start_date?: string;
  end_date?: string;
  client_name?: string;
  abnormal_type?: string;
}) => {
  return api.get('/query/abnormal-dashboard', { params });
};

export default api;
