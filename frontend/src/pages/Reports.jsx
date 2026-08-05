import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Receipt, Undo2, FileSpreadsheet, FileText, Scale } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PIE = ["#2563EB", "#7C3AED", "#F97316", "#10B981"];

export default function Reports() {
  const { user } = useAuth();
  const canRefund = ["Owner", "Manager"].includes(user?.role);
  const [rep, setRep] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [trend, setTrend] = useState([]);
  const [pl, setPl] = useState(null);

  const loadPL = (params) => {
    api.get("/reports/profit-loss", { params }).then((r) => setPl(r.data));
  };
  const load = () => {
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    api.get("/reports/sales", { params }).then((r) => setRep(r.data));
    loadPL(params);
  };
  const loadTrend = (y) => {
    api.get("/reports/monthly", { params: { year: y } }).then((r) => setTrend(r.data.months));
  };
  useEffect(() => { load(); loadTrend(year); }, []);

  const loadMonth = () => {
    const s = `${year}-${String(month).padStart(2, "0")}-01`;
    const last = new Date(year, month, 0).getDate();
    const e = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    setStart(s); setEnd(e);
    api.get("/reports/sales", { params: { start: s, end: e } }).then((r) => setRep(r.data));
    loadPL({ start: s, end: e });
    loadTrend(year);
  };

  const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const YEARS = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
  const trendData = trend.map((m) => ({ ...m, label: SHORT_MONTHS[m.month - 1] }));

  const periodLabel = () => {
    if (start && end) return `${start} s/d ${end}`;
    return "Semua Periode";
  };

  const exportExcel = () => {
    const header = [["Invoice", "Metode", "Subtotal", "Diskon", "Pajak", "Total", "Waktu"]];
    const rows = rep.sales.map((s) => [
      s.invoice, s.payment_method, s.subtotal || 0, s.discount || 0, s.tax || 0, s.total,
      new Date(s.created_at).toLocaleString("id-ID"),
    ]);
    const summary = [[], ["Ringkasan"], ["Periode", periodLabel()], ["Total Omzet", rep.total], ["Laba Kotor", rep.profit], ["Jumlah Transaksi", rep.count]];
    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows, ...summary]);
    ws["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Penjualan");
    XLSX.writeFile(wb, `Laporan-Penjualan-${start || "semua"}.xlsx`);
    toast.success("Laporan Excel diunduh");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Laporan Penjualan", 14, 18);
    doc.setFontSize(10);
    doc.text(`Periode: ${periodLabel()}`, 14, 26);
    doc.text(`Total Omzet: Rp ${rep.total.toLocaleString("id-ID")}   |   Laba Kotor: Rp ${rep.profit.toLocaleString("id-ID")}   |   Transaksi: ${rep.count}`, 14, 32);
    autoTable(doc, {
      startY: 38,
      head: [["Invoice", "Metode", "Total", "Waktu"]],
      body: rep.sales.map((s) => [s.invoice, s.payment_method, `Rp ${s.total.toLocaleString("id-ID")}`, new Date(s.created_at).toLocaleString("id-ID")]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`Laporan-Penjualan-${start || "semua"}.pdf`);
    toast.success("Laporan PDF diunduh");
  };

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Analitik</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Laporan Penjualan</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportExcel} data-testid="export-excel-button">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportPDF} data-testid="export-pdf-button">
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Bulan</Label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm" data-testid="report-month">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tahun</Label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm" data-testid="report-year">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <Button onClick={loadMonth} data-testid="report-month-button">Lihat Penjualan Bulan Ini</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <div className="space-y-1"><Label className="text-xs">Dari (custom)</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="report-start" /></div>
          <div className="space-y-1"><Label className="text-xs">Sampai</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="report-end" /></div>
          <Button variant="outline" onClick={load} data-testid="report-filter-button">Terapkan Rentang</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Total Omzet</p><p className="mt-2 font-display text-2xl font-bold">{rupiah(rep.total)}</p></div>
        <div className="rounded-lg border border-border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Laba Kotor</p><p className="mt-2 font-display text-2xl font-bold text-emerald-600">{rupiah(rep.profit)}</p></div>
        <div className="rounded-lg border border-border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Jumlah Transaksi</p><p className="mt-2 font-display text-2xl font-bold">{rep.count}</p></div>
      </div>

      {pl && (
        <div className="rounded-lg border border-border bg-card p-6" data-testid="profit-loss-section">
          <div className="mb-4 flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-semibold">Laba Rugi {start && end ? `(${start} s/d ${end})` : "(Semua Periode)"}</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-1">
              <span className="font-medium">Total Penjualan (Pemasukan)</span>
              <span className="font-semibold text-emerald-600" data-testid="pl-revenue">{rupiah(pl.revenue)}</span>
            </div>
            <div className="rounded-md bg-secondary/40 p-3">
              <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                <span>Pengeluaran per Kategori</span>
                <span>Total: {rupiah(pl.expense_total)}</span>
              </div>
              {pl.expenses_by_category.length === 0 ? (
                <p className="py-1 text-xs text-muted-foreground">Belum ada pengeluaran pada periode ini.</p>
              ) : (
                pl.expenses_by_category.map((e) => (
                  <div key={e.category} className="flex items-center justify-between py-0.5">
                    <span className="text-muted-foreground">{e.category}</span>
                    <span className="text-destructive">- {rupiah(e.amount)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="font-display text-base font-bold">Laba Bersih</span>
              <span className={`font-display text-xl font-bold ${pl.net_profit >= 0 ? "text-emerald-600" : "text-destructive"}`} data-testid="pl-net-profit">{rupiah(pl.net_profit)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Laba Bersih = Total Penjualan − Total Pengeluaran. Referensi: Modal barang terjual (HPP) {rupiah(pl.hpp)}, Laba Kotor {rupiah(pl.gross_profit)}.</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display font-semibold">Tren Omzet Bulanan {year}</h3>
          <span className="text-xs text-muted-foreground">Total setahun: {rupiah(trendData.reduce((a, m) => a + m.total, 0))}</span>
        </div>
        <div className="h-72" data-testid="yearly-trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : v} />
              <Tooltip formatter={(v) => rupiah(v)} cursor={{ fill: "hsl(var(--secondary))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="total" name="Omzet" fill="#2563EB" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
