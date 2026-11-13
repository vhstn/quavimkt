import router from "@/router";

export interface ApiFetchOptions extends RequestInit {
  skipAuthRedirect?: boolean;
}

export const apiFetch = async (endpoint: string, options: ApiFetchOptions = {}) => {
  const token = localStorage.getItem("@MktApp:token");
  
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${import.meta.env.VITE_RENDER_API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const isAuthEndpoint =
    endpoint.includes("/identity/tokens/login") ||
    endpoint.includes("/identity/tokens/reset-password") ||
    endpoint.includes("/identity/users/reset-password") ||
    endpoint.includes("/identity/users/register") ||
    options.skipAuthRedirect ||
    router.currentRoute.value.path === "/login";

  if (response.status === 401 && !isAuthEndpoint) {
    localStorage.removeItem("@MktApp:token");
    router.push("/login?expired=true");
    throw new Error("Sessão expirada.");
  }

  return response;
};