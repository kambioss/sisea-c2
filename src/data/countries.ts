// The 55 African countries (names and frames copied from apps/frontend's
// data/territories.ts, GADM 4.1 bounding boxes) and the UN M49 sub-regions.

export interface Country { iso3: string; name: string; region: string; bbox: [number, number, number, number] }

export const REGIONS: Array<{ id: string; name: string; short: string }> = [
  { id: "north", name: "Afrique du Nord", short: "Nord" },
  { id: "west", name: "Afrique de l’Ouest", short: "Ouest" },
  { id: "central", name: "Afrique centrale", short: "Centre" },
  { id: "east", name: "Afrique de l’Est", short: "Est" },
  { id: "southern", name: "Afrique australe", short: "Australe" },
];

export const COUNTRIES: Country[] = [
  { iso3: "ZAF", name: "Afrique du Sud", region: "southern", bbox: [16.45, -34.84, 32.89, -22.13] },
  { iso3: "DZA", name: "Algérie", region: "north", bbox: [-8.67, 18.96, 11.99, 37.09] },
  { iso3: "AGO", name: "Angola", region: "central", bbox: [11.73, -18.04, 24.08, -5.84] },
  { iso3: "BWA", name: "Botswana", region: "southern", bbox: [20.0, -26.91, 29.37, -17.78] },
  { iso3: "BFA", name: "Burkina Faso", region: "west", bbox: [-5.52, 9.4, 2.41, 15.08] },
  { iso3: "BDI", name: "Burundi", region: "east", bbox: [29.0, -4.47, 30.85, -2.31] },
  { iso3: "BEN", name: "Bénin", region: "west", bbox: [0.77, 6.24, 3.85, 12.42] },
  { iso3: "CPV", name: "Cabo Verde", region: "west", bbox: [-25.36, 14.8, -22.66, 17.21] },
  { iso3: "CMR", name: "Cameroun", region: "central", bbox: [8.5, 1.65, 16.19, 13.08] },
  { iso3: "CAF", name: "Centrafrique", region: "central", bbox: [14.42, 2.22, 27.46, 11.01] },
  { iso3: "COM", name: "Comores", region: "east", bbox: [43.23, -12.39, 44.54, -11.37] },
  { iso3: "COG", name: "Congo", region: "central", bbox: [11.2, -5.03, 18.65, 3.7] },
  { iso3: "CIV", name: "Côte d'Ivoire", region: "west", bbox: [-8.6, 4.36, -2.49, 10.74] },
  { iso3: "DJI", name: "Djibouti", region: "east", bbox: [41.75, 10.91, 43.42, 12.71] },
  { iso3: "SWZ", name: "Eswatini", region: "southern", bbox: [30.79, -27.32, 32.14, -25.72] },
  { iso3: "GAB", name: "Gabon", region: "central", bbox: [8.84, -3.99, 14.5, 2.32] },
  { iso3: "GMB", name: "Gambie", region: "west", bbox: [-16.81, 13.06, -13.79, 13.83] },
  { iso3: "GHA", name: "Ghana", region: "west", bbox: [-3.26, 4.74, 1.2, 11.17] },
  { iso3: "GIN", name: "Guinée", region: "west", bbox: [-14.92, 7.19, -7.64, 12.69] },
  { iso3: "GNQ", name: "Guinée équatoriale", region: "central", bbox: [8.41, 0.92, 11.33, 3.79] },
  { iso3: "GNB", name: "Guinée-Bissau", region: "west", bbox: [-16.71, 10.92, -13.64, 12.68] },
  { iso3: "KEN", name: "Kenya", region: "east", bbox: [33.91, -4.68, 41.93, 5.06] },
  { iso3: "LSO", name: "Lesotho", region: "southern", bbox: [27.01, -30.68, 29.46, -28.57] },
  { iso3: "LBR", name: "Liberia", region: "west", bbox: [-11.49, 4.35, -7.37, 8.55] },
  { iso3: "LBY", name: "Libye", region: "north", bbox: [9.39, 19.51, 25.15, 33.17] },
  { iso3: "MDG", name: "Madagascar", region: "east", bbox: [43.22, -25.61, 50.49, -11.95] },
  { iso3: "MWI", name: "Malawi", region: "east", bbox: [32.69, -17.12, 35.91, -9.36] },
  { iso3: "MLI", name: "Mali", region: "west", bbox: [-12.24, 10.16, 4.24, 25.0] },
  { iso3: "MAR", name: "Maroc", region: "north", bbox: [-13.17, 27.67, -1.0, 35.92] },
  { iso3: "MUS", name: "Maurice", region: "east", bbox: [57.31, -20.53, 63.5, -19.67] },
  { iso3: "MRT", name: "Mauritanie", region: "west", bbox: [-17.07, 14.72, -4.83, 27.3] },
  { iso3: "MOZ", name: "Mozambique", region: "east", bbox: [30.22, -26.87, 40.84, -10.47] },
  { iso3: "NAM", name: "Namibie", region: "southern", bbox: [11.73, -28.97, 25.27, -16.96] },
  { iso3: "NER", name: "Niger", region: "west", bbox: [0.17, 11.7, 16.0, 23.52] },
  { iso3: "NGA", name: "Nigeria", region: "west", bbox: [2.67, 4.29, 14.67, 13.89] },
  { iso3: "UGA", name: "Ouganda", region: "east", bbox: [29.57, -1.48, 35.0, 4.23] },
  { iso3: "COD", name: "RD Congo", region: "central", bbox: [12.2, -13.45, 31.31, 5.39] },
  { iso3: "RWA", name: "Rwanda", region: "east", bbox: [28.86, -2.84, 30.9, -1.05] },
  { iso3: "ESH", name: "Sahara occidental", region: "north", bbox: [-17.11, 20.77, -8.67, 27.68] },
  { iso3: "STP", name: "Sao Tomé-et-Principe", region: "central", bbox: [6.46, 0.02, 7.46, 1.69] },
  { iso3: "SYC", name: "Seychelles", region: "east", bbox: [46.21, -10.15, 56.3, -4.29] },
  { iso3: "SLE", name: "Sierra Leone", region: "west", bbox: [-13.3, 6.92, -10.27, 10.0] },
  { iso3: "SOM", name: "Somalie", region: "east", bbox: [40.98, -1.65, 51.42, 11.99] },
  { iso3: "SDN", name: "Soudan", region: "north", bbox: [21.84, 8.68, 38.58, 23.15] },
  { iso3: "SSD", name: "Soudan du Sud", region: "east", bbox: [24.15, 3.48, 35.87, 12.22] },
  { iso3: "SEN", name: "Sénégal", region: "west", bbox: [-17.53, 12.31, -11.34, 16.69] },
  { iso3: "TZA", name: "Tanzanie", region: "east", bbox: [29.33, -11.75, 40.45, -0.99] },
  { iso3: "TCD", name: "Tchad", region: "central", bbox: [13.47, 7.44, 24.0, 23.45] },
  { iso3: "TGO", name: "Togo", region: "west", bbox: [-0.14, 6.11, 1.81, 11.14] },
  { iso3: "TUN", name: "Tunisie", region: "north", bbox: [7.53, 30.24, 11.6, 37.34] },
  { iso3: "ZMB", name: "Zambie", region: "east", bbox: [21.98, -18.08, 33.71, -8.27] },
  { iso3: "ZWE", name: "Zimbabwe", region: "east", bbox: [25.24, -22.42, 33.05, -15.61] },
  { iso3: "EGY", name: "Égypte", region: "north", bbox: [24.7, 21.73, 35.79, 31.67] },
  { iso3: "ERI", name: "Érythrée", region: "east", bbox: [36.44, 12.36, 43.14, 18.01] },
  { iso3: "ETH", name: "Éthiopie", region: "east", bbox: [33.0, 3.4, 47.96, 14.85] },
];

export const COUNTRY_BY_ISO3 = new Map(COUNTRIES.map((country) => [country.iso3, country]));

export function countryName(iso3: string): string {
  return iso3 === "AFR" ? "Afrique" : COUNTRY_BY_ISO3.get(iso3)?.name ?? iso3;
}

export function regionName(id: string): string {
  return REGIONS.find((region) => region.id === id)?.name ?? "Afrique";
}
