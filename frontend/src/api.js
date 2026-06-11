import axios from 'axios';

// Switch between the production Render backend and local proxy environment
const BASE = import.meta.env.PROD 
  ? 'https://wc2026-bracketchallenge.onrender.com/' // <--- Paste your exact live Render URL here, making sure it ends with /api
  : '/api';

export const loginUser = (name) =>
  axios.post(`${BASE}/users`, { name }).then(r => r.data);

export const getUsers = () =>
  axios.get(`${BASE}/users`).then(r => r.data);

export const savePredictions = (userId, predictions) =>
  axios.post(`${BASE}/predictions/bulk`, { user_id: userId, predictions }).then(r => r.data);

export const loadPredictions = (userId) =>
  axios.get(`${BASE}/predictions/${userId}`).then(r => r.data);

export const saveActualResults = (password, stage, teams) =>
  axios.post(`${BASE}/admin/results`, { password, stage, teams }).then(r => r.data);

export const getActualResults = (password) =>
  axios.get(`${BASE}/admin/results?password=${password}`).then(r => r.data);

export const getScores = () =>
  axios.get(`${BASE}/scores`).then(r => r.data);

export const deletePredictions = (password, userId) =>
  axios.delete(`${BASE}/admin/predictions/${userId}?password=${password}`).then(r => r.data);

export const deleteUser = (password, userId) =>
  axios.delete(`${BASE}/admin/users/${userId}?password=${password}`).then(r => r.data);