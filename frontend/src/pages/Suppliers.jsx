import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";

const EMPTY = { name: "", phone: "", email: "", address: "" };

export default function Suppliers() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const load = () => { api.get("/suppliers").then((r) => setList(r.data)); };
  useEffect(load, []);

  const save = async () => {
    if (!form.name) return toast.error("Nama wajib diisi");
    try {
      if (editId) await api.put(`/suppliers/${editId}`, form);
      else await api.post("/suppliers", form);
      toast.success("Supplier disimpan");
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const del = async (id) => { if (!window.confirm("Hapus supplier?")) return; await api.delete(`/suppliers/${id}`); load(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pembelian</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Supplier</h1>
        </div>
        <Button onClick={() => { setForm(EMPTY); setEditId(null); setOpen(true); }} className="gap-2" data-testid="add-supplier-button"><Plus className="h-4 w-4" /> Tambah</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-card p-4" data-testid={`supplier-${s.id}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary"><Truck className="h-5 w-5" /></div>
                <div><p className="font-semibold">{s.name}</p><p className="text-xs text-muted-foreground">{s.phone || "—"}</p></div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setForm(s); setEditId(s.id); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => del(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
            {s.address && <p className="mt-2 text-xs text-muted-foreground">{s.address}</p>}
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Belum ada supplier.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="supplier-dialog">
          <DialogHeader><DialogTitle className="font-display">{editId ? "Edit" : "Tambah"} Supplier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="supplier-name-input" /></div>
            <div className="space-y-1"><Label>Telepon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1"><Label>Alamat</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save} className="w-full" data-testid="save-supplier-button">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
