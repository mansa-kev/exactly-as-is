import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminService } from '../../services/adminService';
import { reservationService } from '../../services/reservationService';
import { calculateRentalDays } from '../../utils/rentalDays';

export function AdminReservationConcierge() {
  const navigate = useNavigate();
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    vehicleModelId: '',
    startDate: '',
    endDate: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
  });

  useEffect(() => {
    const load = async () => {
      const result = await adminService.getVehicleModels(1, 500);
      setModels(result?.data || []);
    };
    load();
  }, []);

  const selectedModel = models.find((m) => m.id === form.vehicleModelId);
  const days = calculateRentalDays(form.startDate, form.endDate);
  const reservationFee = 500;
  const estimatedTotal = reservationFee + days * Number(selectedModel?.base_daily_rate || 0);

  const createReservation = async () => {
    if (!form.vehicleModelId || !form.startDate || !form.endDate || !form.contactName || !form.contactEmail || !form.contactPhone) {
      toast.error('Please complete all required fields');
      return;
    }
    if (days <= 0) {
      toast.error('End date must be after start date');
      return;
    }

    setLoading(true);
    try {
      const availability = await reservationService.checkModelAvailability(form.vehicleModelId, form.startDate, form.endDate);
      if (!availability.available) {
        toast.error('Selected model is not available for those dates');
        return;
      }

      const reservation = await reservationService.createReservation({
        vehicleModelId: form.vehicleModelId,
        startDate: form.startDate,
        endDate: form.endDate,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        notes: form.notes,
        reservationFee,
      } as any);

      toast.success(`Reservation created (${String(reservation.id).slice(0, 8).toUpperCase()})`);
      navigate('/admin/reservations');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create reservation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black">Reservation Concierge</h1>
          <p className="text-sm text-muted-foreground mt-1">Create an assisted reservation (reservation fee flow, not full booking).</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Vehicle model *</label>
            <select
              value={form.vehicleModelId}
              onChange={(e) => setForm((prev) => ({ ...prev, vehicleModelId: e.target.value }))}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm"
            >
              <option value="">Select model</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name || `${m.make} ${m.model}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Contact name *</label>
            <input value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Pickup date *</label>
            <input type="date" value={form.startDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Return date *</label>
            <input type="date" value={form.endDate} min={form.startDate || new Date().toISOString().split('T')[0]} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Contact email *</label>
            <input type="email" value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Contact phone *</label>
            <input value={form.contactPhone} onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Notes</label>
          <textarea rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm" />
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm">
          <div className="flex justify-between"><span>Duration</span><span className="font-bold">{days || 0} day(s)</span></div>
          <div className="flex justify-between"><span>Reservation fee</span><span className="font-bold">KES {reservationFee.toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Estimated total (fee + rental)</span><span className="font-bold">KES {estimatedTotal.toLocaleString()}</span></div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => navigate('/admin/reservations')} className="px-6 py-3 bg-muted text-muted-foreground rounded-xl font-bold flex items-center gap-2">
            <ArrowLeft size={16} /> Back
          </button>
          <button onClick={createReservation} disabled={loading} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Create Reservation
          </button>
        </div>
      </div>
    </div>
  );
}
