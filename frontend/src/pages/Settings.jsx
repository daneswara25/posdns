import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Store, Save } from "lucide-react";

export default function Settings() {
  const [form, setForm] = useState({ business_name: "", address: "", phone: "", currency: "Rp", tax_rate: 0, receipt_footer: "" });

  useEffect(() => {
    api.get("/settings").then((r) => setForm({ ...form, ...r.data }));
    // eslint-disable-next-line
  }, []);

  const save = async () => {
    try {
      await api.put("/settings", { ...form, tax_rate: Number(form.tax_rate) });
      toast.success("Pengaturan disimpan");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Konfigurasi</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Pengaturan</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Informasi Outlet</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>Nama Bisnis</Label><Input value={form.business_name || ""} onChange={(e) => setForm({ ...form, business_name: e.target.value })} data-testid="settings-business-input" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Alamat</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-1"><Label>Telepon</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1"><Label>Mata Uang</Label><Input value={form.currency || ""} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          <div className="space-y-1"><Label>Pajak Default (%)</Label><Input type="number" value={form.tax_rate ?? 0} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} data-testid="settings-tax-input" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Footer Struk</Label><Input value={form.receipt_footer || ""} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} /></div>
        </div>
        <Button onClick={save} className="mt-6 gap-2" data-testid="save-settings-button"><Save className="h-4 w-4" /> Simpan Perubahan</Button>
      </div>
    </div>
  );
}
