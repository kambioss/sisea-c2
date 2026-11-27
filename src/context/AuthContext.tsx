import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import keycloak from "../services/keycloak";

interface CurrentUser {
  ready: boolean;
  authenticated: boolean;
  name: string | null;
  email: string | null;
  login(redirectPath?: string): void;
  logout(): void;
}
const AuthContext = createContext<CurrentUser>({
  ready: false, authenticated: false, name: null, email: null,
  login: () => undefined, logout: () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const started = useRef(false);
  const [user, setUser] = useState<Omit<CurrentUser, "login" | "logout">>({ ready: false, authenticated: false, name: null, email: null });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const loginRoute = window.location.pathname === "/login";
    const publicOrigin = ((import.meta.env.VITE_PUBLIC_URL as string | undefined) || "https://climat.oss-online.org").replace(/\/$/, "");
    keycloak.init({
      onLoad: loginRoute ? "login-required" : "check-sso", pkceMethod: "S256",
      redirectUri: loginRoute ? `${publicOrigin}/geoportail` : undefined,
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      checkLoginIframe: false, silentCheckSsoFallback: false,
    }).then((authenticated) => {
      const token = keycloak.tokenParsed as { name?: string; email?: string; preferred_username?: string } | undefined;
      setUser({ ready: true, authenticated, name: token?.name || token?.preferred_username || token?.email || null, email: token?.email || null });
    }).catch(() => setUser({ ready: true, authenticated: false, name: null, email: null }));
    keycloak.onTokenExpired = () => { keycloak.updateToken(30).catch(() => keycloak.login()); };
    keycloak.onAuthLogout = () => setUser({ ready: true, authenticated: false, name: null, email: null });
  }, []);
  const login = (redirectPath = "/geoportail") => {
    const publicOrigin = ((import.meta.env.VITE_PUBLIC_URL as string | undefined) || "https://climat.oss-online.org").replace(/\/$/, "");
    return keycloak.login({ redirectUri: `${publicOrigin}${redirectPath}` });
  };
  const logout = () => keycloak.logout({ redirectUri: window.location.origin });
  return <AuthContext.Provider value={{ ...user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
