import api from '../axios';
import type { ApiResponse, Plan } from '../types';

export async function getPlans(): Promise<Plan[]> {
  const { data } = await api.get<ApiResponse<{ plans: Plan[] }>>('/plans');
  return data.data!.plans;
}
