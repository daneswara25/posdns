import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Clock, Trash2 } from "lucide-react";

const METHODS = ["Tunai", "Kartu", "QRIS", "E-Wallet"];

export default function Orders() {
  const [list, setList] = useState([]);
  const [settle, setSettle] = useState(null);
  const [method, setMethod] = useState("Tunai");
  const [paid, setPaid] = useState("");

  const load = () => { api.get("/orders").then((r) => setList(r.data)); };
  useEffect(load, []);

  const complete = async () => {
    const remaining = settle.remaining;
    if (Number(paid) < remaining) return toast.error("Nominal pelunasan kurang");
    try {
      await api.post(`/orders/${settle.id}/complete`, { payment_method: method, paid_amount: Number(paid) });
      toast.success("Pesanan selesai & struk dibuat");
      setSettle(null); setPaid(""); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const del = async (id) => { if (!window.confirm("Hapus pesanan?")) return; await api.delete(`/orders/${id}`); load(); };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pesanan Custom</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Pesanan & Deposit</h1>
        <p className="mt-1 text-sm text-muted-foreground">Buat pesanan dengan uang muka (DP) dari halaman Kasir POS. Lunasi di sini saat pesanan selesai.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {list.map((o) => (
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
              {o.status !== "Selesai" && <Button className="flex-1" onClick={() => { setSettle(o); setPaid(String(o.remaining)); }} data-testid={`complete-order-${o.id}`}>Selesaikan & Lunasi</Button>}
              <Button variant="ghost" size="icon" onClick={() => del(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>}
      </div>

      <Dialog open={!!settle} onOpenChange={() => setSettle(null)}>
        <DialogContent data-testid="settle-dialog">
          <DialogHeader><DialogTitle className="font-display">Pelunasan — Sisa {rupiah(settle?.remaining || 0)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button key={m} onClick={() => setMethod(m)} className={`rounded-md border py-3 text-sm font-semibold transition-colors duration-200 ${method === m ? "border-primary bg-accent text-accent-foreground" : "border-border"}`} data-testid={`settle-method-${m}`}>{m}</button>
              ))}
            </div>
            <div className="space-y-1"><Label>Nominal Pelunasan</Label><Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} className="h-12 text-lg" data-testid="settle-paid-input" /></div>
          </div>
          <DialogFooter><Button onClick={complete} className="w-full" data-testid="settle-confirm-button">Konfirmasi Selesai</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
