import { useAuthStore } from "./authStore";

export function hasPermission(resource: string, action: string): boolean {
  return useAuthStore.getState().hasPermission(resource, action);
}
