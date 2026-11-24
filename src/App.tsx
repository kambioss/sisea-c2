import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { SiteLayout } from "./components/Layout";
import HomePage from "./pages/HomePage";
import ResourcesPage from "./pages/ResourcesPage";
import DashboardPage from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import LoginPage from "./pages/LoginPage";
import BulletinPage from "./pages/BulletinPage";
import GeoportalPage from "./geoportal/GeoportalPage";
import AlertsPage from "./pages/AlertsPage";
import DownloadsPage from "./pages/DownloadsPage";
import GeoAiAssistant from "./components/GeoAiAssistant";
import { AuthProvider } from "./context/AuthContext";

export default function App() {
  const location = useLocation();
  return (
    <AuthProvider>
    <Routes>
      {/* The geoportal is a full-screen application shell, without site header/footer. */}
      <Route path="/geoportail" element={<GeoportalPage />} />
      <Route
        path="*"
        element={
          <SiteLayout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/ressources" element={<ResourcesPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/bulletin" element={<BulletinPage />} />
              {/* Redirect old routes to new structure */}
              <Route path="/indicateurs" element={<Navigate to="/dashboard" replace />} />
              <Route path="/alertes" element={<AlertsPage />} />
              <Route path="/telecharger" element={<DownloadsPage />} />
              <Route path="/tendances" element={<Navigate to="/" replace />} />
              <Route path="/methodologie" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </SiteLayout>
        }
      />
    </Routes>
    {location.pathname.startsWith("/geoportail") && <GeoAiAssistant />}
    </AuthProvider>
  );
}
