import { Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/Layout";
import HomePage from "./pages/HomePage";
import HomePageV2 from "./pages/HomePageV2";
import ResourcesPage from "./pages/ResourcesPage";
import AboutPage from "./pages/AboutPage";
import NotFoundPage from "./pages/NotFoundPage";
import GeoportalPage from "./geoportal/GeoportalPage";
import ScientificGeoportalPage from "./geoportal/ScientificGeoportalPage";

export default function App() {
  return (
    <Routes>
      {/* The géoportail is a full-screen application shell, without the site header/footer. */}
      <Route path="/geoportail" element={<GeoportalPage />} />
      <Route path="/geoportail-scientifique" element={<ScientificGeoportalPage />} />
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="accueil-v1" element={<HomePage />} />
        <Route path="accueil-v2" element={<HomePageV2 />} />
        <Route path="ressources" element={<ResourcesPage />} />
        <Route path="a-propos" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
