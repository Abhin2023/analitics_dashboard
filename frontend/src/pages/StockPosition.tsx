import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/lib/authStore";
import { Package, Search, Filter, RefreshCw } from "lucide-react";

interface StockItem {
  count: number;
  model: string;
  material: string;
  position: string;
}

interface StockShop {
  shop: string;
  items: StockItem[];
  total_units: number;
}

const COUNTRIES = [
  { id: 1, name: "India" },
  { id: 2, name: "Oman" },
  { id: 3, name: "Pakistan" },
  { id: 4, name: "UAE" },
  { id: 5, name: "Malaysia" },
  { id: 6, name: "UK" },
  { id: 7, name: "Bahrain" },
  { id: 8, name: "Qatar" },
];

export default function StockPosition() {
  const { token } = useAuthStore();
  const [data, setData] = useState<StockShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [countryId, setCountryId] = useState<number>(4);
  const [search, setSearch] = useState("");
  const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/mcp/stock/position?country_id=${countryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const d = await res.json();
        setData(d);
        // Auto-expand first 3 shops
        setExpandedShops(new Set(d.slice(0, 3).map((s: StockShop) => s.shop)));
      }
    } catch {}
    setLoading(false);
  }, [token, countryId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleShop = (shop: string) => {
    setExpandedShops((prev) => {
      const next = new Set(prev);
      if (next.has(shop)) next.delete(shop);
      else next.add(shop);
      return next;
    });
  };

  const filtered = data.filter((s) =>
    !search || s.shop.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnits = data.reduce((s, shop) => s + shop.total_units, 0);
  const totalShops = data.length;
  const totalItems = data.reduce((s, shop) => s + shop.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package size={24} />
            Stock Position
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Current inventory levels by shop</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[var(--text-muted)]" />
          <select
            value={countryId}
            onChange={(e) => setCountryId(Number(e.target.value))}
            className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm text-white"
          >
            {COUNTRIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5">
          <Search size={14} className="text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search shops..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white outline-none w-48"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
          <p className="text-xs text-[var(--text-muted)]">Total Units</p>
          <p className="text-2xl font-bold text-white">{totalUnits.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
          <p className="text-xs text-[var(--text-muted)]">Shops</p>
          <p className="text-2xl font-bold text-white">{totalShops}</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
          <p className="text-xs text-[var(--text-muted)]">Unique SKUs</p>
          <p className="text-2xl font-bold text-white">{totalItems}</p>
        </div>
      </div>

      {/* Stock Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          No stock data found
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((shop) => (
            <div key={shop.shop} className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleShop(shop.shop)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Package size={16} className="text-[var(--text-muted)]" />
                  <span className="text-sm font-medium text-white">{shop.shop}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[var(--text-muted)]">
                    {shop.items.length} SKUs
                  </span>
                  <span className={`text-sm font-bold ${shop.total_units < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {shop.total_units}
                  </span>
                </div>
              </button>
              {expandedShops.has(shop.shop) && (
                <div className="border-t border-[var(--border-subtle)]">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-[var(--text-muted)]">
                        <th className="text-left px-4 py-2">Model</th>
                        <th className="text-left px-4 py-2">Material</th>
                        <th className="text-left px-4 py-2">Position</th>
                        <th className="text-right px-4 py-2">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shop.items.map((item, i) => (
                        <tr key={i} className="border-t border-[var(--border-subtle)]/50 hover:bg-white/5">
                          <td className="px-4 py-2 text-sm text-white">{item.model}</td>
                          <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{item.material}</td>
                          <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{item.position}</td>
                          <td className={`px-4 py-2 text-sm text-right font-medium ${item.count < 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {item.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
