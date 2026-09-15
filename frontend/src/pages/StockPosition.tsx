import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { Package, Search, Filter, RefreshCw, AlertTriangle, Clock, CreditCard, Wrench } from "lucide-react";

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

interface LowStockItem {
  shop: string;
  model: string;
  material: string;
  position: string;
  count: number;
}

interface PendingShop {
  shop: string;
  email: string;
  payment_pending: number;
  installation_pending: number;
  items: string[];
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
  const [data, setData] = useState<StockShop[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [pending, setPending] = useState<PendingShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [countryId, setCountryId] = useState<number>(4);
  const [search, setSearch] = useState("");
  const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());
  const [showAllLowStock, setShowAllLowStock] = useState(false);
  const [expandedPendingShops, setExpandedPendingShops] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [posRes, summaryRes, pendingRes] = await Promise.all([
        api.fetchRaw(`/mcp/stock/position?country_id=${countryId}`),
        api.fetchRaw(`/mcp/stock/summary?country_id=${countryId}`),
        api.fetchRaw(`/mcp/stock/pending?country_id=${countryId}`),
      ]);

      if (posRes.ok) {
        const d = await posRes.json();
        setData(d);
        setExpandedShops(new Set(d.slice(0, 3).map((s: StockShop) => s.shop)));
      } else if (posRes.status === 403) {
        setError("You don't have access to view stock data.");
      } else {
        setError("Couldn't reach the stock system — try refreshing.");
      }

      if (summaryRes.ok) {
        const s = await summaryRes.json();
        setLowStock(s.low_stock_items || []);
      }

      if (pendingRes.ok) {
        setPending(await pendingRes.json());
      }
    } catch {
      setError("Couldn't reach the stock system — try refreshing.");
    }
    setLoading(false);
  }, [countryId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleShop = (shop: string) => {
    setExpandedShops((prev) => {
      const next = new Set(prev);
      if (next.has(shop)) next.delete(shop);
      else next.add(shop);
      return next;
    });
  };

  const togglePendingShop = (shop: string) => {
    setExpandedPendingShops((prev) => {
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
  const visibleLowStock = showAllLowStock ? lowStock : lowStock.slice(0, 5);
  const pendingWithItems = pending.filter((p) => p.payment_pending > 0 || p.installation_pending > 0);
  const totalPaymentPending = pending.reduce((s, p) => s + (p.payment_pending || 0), 0);
  const totalInstallPending = pending.reduce((s, p) => s + (p.installation_pending || 0), 0);

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

      {error && !loading && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm">
          <AlertTriangle size={16} className="shrink-0" />
          {error} This can mean the connection to the stock system failed — it does not necessarily mean there's no stock.
        </div>
      )}

      {/* Low stock alert */}
      {!loading && lowStock.length > 0 && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-rose-500/20">
            <span className="flex items-center gap-2 text-sm font-semibold text-rose-300">
              <AlertTriangle size={16} />
              {lowStock.length} item{lowStock.length > 1 ? "s" : ""} running low
            </span>
            {lowStock.length > 5 && (
              <button
                onClick={() => setShowAllLowStock((v) => !v)}
                className="text-xs text-rose-300 hover:text-rose-200 underline"
              >
                {showAllLowStock ? "Show less" : `Show all ${lowStock.length}`}
              </button>
            )}
          </div>
          <div className="divide-y divide-rose-500/10">
            {visibleLowStock.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <span className="text-white font-medium">{item.shop}</span>
                  <span className="text-[var(--text-muted)]"> — {item.model} ({item.material}, {item.position})</span>
                </div>
                <span className="font-bold text-rose-400">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
      ) : filtered.length === 0 && !error ? (
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

      {/* Pending Items */}
      {!loading && pendingWithItems.length > 0 && (
        <div>
          <div className="flex items-center gap-4 mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-amber-400" />
              Pending Items
            </h2>
            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <CreditCard size={12} /> {totalPaymentPending} payment
            </span>
            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <Wrench size={12} /> {totalInstallPending} installation
            </span>
          </div>
          <div className="space-y-2">
            {pendingWithItems.map((shop) => (
              <div key={shop.shop} className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePendingShop(shop.shop)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm font-medium text-white">{shop.shop}</span>
                  <div className="flex items-center gap-4 text-xs">
                    {shop.payment_pending > 0 && (
                      <span className="flex items-center gap-1 text-amber-400 font-semibold">
                        <CreditCard size={12} /> {shop.payment_pending} pending
                      </span>
                    )}
                    {shop.installation_pending > 0 && (
                      <span className="flex items-center gap-1 text-blue-400 font-semibold">
                        <Wrench size={12} /> {shop.installation_pending} pending
                      </span>
                    )}
                  </div>
                </button>
                {expandedPendingShops.has(shop.shop) && shop.items?.length > 0 && (
                  <ul className="border-t border-[var(--border-subtle)] px-4 py-2 space-y-1">
                    {shop.items.map((item, i) => (
                      <li key={i} className="text-sm text-[var(--text-muted)]">{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
