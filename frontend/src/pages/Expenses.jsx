import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { NumberInput } from "@/components/NumberInput";
import { toast } from "sonner";
import { Plus, Trash2, Wallet, Receipt, Search } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { category: "", amount: "", note: "", date: today() };

export default function Expenses() {
  const [list, setList] = useState([]);
  const [cats, setCats] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  const load = () => { api.get("/expenses").then((r) => setList(r.data)); };
  useEffect(() => {
    load();
    api.get("/expense-categories").then((r) => setCats(r.data));
  }, []);

  const term = q.trim().toLowerCase();
  const filtered = term
    ? list.filter((e) => `${e.category} ${e.note || ""} ${e.date}`.toLowerCase().includes(term))
    : list;
  const total = filtered.reduce((a, e) => a + e.amount, 0);

  const save = async () => {
    if (!form.category) return toast.error("Pilih kategori");
    if (!form.amount || Number(form.amount) <= 0) return toast.error("Isi nominal");
    setSaving(true);
    try {
      await api.post("/expenses", { category: form.category, amount: Number(form.amount), note: form.note, date: form.date });
      toast.success("Pengeluaran dicatat");
      setOpen(false); setForm(EMPTY); load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    await api.delete(`/expenses/${id}`);
    toast.success("Pengeluaran dihapus");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Keuangan</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Pengeluaran</h1>
        </div>
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="gap-2" data-testid="add-expense-button">
          <Plus className="h-4 w-4" /> Tambah Pengeluaran
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kategori, catatan, atau tanggal..." className="pl-10" data-testid="expense-search" />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-destructive/10 text-destructive"><Wallet className="h-5 w-5" /></div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Pengeluaran ({list.length} catatan)</p>
            <p className="font-display text-2xl font-bold" data-testid="expense-total">{rupiah(total)}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Catatan</th>
              <th className="px-4 py-3 text-right">Nominal</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="border-t border-border" data-testid={`expense-${e.id}`}>
                <td className="px-4 py-3 whitespace-nowrap">{e.date}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{e.category}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{e.note || "-"}</td>
                <td className="px-4 py-3 text-right font-semibold">{rupiah(e.amount)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => del(e.id)} className="text-destructive" data-testid={`delete-expense-${e.id}`}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{term ? "Tidak ada pengeluaran cocok." : "Belum ada pengeluaran."}</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="expense-dialog">
          <DialogHeader><DialogTitle>Tambah Pengeluaran</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="expense-category-select"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Nominal (Rp)</Label><NumberInput value={form.amount} onValueChange={(v) => setForm({ ...form, amount: v })} data-testid="expense-amount-input" /></div>
              <div className="space-y-1"><Label>Tanggal</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="expense-date-input" /></div>
            </div>
            <div className="space-y-1"><Label>Catatan (opsional)</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="cth: Beli tinta DTF 1L" data-testid="expense-note-input" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving} data-testid="save-expense-button">{saving ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
