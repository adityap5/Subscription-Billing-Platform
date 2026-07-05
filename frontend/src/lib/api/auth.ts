import api from '../axios';
import type { ApiResponse, User } from '../types';

interface AuthData {
  user: User;
  token: string;
}

export async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<AuthData> {
  const { data } = await api.post<ApiResponse<AuthData>>('/auth/register', {
    email,
    password,
    name,
  });
  return data.data!;
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthData> {
  const { data } = await api.post<ApiResponse<AuthData>>('/auth/login', {
    email,
    password,
  });
  return data.data!;
}

export async function getMe(): Promise<{ user: User }> {
  const { data } = await api.get<ApiResponse<{ user: User }>>('/auth/me');
  return data.data!;
}
