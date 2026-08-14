import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Globe, { GlobeMethods } from "react-globe.gl";
import { Globe as GlobeIcon, ArrowLeft, MapPin } from "lucide-react";

export interface BranchGlobeStore {
  store: string;
  tl: string;
  mtd: number;
  target: number;
  achPct: number;
  walkins: number;
  sales: number;
  convPct: number;
}

interface BranchGlobeProps {
  stores: BranchGlobeStore[];
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

function fmtINR(n: number) {
  if (n >= 100000) return `\u20b9${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `\u20b9${(n / 1000).toFixed(1)}K`;
  return `\u20b9${n.toLocaleString("en-IN")}`;
}

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
const INDIA_CENTER: [number, number] = [78.9629, 20.5937];

function coordsForStore(storeName: string): [number, number] {
  return STORE_COORDS[storeName] ?? INDIA_CENTER;
}

const WORLD_VIEW = { lat: 15, lng: 60, altitude: 2.3 };
const INDIA_VIEW = { lat: 22.5, lng: 80, altitude: 1.15 };
const COUNTRIES_URL =
  "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson";

export default function BranchGlobe({ stores }: BranchGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 480 });
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [view, setView] = useState<"world" | "india">("world");
  const [hoverCountry, setHoverCountry] = useState<CountryFeature | null>(null);
  const [selectedStore, setSelectedStore] = useState<(BranchGlobeStore & { lat: number; lng: number }) | null>(null);

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

  const flyToIndia = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    g.controls().autoRotate = false;
    g.pointOfView(INDIA_VIEW, 1400);
    setView("india");
    setSelectedStore(null);
  }, []);

  const flyToWorld = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView(WORLD_VIEW, 1400);
    g.controls().autoRotate = true;
    setView("world");
    setSelectedStore(null);
  }, []);

  const handlePolygonClick = useCallback(
    (feat: object) => {
      const props = (feat as CountryFeature).properties;
      const name = props?.NAME || props?.ADMIN;
      if (name === "India") flyToIndia();
    },
    [flyToIndia]
  );

  const storeMarkers = useMemo(() => {
    if (view !== "india") return [];
    return stores.map((s) => {
      const [lng, lat] = coordsForStore(s.store);
      return { ...s, lat, lng };
    });
  }, [stores, view]);

  const makeMarkerEl = useCallback((d: object) => {
    const store = d as BranchGlobeStore;
    const color = ragColor(store.achPct);
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
      ">${shortStore(store.store)} \u00b7 ${store.achPct}%</div>
    `;
    el.onclick = (e) => {
      e.stopPropagation();
      setSelectedStore(d as BranchGlobeStore & { lat: number; lng: number });
    };
    return el;
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 min-w-0">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <GlobeIcon size={18} className="text-[var(--accent-blue)]" />
            Branch Network
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {view === "world"
              ? "Drag to rotate \u00b7 scroll to zoom \u00b7 click India to drill in"
              : `${stores.length} stores across India \u00b7 click a pin for details`}
          </p>
        </div>
        {view === "india" && (
          <button
            onClick={flyToWorld}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-white bg-white/5 hover:bg-white/10 border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 transition-colors"
          >
            <ArrowLeft size={13} /> Back to globe
          </button>
        )}
      </div>

      <div ref={containerRef} className="relative w-full rounded-xl overflow-hidden" style={{ height: 480 }}>
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          polygonsData={countries}
          polygonAltitude={(f: object) => ((f as CountryFeature).properties?.NAME === "India" ? 0.02 : 0.006)}
          polygonCapColor={(f: object) => {
            const feat = f as CountryFeature;
            if (feat.properties?.NAME === "India") return "rgba(59,130,246,0.65)";
            if (feat === hoverCountry) return "rgba(255,255,255,0.12)";
            return "rgba(255,255,255,0.04)";
          }}
          polygonSideColor={() => "rgba(0,0,0,0.2)"}
          polygonStrokeColor={(f: object) => ((f as CountryFeature).properties?.NAME === "India" ? "#60a5fa" : "#1f2430")}
          polygonLabel={(f: object) => (f as CountryFeature).properties?.NAME || ""}
          onPolygonHover={(f: object | null) => setHoverCountry(f as CountryFeature | null)}
          onPolygonClick={handlePolygonClick}
          ringsData={view === "world" ? [{ lat: INDIA_CENTER[1], lng: INDIA_CENTER[0] }] : []}
          ringColor={() => (t: number) => `rgba(59,130,246,${1 - t})`}
          ringMaxRadius={6}
          ringPropagationSpeed={2.5}
          ringRepeatPeriod={1400}
          htmlElementsData={storeMarkers}
          htmlLat={(d: object) => (d as { lat: number }).lat}
          htmlLng={(d: object) => (d as { lng: number }).lng}
          htmlAltitude={0.01}
          htmlElement={makeMarkerEl}
        />

        {view === "world" && (
          <button
            onClick={flyToIndia}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs font-semibold text-white bg-[var(--accent-blue)] hover:brightness-110 rounded-lg px-3 py-2 shadow-lg transition"
          >
            <MapPin size={13} /> View India branches
          </button>
        )}

        {selectedStore && (
          <div className="absolute top-3 left-3 w-56 rounded-xl border border-[var(--border-subtle)] bg-[#11131e]/95 backdrop-blur p-3 shadow-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white">{shortStore(selectedStore.store)}</span>
              <button onClick={() => setSelectedStore(null)} className="text-[var(--text-muted)] hover:text-white text-xs">
                &#10005;
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mb-2">TL: {selectedStore.tl}</p>
            <div className="space-y-1 text-[11px] text-[var(--text-secondary)]">
              <div className="flex justify-between">
                <span>MTD Revenue</span>
                <span className="font-semibold text-white">{fmtINR(selectedStore.mtd)}</span>
              </div>
              <div className="flex justify-between">
                <span>Target</span>
                <span>{fmtINR(selectedStore.target)}</span>
              </div>
              <div className="flex justify-between">
                <span>Achievement</span>
                <span className="font-semibold" style={{ color: ragColor(selectedStore.achPct) }}>
                  {selectedStore.achPct}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Walk-ins</span>
                <span>{selectedStore.walkins}</span>
              </div>
              <div className="flex justify-between">
                <span>Conversions</span>
                <span>
                  {selectedStore.sales} ({selectedStore.convPct}%)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
