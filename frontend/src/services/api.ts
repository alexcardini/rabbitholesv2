import axios from 'axios';

const API_BASE_URL = "/api"; // Force correct routing to backend

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const searchRabbitHole = async (params: {
    query: string;
    previousConversation?: Array<{ user?: string; assistant?: string }>;
    concept?: string;
    followUpMode?: "expansive" | "focused";
}, signal?: AbortSignal) => {
    const response = await api.post('/rabbitholes/search', params, { signal });
    return response.data;
};

export default api;
