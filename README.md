# GEOSSIA — frontend Composante 2 « Climat & Alertes »

Site public et géoportail de la composante 2 : accueil, catalogue des
indicateurs, bulletin d'alertes sécheresse, fiches tendances par pays,
centre de ressources, méthodologie, et un géoportail plein écran (MapLibre).

Stack : Vite + React 18 + TypeScript + react-router + maplibre-gl, sans
bibliothèque de graphiques (SVG maison dans `src/components/charts.tsx`).

## Lancer

```bash
npm install --no-bin-links   # disque exFAT : pas de liens symboliques
npm run dev                  # http://localhost:5174
npm run build
```

## Données

Toutes les valeurs viennent de `public/data/indicators.json`, généré par
`scripts/build_c2_indicators.py` à partir des séries déjà calculées pour le
géoportail principal (`apps/frontend/public/stripes/`, voir
`scripts/compute_climate_stripes.py`) :

- CRU TS 4.09 — anomalies Tmoy/Tmax/Tmin vs 1961-1990, tendance 1981+ ;
- CHIRPS v2 — SPI-1/3/12 (méthode OMM) et niveau d'alerte du SPI-3 ;
- CMIP6 CCKP — changement projeté 2041-2060 vs 1995-2014.

Pour rafraîchir après une mise à jour des séries : `npm run data`.

## GeoServer

La surcouche « Feux actifs FIRMS » interroge `/geoserver/geossia/wms`
(proxy Vite vers le cluster, `DEV_PROXY_GEOSERVER` pour un tunnel ;
`VITE_GEOSERVER_WMS_URL` pour une autre URL).
