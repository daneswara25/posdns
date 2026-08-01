import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Receipt, Undo2 } from "lucide-react";

const PIE = ["#2563EB", "#7C3AED", "#F97316", "#10B981"];

export default function Reports() {
  const { user } = useAuth();
  const canRefund = ["Owner", "Manager"].includes(user?.role);
  const [rep, setRep] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = () => {
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    api.get("/reports/sales", { params }).then((r) => setRep(r.data));
  };
  useEffect(load, []);

  const refund = async (id) => {
    if (!window.confirm("Refund transaksi ini? Stok akan dikembalikan.")) return;
    try {
      await api.post(`/sales/${id}/refund`);
      toast.success("Refund berhasil");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  if (!rep) return <div className="text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Analitik</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Laporan Penjualan</h1>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label className="text-xs">Dari</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="report-start" /></div>
        <div className="space-y-1"><Label className="text-xs">Sampai</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="report-end" /></div>
        <Button onClick={load} data-testid="report-filter-button">Terapkan</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Total Omzet</p><p className="mt-2 font-display text-2xl font-bold">{rupiah(rep.total)}</p></div>
        <div className="rounded-lg border border-border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Laba Kotor</p><p className="mt-2 font-display text-2xl font-bold text-emerald-600">{rupiah(rep.profit)}</p></div>
        <div className="rounded-lg border border-border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Jumlah Transaksi</p><p className="mt-2 font-display text-2xl font-bold">{rep.count}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-display font-semibold">Metode Pembayaran</h3>
          <div className="mt-2 h-56">
            {rep.by_method.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada data.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rep.by_method} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={70} label={(e) => e.method}>
                    {rep.by_method.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => rupiah(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-3 font-display font-semibold">Riwayat Transaksi</h3>
          <div className="max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-xs uppercase text-muted-foreground">
                <tr><th className="py-2 text-left">Invoice</th><th className="py-2 text-left">Metode</th><th className="py-2 text-right">Total</th><th className="py-2 text-right">Waktu</th><th></th></tr>
              </thead>
              <tbody>
                {rep.sales.map((s) => (
                  <tr key={s.id} className="border-t border-border" data-testid={`sale-row-${s.id}`}>
                    <td className="py-2 font-medium">{s.invoice}</td>
                    <td className="py-2 text-muted-foreground">{s.payment_method}</td>
                    <td className="py-2 text-right font-semibold">{rupiah(s.total)}</td>
                    <td className="py-2 text-right text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("id-ID")}</td>
                    <td className="py-2 text-right">
                      {canRefund && !s.refunded && (
                        <Button variant="ghost" size="icon" onClick={() => refund(s.id)} data-testid={`refund-${s.id}`} title="Refund"><Undo2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                      {s.refunded && <span className="text-xs text-destructive">Refunded</span>}
                    </td>
                  </tr>
                ))}
                {rep.sales.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Belum ada transaksi.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
