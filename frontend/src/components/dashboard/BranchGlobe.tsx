import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Globe, { GlobeMethods } from "react-globe.gl";
import { Globe as GlobeIcon, ArrowLeft, MapPin } from "lucide-react";
import { formatByCountry as fmtByCountry } from "@/lib/formatMoney";

export interface GlobeBranch {
  shop: string;
  country: string;
  target: number;
  actual: number;
  achievement_pct: number;
  stock_units?: number;
  tl?: string;
  walk_ins?: number;
  conversions?: number;
}

interface BranchGlobeProps {
  branches: GlobeBranch[];
}

interface CountryFeature {
  type: "Feature";
  properties: { NAME?: string; ADMIN?: string; ISO_A2?: string; [k: string]: any };
  geometry: any;
}

function shortStore(name: string) {
  return name
    .replace("Kerala ", "")
    .replace("Chennai ", "")
    .replace("Bangalore ", "")
    .replace("Hyderabad ", "")
    .replace("TN ", "")
    .replace("Mumbai ", "")
    .replace("Delhi ", "")
    .replace(" Lajpat Nagar", "")
    .replace(" Mall", "")
    .trim();
}

function ragColor(p: number) {
  return p >= 65 ? "#10b981" : p >= 35 ? "#f59e0b" : "#ef4444";
}


const COUNTRY_COLORS: Record<string, string> = {
  India: "#3b82f6",
  UAE: "#10b981",
  Oman: "#f59e0b",
  Qatar: "#a855f7",
  Pakistan: "#ef4444",
  Malaysia: "#06b6d4",
  UK: "#ec4899",
  Bahrain: "#f97316",
};

// City-level coordinates only exist for India's originally-seeded branches.
// Every other country's shops share one center point since there's no
// per-shop geocoding for them yet.
const STORE_COORDS: Record<string, [number, number]> = {
  "Kerala Kasargod":     [74.9952, 12.4992],
  "Kerala Kannur":       [75.3704, 11.8745],
  "Kerala Calicut":      [75.7873, 11.2588],
  "Kerala Wayanad":      [76.1320, 11.6854],
  "Kerala Thrissur":     [76.2144, 10.5270],
  "Kerala Palakkad":     [76.6548, 10.7867],
  "Kerala Kottkal":      [76.5226,  9.5916],
  "Kerala Kochi":        [76.2674,  9.9312],
  "Kerala Pathanamthitta":[76.8346,  9.2648],
  "Kerala Kollam":       [76.6284,  8.8932],
  "Kerala Trivandrum":   [76.9366,  8.5241],
  "Chennai Kodambakam":  [80.2253, 13.0524],
  "Chennai Velachery":   [80.2181, 12.9830],
  "Tn Coimbatore":       [76.9558, 11.0168],
  "Bangalore Indiranagar":[77.6408, 12.9784],
  "Bangalore Marathahalli":[77.6971, 12.9562],
  "Mangalore":           [74.8560, 12.9141],
  "Mysore":              [76.6394, 12.2958],
  "Hyderabad Kukatpally":[78.4042, 17.4847],
  "Hyderabad Hitech":    [78.3772, 17.4435],
  "Mumbai Bandra":       [72.8372, 19.0544],
  "Mumbai Korum":        [72.9273, 19.2850],
  "Delhi Lajpat Nagar":  [77.2406, 28.5679],
  "Guwahati":            [91.7362, 26.1445],
};

const COUNTRY_CENTERS: Record<string, [number, number]> = {
  India: [78.9629, 20.5937],
  UAE: [54.3773, 24.4539],
  Oman: [56.0, 21.0],
  Qatar: [51.1839, 25.2854],
  Pakistan: [69.3451, 30.3753],
  Malaysia: [101.9758, 4.2105],
  UK: [-1.5, 52.5],
  Bahrain: [50.5577, 26.0667],
};

