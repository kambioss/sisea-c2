import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import keycloak from "../services/keycloak";

interface CurrentUser { authenticated: boolean; name: string | null; email: string | null }
const AuthContext = createContext<CurrentUser>({ authenticated: false, name: null, email: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const started = useRef(false);
  const [user, setUser] = useState<CurrentUser>({ authenticated: false, name: null, email: null });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    keycloak.init({
      onLoad: "check-sso", pkceMethod: "S256",
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      checkLoginIframe: false, silentCheckSsoFallback: false,
    }).then((authenticated) => {
      const token = keycloak.tokenParsed as { name?: string; email?: string; preferred_username?: string } | undefined;
      setUser({ authenticated, name: token?.name || token?.preferred_username || token?.email || null, email: token?.email || null });
    }).catch(() => setUser({ authenticated: false, name: null, email: null }));
    keycloak.onAuthLogout = () => setUser({ authenticated: false, name: null, email: null });
  }, []);
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
