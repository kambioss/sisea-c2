import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: (import.meta.env.VITE_KEYCLOAK_URL as string | undefined) || "https://africa.oss-online.org",
  realm: (import.meta.env.VITE_KEYCLOAK_REALM as string | undefined) || "geossia",
  clientId: (import.meta.env.VITE_KEYCLOAK_CLIENT_ID as string | undefined) || "geossia-frontend",
});

export default keycloak;
