import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberInput } from "@/components/NumberInput";
import { NotaDialog } from "@/components/NotaDialog";
import { toast } from "sonner";
import { CheckCircle2, Clock, Trash2, Printer, Search } from "lucide-react";

const METHODS = ["Tunai", "Bank Transfer", "QRIS", "E-Wallet"];
const BANKS = ["BCA TOKO", "BRI TOKO", "BCA ADMIN (ELIS)"];
const isBank = (m) => BANKS.includes(m);

export default function Orders() {
  const [list, setList] = useState([]);
  const [settings, setSettings] = useState({});
  const [settle, setSettle] = useState(null);
  const [method, setMethod] = useState("Tunai");
  const [paid, setPaid] = useState("");
  const [q, setQ] = useState("");
  const [nota, setNota] = useState(null);

  const load = () => { api.get("/orders").then((r) => setList(r.data)); };
  useEffect(() => {
    load();
    api.get("/settings").then((r) => setSettings(r.data || {}));
  }, []);

  const printNota = (o) => setNota(o);

  const complete = async () => {
    const remaining = settle.remaining;
    if (Number(paid) < remaining) return toast.error("Nominal pelunasan kurang");
    try {
      const { data } = await api.post(`/orders/${settle.id}/complete`, { payment_method: method, paid_amount: Number(paid) });
      toast.success("Pesanan selesai & struk dibuat");
      setSettle(null); setPaid(""); load();
      setNota(data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const del = async (id) => { if (!window.confirm("Hapus pesanan?")) return; await api.delete(`/orders/${id}`); load(); };

  const term = q.trim().toLowerCase();
  const filtered = term
    ? list.filter((o) => `${o.order_number} ${o.customer_name || ""} ${o.status}`.toLowerCase().includes(term))
    : list;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pesanan Custom</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Pesanan & Deposit</h1>
        <p className="mt-1 text-sm text-muted-foreground">Buat pesanan dengan uang muka (DP) dari halaman Kasir POS. Lunasi di sini saat pesanan selesai.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari no. pesanan, nama, atau status..." className="pl-10" data-testid="order-search" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filtered.map((o) => (
          <div key={o.id} className="rounded-lg border border-border bg-card p-4" data-testid={`order-${o.id}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{o.order_number}</p>
                <p className="text-xs text-muted-foreground">{o.customer_name || "Tanpa nama"} · {new Date(o.created_at).toLocaleString("id-ID")}</p>
              </div>
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${o.status === "Selesai" ? "bg-emerald-500/15 text-emerald-600" : "bg-orange-500/15 text-orange-600"}`}>
                {o.status === "Selesai" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />} {o.status}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Total</span><span>{rupiah(o.total)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Deposit (DP)</span><span>{rupiah(o.deposit_amount)}</span></div>
              <div className="flex justify-between font-semibold"><span>Sisa</span><span className={o.remaining > 0 ? "text-orange-600" : ""}>{rupiah(o.remaining)}</span></div>
            </div>
            <div className="mt-3 flex gap-2">
              {o.status !== "Selesai" && <Button className="flex-1" onClick={() => { setSettle(o); setPaid(o.remaining); }} data-testid={`complete-order-${o.id}`}>Selesaikan & Lunasi</Button>}
              <Button variant="outline" size="sm" className="gap-1" onClick={() => printNota(o)} data-testid={`reprint-order-${o.id}`}><Printer className="h-4 w-4" /> Nota</Button>
              <Button variant="ghost" size="icon" onClick={() => del(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>}
        {list.length > 0 && filtered.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada pesanan cocok.</p>}
      </div>

      <Dialog open={!!settle} onOpenChange={() => setSettle(null)}>
        <DialogContent data-testid="settle-dialog">
          <DialogHeader><DialogTitle className="font-display">Pelunasan — Sisa {rupiah(settle?.remaining || 0)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((m) => {
                  const active = m === "Bank Transfer" ? isBank(method) : method === m;
                  return (
                    <button key={m} onClick={() => setMethod(m === "Bank Transfer" ? BANKS[0] : m)} className={`rounded-md border py-3 text-sm font-semibold transition-colors duration-200 ${active ? "border-primary bg-accent text-accent-foreground" : "border-border"}`} data-testid={`settle-method-${m}`}>{m}</button>
                  );
                })}
              </div>
              {isBank(method) && (
                <div className="grid grid-cols-3 gap-2" data-testid="settle-bank-options">
                  {BANKS.map((b) => (
                    <button key={b} onClick={() => setMethod(b)} className={`rounded-md border px-2 py-2 text-xs font-semibold transition-colors duration-200 ${method === b ? "border-primary bg-accent text-accent-foreground" : "border-border"}`} data-testid={`settle-bank-${b}`}>{b}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1"><Label>Nominal Pelunasan</Label><NumberInput value={paid} onValueChange={setPaid} className="h-12 text-lg" data-testid="settle-paid-input" /></div>
          </div>
          <DialogFooter><Button onClick={complete} className="w-full" data-testid="settle-confirm-button">Konfirmasi Selesai</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <NotaDialog nota={nota} onClose={() => setNota(null)} settings={settings} />
    </div>
  );
}