// The public world-countries GeoJSON uses full country names, while this
// app uses short ones (UAE, UK) — this maps between the two so polygon
// clicks/highlighting can match a branch's country to its map polygon.
const GEOJSON_NAME_FOR_COUNTRY: Record<string, string> = {
  India: "India",
  UAE: "United Arab Emirates",
  Oman: "Oman",
  Qatar: "Qatar",
  Pakistan: "Pakistan",
  Malaysia: "Malaysia",
  UK: "United Kingdom",
  Bahrain: "Bahrain",
};

function coordsForBranch(branch: GlobeBranch): [number, number] {
  if (branch.country === "India") {
    return STORE_COORDS[branch.shop] ?? COUNTRY_CENTERS.India;
  }
  return COUNTRY_CENTERS[branch.country] ?? COUNTRY_CENTERS.India;
}

const WORLD_VIEW = { lat: 15, lng: 60, altitude: 2.3 };
const COUNTRIES_URL =
  "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson";

export default function BranchGlobe({ branches }: BranchGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 480 });
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hoverCountry, setHoverCountry] = useState<CountryFeature | null>(null);
  const [selectedStore, setSelectedStore] = useState<(GlobeBranch & { lat: number; lng: number }) | null>(null);

  const branchCountries = useMemo(() => {
    const set = new Set<string>();
    for (const b of branches) if (b.country) set.add(b.country);
    return set;
  }, [branches]);

  const branchCountryList = useMemo(
    () => Array.from(branchCountries).sort((a, b) => a.localeCompare(b)),
    [branchCountries]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setSize({ width: Math.max(320, Math.round(w)), height: 480 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(COUNTRIES_URL)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setCountries(data.features || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView(WORLD_VIEW, 0);
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.enableZoom = true;
  }, [countries.length]);

  const flyToCountry = useCallback((country: string) => {
    const g = globeRef.current;
    if (!g) return;
    const [lng, lat] = COUNTRY_CENTERS[country] ?? COUNTRY_CENTERS.India;
    g.controls().autoRotate = false;
    g.pointOfView({ lat, lng, altitude: country === "India" ? 1.15 : 0.6 }, 1400);
    setSelectedCountry(country);
    setSelectedStore(null);
  }, []);

  const flyToWorld = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView(WORLD_VIEW, 1400);
    g.controls().autoRotate = true;
    setSelectedCountry(null);
    setSelectedStore(null);
  }, []);

  const countryForFeature = useCallback(
    (feat: CountryFeature): string | null => {
      const geoName = feat.properties?.NAME || feat.properties?.ADMIN;
      for (const country of branchCountryList) {
        if (GEOJSON_NAME_FOR_COUNTRY[country] === geoName) return country;
      }
      return null;
    },
    [branchCountryList]
  );

  const handlePolygonClick = useCallback(
    (feat: object) => {
      const country = countryForFeature(feat as CountryFeature);
      if (country) flyToCountry(country);
    },
    [countryForFeature, flyToCountry]
  );

  const storeMarkers = useMemo(() => {
    if (!selectedCountry) return [];
    return branches
      .filter((b) => b.country === selectedCountry)
      .map((b) => {
        const [lng, lat] = coordsForBranch(b);
        return { ...b, lat, lng };
      });
  }, [branches, selectedCountry]);

  const makeMarkerEl = useCallback((d: object) => {
    const branch = d as GlobeBranch;
    const color = ragColor(branch.achievement_pct);
    const el = document.createElement("div");
    el.style.cursor = "pointer";
    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.alignItems = "center";
    el.style.transform = "translate(-50%, -100%)";
    el.innerHTML = `
      <div style="
        width:10px;height:10px;border-radius:9999px;
        background:${color};
        box-shadow:0 0 0 3px ${color}33, 0 0 8px ${color};
        border:1.5px solid rgba(17,19,30,0.9);
      "></div>
      <div style="
        margin-top:4px;padding:2px 6px;border-radius:6px;
        background:rgba(17,19,30,0.92);border:1px solid rgba(255,255,255,0.08);
        font-size:10px;font-weight:600;color:#fff;white-space:nowrap;
        font-family:inherit;
      ">${shortStore(branch.shop)} · ${branch.achievement_pct.toFixed(0)}%</div>
    `;
    el.onclick = (e) => {
      e.stopPropagation();
      setSelectedStore(d as GlobeBranch & { lat: number; lng: number });
    };
    return el;
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 min-w-0">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <GlobeIcon size={18} className="text-[var(--accent-blue)]" />
            Branch Network
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {selectedCountry
              ? `${storeMarkers.length} branches in ${selectedCountry} · click a pin for details`
              : "Drag to rotate · scroll to zoom · click a highlighted country to drill in"}
          </p>
        </div>
        {selectedCountry && (
          <button
            onClick={flyToWorld}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-white bg-white/5 hover:bg-white/10 border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 transition-colors"
          >
            <ArrowLeft size={13} /> Back to globe
          </button>
        )}
      </div>

      {/* Quick-select chips — a reliable way to pick a country, since some
          (Qatar, Bahrain) are tiny and hard to click precisely on the globe. */}
      {!selectedCountry && branchCountryList.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {branchCountryList.map((country) => (
            <button
              key={country}
              onClick={() => flyToCountry(country)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-[var(--border-subtle)] bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: COUNTRY_COLORS[country] || "#6b7280" }} />
              {country} ({branches.filter((b) => b.country === country).length})
            </button>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative w-full rounded-xl overflow-hidden" style={{ height: 480 }}>
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          polygonsData={countries}
          polygonAltitude={(f: object) => (countryForFeature(f as CountryFeature) ? 0.02 : 0.006)}
          polygonCapColor={(f: object) => {
            const feat = f as CountryFeature;
            const country = countryForFeature(feat);
            if (country) {
              const hex = COUNTRY_COLORS[country] || "#3b82f6";
              const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
              return `rgba(${r},${g},${b},0.65)`;
            }
            if (feat === hoverCountry) return "rgba(255,255,255,0.12)";
            return "rgba(255,255,255,0.04)";
          }}
          polygonSideColor={() => "rgba(0,0,0,0.2)"}
          polygonStrokeColor={(f: object) => (countryForFeature(f as CountryFeature) ? "#60a5fa" : "#1f2430")}
          polygonLabel={(f: object) => (f as CountryFeature).properties?.NAME || ""}
          onPolygonHover={(f: object | null) => setHoverCountry(f as CountryFeature | null)}
          onPolygonClick={handlePolygonClick}
          htmlElementsData={storeMarkers}
          htmlLat={(d: object) => (d as { lat: number }).lat}
          htmlLng={(d: object) => (d as { lng: number }).lng}
          htmlAltitude={0.01}
          htmlElement={makeMarkerEl}
        />

        {selectedStore && (
          <div className="absolute top-3 left-3 w-56 rounded-xl border border-[var(--border-subtle)] bg-[#11131e]/95 backdrop-blur p-3 shadow-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white">{shortStore(selectedStore.shop)}</span>
              <button onClick={() => setSelectedStore(null)} className="text-[var(--text-muted)] hover:text-white text-xs">
                &#10005;
              </button>
            </div>
            {selectedStore.tl && <p className="text-[10px] text-[var(--text-muted)] mb-2">TL: {selectedStore.tl}</p>}
            <div className="space-y-1 text-[11px] text-[var(--text-secondary)]">
              <div className="flex justify-between">
                <span>Revenue</span>
                <span className="font-semibold text-white">{fmtByCountry(selectedStore.actual, selectedStore.country)}</span>
              </div>
              <div className="flex justify-between">
                <span>Target</span>
                <span>{selectedStore.target > 0 ? fmtByCountry(selectedStore.target, selectedStore.country) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Achievement</span>
                <span className="font-semibold" style={{ color: ragColor(selectedStore.achievement_pct) }}>
                  {selectedStore.achievement_pct.toFixed(1)}%
                </span>
              </div>
              {selectedStore.walk_ins !== undefined && (
                <div className="flex justify-between">
                  <span>Walk-ins</span>
                  <span>{selectedStore.walk_ins}</span>
                </div>
              )}
              {selectedStore.conversions !== undefined && (
                <div className="flex justify-between">
                  <span>Conversions</span>
                  <span>{selectedStore.conversions}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
