import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import {
  Car,
  Wrench,
  ShieldCheck,
  Radio,
  FileText,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Plus,
  Loader2,
  Calendar,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  PieChart as PieIcon,
  BarChart4,
  Clock,
  Layers,
  ArrowRight,
  User,
  Tags
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { logger } from '../../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CarAsset {
  id: string;
  make: string;
  model: string;
  year: number;
  license_plate: string;
  status: string;
  primary_image_url?: string;
  insurance_expiry?: string;
  gps_tracker_expiry?: string;
  insurance_policy_number?: string;
  gps_tracker_provider?: string;
}

interface Expense {
  id: string;
  car_id: string | null;
  amount: number;
  type: 'insurance' | 'tracker' | 'accident_repair' | 'maintenance_cost' | 'corporate_general' | 'other';
  description: string;
  date: string;
  metadata: any;
  created_at: string;
  // joined
  car?: CarAsset | null;
}

const EXPENSE_TYPES = [
  { value: 'insurance', label: 'Insurance Premium', icon: ShieldCheck, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { value: 'tracker', label: 'GPS Tracker Renewal', icon: Radio, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { value: 'accident_repair', label: 'Accident Repair', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
  { value: 'maintenance_cost', label: 'Maintenance & Service', icon: Wrench, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { value: 'corporate_general', label: 'General Corporate Overhead', icon: Layers, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { value: 'other', label: 'Other Expenses', icon: FileText, color: 'text-slate-500', bg: 'bg-slate-500/10' },
];

const COLORS = ['#3b82f6', '#a855f7', '#ef4444', '#f59e0b', '#10b981', '#64748b'];

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminExpenses() {
  const [cars, setCars] = useState<CarAsset[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedCar, setSelectedCar] = useState<CarAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<Expense['type']>('maintenance_cost');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCarLinked, setIsCarLinked] = useState(true);
  
  // Metadata fields
  const [policyNumber, setPolicyNumber] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [trackerProvider, setTrackerProvider] = useState('');
  const [trackerExpiry, setTrackerExpiry] = useState('');
  const [workshopName, setWorkshopName] = useState('');
  const [insuranceClaimed, setInsuranceClaimed] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Cars
      const { data: carsData, error: carsError } = await supabase
        .from('cars')
        .select('*')
        .order('make', { ascending: true });
      if (carsError) throw carsError;
      setCars(carsData || []);

      // 2. Fetch Expenses with joined car details
      const { data: expensesData, error: expError } = await supabase
        .from('expenses')
        .select(`
          *,
          car:cars(*)
        `)
        .order('date', { ascending: false });
      if (expError) throw expError;
      setExpenses((expensesData as Expense[]) || []);
    } catch (err) {
      logger.error('AdminExpenses: fetch error', err);
      toast.error('Failed to load expenses or fleet assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Submissions ────────────────────────────────────────────────────────────

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const linkedCarId = (isCarLinked && selectedCar) ? selectedCar.id : null;
    if (isCarLinked && !selectedCar) {
      toast.error('Please select a car from the fleet or uncheck "Link to specific car"');
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Build metadata based on expense type
      const meta: any = {};
      if (type === 'insurance') {
        meta.policy_number = policyNumber;
        meta.expiry_date = insuranceExpiry;
      } else if (type === 'tracker') {
        meta.provider = trackerProvider;
        meta.expiry_date = trackerExpiry;
      } else if (type === 'accident_repair') {
        meta.workshop = workshopName;
        meta.insurance_claimed_amount = Number(insuranceClaimed) || 0;
      }

      // 1. Insert expense record (category = legacy NOT NULL column; type = extended column)
      const { error: insertError } = await supabase
        .from('expenses')
        .insert({
          car_id: linkedCarId,
          amount: Number(amount),
          type,
          category: type,
          description: description.trim() || type.replace(/_/g, ' '),
          date,
          metadata: meta,
          user_id: user?.id ?? null,
        });

      if (insertError) throw insertError;

      // 2. Update Car Details if insurance/tracker is registered
      if (linkedCarId) {
        const updateData: any = {};
        if (type === 'insurance' && insuranceExpiry) {
          updateData.insurance_expiry = insuranceExpiry;
          if (policyNumber) updateData.insurance_policy_number = policyNumber;
        } else if (type === 'tracker' && trackerExpiry) {
          updateData.gps_tracker_expiry = trackerExpiry;
          if (trackerProvider) updateData.gps_tracker_provider = trackerProvider;
        }

        if (Object.keys(updateData).length > 0) {
          const { error: carUpdateErr } = await supabase
            .from('cars')
            .update(updateData)
            .eq('id', linkedCarId);
          
          if (carUpdateErr) throw carUpdateErr;
        }
      }

      toast.success('Expense recorded successfully!');
      
      // Reset form
      setAmount('');
      setDescription('');
      setPolicyNumber('');
      setInsuranceExpiry('');
      setTrackerProvider('');
      setTrackerExpiry('');
      setWorkshopName('');
      setInsuranceClaimed('');

      await fetchData();
    } catch (err: any) {
      logger.error('Add expense error:', err);
      toast.error(err?.message || 'Failed to log expense');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Calculated metrics ─────────────────────────────────────────────────────

  const totalExpenseAmount = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  // Group by category
  const pieData = EXPENSE_TYPES.map((t) => {
    const total = expenses
      .filter((e) => e.type === t.value)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    return { name: t.label, value: total };
  }).filter((d) => d.value > 0);

  // Top cars by expense
  const carExpensesMap: Record<string, { label: string; amount: number }> = {};
  expenses.forEach((e) => {
    if (e.car_id && e.car) {
      const key = e.car_id;
      const carLabel = `${e.car.make} ${e.car.model} (${e.car.license_plate})`;
      if (!carExpensesMap[key]) {
        carExpensesMap[key] = { label: carLabel, amount: 0 };
      }
      carExpensesMap[key].amount += Number(e.amount);
    }
  });
  const barData = Object.values(carExpensesMap)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5); // top 5 most expensive cars

  // Expiry alerts checker
  const getCarAlerts = (car: CarAsset) => {
    const alerts = [];
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (car.insurance_expiry) {
      const insExpiry = new Date(car.insurance_expiry);
      if (insExpiry <= today) {
        alerts.push({ type: 'danger', message: 'Insurance EXPIRED!' });
      } else if (insExpiry <= thirtyDaysFromNow) {
        alerts.push({ type: 'warning', message: 'Insurance expires soon' });
      }
    } else {
      alerts.push({ type: 'info', message: 'No insurance details' });
    }

    if (car.gps_tracker_expiry) {
      const gpsExpiry = new Date(car.gps_tracker_expiry);
      if (gpsExpiry <= today) {
        alerts.push({ type: 'danger', message: 'GPS Tracker EXPIRED!' });
      } else if (gpsExpiry <= thirtyDaysFromNow) {
        alerts.push({ type: 'warning', message: 'GPS Tracker expires soon' });
      }
    } else {
      alerts.push({ type: 'info', message: 'No GPS Tracker details' });
    }

    return alerts;
  };

  // Selected car's expense history
  const selectedCarExpenses = selectedCar
    ? expenses.filter((e) => e.car_id === selectedCar.id)
    : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <DollarSign size={22} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Expense & Asset Health Ledger</h1>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20">
              Fleet Admin
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Track operational costs, manage vehicle insurance / tracker expiries, and view asset financial health.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-sm font-bold transition-all"
        >
          <Clock size={16} />
          Refresh Stats
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      ) : (
        <>
          {/* Top Level Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Ledger Expenses</span>
              <h2 className="text-3xl font-bold text-foreground">KSh {totalExpenseAmount.toLocaleString()}</h2>
              <span className="text-xs text-muted-foreground">Total accumulated operational and overhead costs</span>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Fleet Size</span>
              <h2 className="text-3xl font-bold text-foreground">{cars.length} Vehicles</h2>
              <span className="text-xs text-muted-foreground">Assets eligible for insurance/tracker updates</span>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Asset Health Warnings</span>
              <h2 className="text-3xl font-bold text-amber-500">
                {cars.filter(c => getCarAlerts(c).some(a => a.type === 'danger' || a.type === 'warning')).length} Alerts
              </h2>
              <span className="text-xs text-muted-foreground">Vehicles with expired or expiring policies</span>
            </div>
          </div>

          {/* Interactive Fleet Selection Carousel */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Car size={18} className="text-primary" />
                Select Vehicle to Manage Health & Expenses
              </h3>
              {selectedCar && (
                <button
                  onClick={() => setSelectedCar(null)}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  Clear Selection
                </button>
              )}
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {cars.map((car) => {
                const alerts = getCarAlerts(car);
                const isSelected = selectedCar?.id === car.id;
                const carExpensesTotal = expenses
                  .filter((e) => e.car_id === car.id)
                  .reduce((sum, e) => sum + Number(e.amount), 0);

                return (
                  <button
                    key={car.id}
                    onClick={() => {
                      setSelectedCar(car);
                      setIsCarLinked(true);
                    }}
                    className={`flex-shrink-0 w-72 text-left rounded-2xl border p-5 transition-all hover:scale-[1.02] flex flex-col justify-between ${
                      isSelected
                        ? 'bg-primary/5 border-primary shadow-lg shadow-primary/5'
                        : 'bg-card border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{car.license_plate}</span>
                        {alerts.some(a => a.type === 'danger') ? (
                          <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-wider border border-red-500/20">
                            Action Needed
                          </span>
                        ) : alerts.some(a => a.type === 'warning') ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20">
                            Attention
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider border border-green-500/20">
                            Good
                          </span>
                        )}
                      </div>
                      
                      <h4 className="font-bold text-base text-foreground">{car.make} {car.model}</h4>
                      <p className="text-xs text-muted-foreground">{car.year}</p>

                      <div className="mt-4 space-y-1.5 border-t border-border pt-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Insurance:</span>
                          <span className="font-medium text-foreground">
                            {car.insurance_expiry ? new Date(car.insurance_expiry).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Tracker:</span>
                          <span className="font-medium text-foreground">
                            {car.gps_tracker_expiry ? new Date(car.gps_tracker_expiry).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Car Expenses:</span>
                      <span className="text-sm font-bold text-foreground">KSh {carExpensesTotal.toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ledger Details & Entry Form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Form Column */}
            <div className="bg-card rounded-2xl border border-border p-6 h-fit space-y-6">
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <Plus size={18} className="text-primary" />
                  Log New Expense
                </h3>
                <p className="text-xs text-muted-foreground">Record custom assets expenses or overhead</p>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-4">
                {/* Car Link Toggle */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
                  <span className="text-sm font-medium text-foreground">Link to specific car</span>
                  <input
                    type="checkbox"
                    checked={isCarLinked}
                    onChange={(e) => setIsCarLinked(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
                  />
                </div>

                {isCarLinked && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Selected Car</label>
                    {selectedCar ? (
                      <div className="p-3 bg-muted rounded-xl border border-border flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-foreground">{selectedCar.make} {selectedCar.model}</p>
                          <p className="text-xs text-muted-foreground">{selectedCar.license_plate}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedCar(null)}
                          className="text-xs text-red-500 font-bold hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-red-500/5 text-red-500 rounded-xl border border-red-500/20 text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle size={14} />
                        Select a vehicle from the carousel above.
                      </div>
                    )}
                  </div>
                )}

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Expense Amount (KSh)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input
                      type="number"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-4 py-2.5 bg-muted rounded-xl border border-border focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Expense Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-muted rounded-xl border border-border focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                </div>

                {/* Expense Type */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Expense Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-muted rounded-xl border border-border focus:outline-none focus:border-primary text-sm"
                  >
                    {EXPENSE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Description / Details</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide specific details about the expense..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-muted rounded-xl border border-border focus:outline-none focus:border-primary text-sm"
                  />
                </div>

                {/* Dynamic Metadata Fields based on type */}
                {type === 'insurance' && (
                  <div className="border-t border-border pt-4 space-y-4">
                    <h4 className="text-xs font-bold uppercase text-primary tracking-wider">Insurance Policy Updates</h4>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Policy Number</label>
                      <input
                        type="text"
                        value={policyNumber}
                        onChange={(e) => setPolicyNumber(e.target.value)}
                        placeholder="e.g. LUP-INS-9873"
                        className="w-full px-4 py-2 bg-muted rounded-xl border border-border focus:outline-none focus:border-primary text-sm"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">New Insurance Expiry Date</label>
                      <input
                        type="date"
                        value={insuranceExpiry}
                        onChange={(e) => setInsuranceExpiry(e.target.value)}
                        className="w-full px-4 py-2 bg-muted rounded-xl border border-border focus:outline-none focus:border-primary text-sm"
                      />
                    </div>
                  </div>
                )}

                {type === 'tracker' && (
                  <div className="border-t border-border pt-4 space-y-4">
                    <h4 className="text-xs font-bold uppercase text-primary tracking-wider">GPS Tracker Updates</h4>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Tracker Provider</label>
                      <input
                        type="text"
                        value={trackerProvider}
                        onChange={(e) => setTrackerProvider(e.target.value)}
                        placeholder="e.g. CarTrack East Africa"
                        className="w-full px-4 py-2 bg-muted rounded-xl border border-border focus:outline-none focus:border-primary text-sm"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">New Tracker Expiry Date</label>
                      <input
                        type="date"
                        value={trackerExpiry}
                        onChange={(e) => setTrackerExpiry(e.target.value)}
                        className="w-full px-4 py-2 bg-muted rounded-xl border border-border focus:outline-none focus:border-primary text-sm"
                      />
                    </div>
                  </div>
                )}

                {type === 'accident_repair' && (
                  <div className="border-t border-border pt-4 space-y-4">
                    <h4 className="text-xs font-bold uppercase text-primary tracking-wider">Accident Claim details</h4>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Workshop Name</label>
                      <input
                        type="text"
                        value={workshopName}
                        onChange={(e) => setWorkshopName(e.target.value)}
                        placeholder="e.g. Apex Auto Body Shop"
                        className="w-full px-4 py-2 bg-muted rounded-xl border border-border focus:outline-none focus:border-primary text-sm"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Insurance Claim Amount (KSh)</label>
                      <input
                        type="number"
                        value={insuranceClaimed}
                        onChange={(e) => setInsuranceClaimed(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-2 bg-muted rounded-xl border border-border focus:outline-none focus:border-primary text-sm"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-primary hover:bg-primary/95 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {submitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Saving Expense...</>
                  ) : (
                    <>Record Expense</>
                  )}
                </button>
              </form>
            </div>

            {/* Asset Ledger History Column */}
            <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-6 space-y-4 h-fit max-h-[800px] flex flex-col">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-foreground">
                    {selectedCar ? `${selectedCar.make} ${selectedCar.model} Ledger` : 'General Expenses Ledger'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedCar ? `Historical expenses for ${selectedCar.license_plate}` : 'Recent operational updates'}
                  </p>
                </div>
                <span className="text-xs bg-muted text-muted-foreground font-bold px-2.5 py-1 rounded-lg">
                  {selectedCar ? `${selectedCarExpenses.length} entries` : `${expenses.length} entries`}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                {(selectedCar ? selectedCarExpenses : expenses).length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground flex flex-col items-center justify-center">
                    <FileText size={40} className="mb-3 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">No expenses found matching scope</p>
                  </div>
                ) : (
                  (selectedCar ? selectedCarExpenses : expenses).map((exp) => {
                    const typeCfg = EXPENSE_TYPES.find((t) => t.value === exp.type) || EXPENSE_TYPES[5];
                    const ExpIcon = typeCfg.icon;

                    return (
                      <div
                        key={exp.id}
                        className="bg-muted/30 border border-border rounded-xl p-4 flex items-start gap-4 transition-all hover:bg-muted/50"
                      >
                        <div className={`p-2.5 rounded-xl ${typeCfg.bg} ${typeCfg.color} flex-shrink-0`}>
                          <ExpIcon size={20} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <h4 className="font-bold text-sm text-foreground capitalize truncate">
                              {exp.description || typeCfg.label}
                            </h4>
                            <span className="text-sm font-bold text-foreground flex-shrink-0">
                              KSh {exp.amount.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{new Date(exp.date).toLocaleDateString()}</span>
                            <span>·</span>
                            <span className="capitalize">{exp.type.replace('_', ' ')}</span>
                            {exp.car && !selectedCar && (
                              <>
                                <span>·</span>
                                <span className="font-semibold text-primary">{exp.car.license_plate}</span>
                              </>
                            )}
                          </div>

                          {/* Metadata badge display */}
                          {exp.metadata && Object.keys(exp.metadata).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {exp.metadata.policy_number && (
                                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-medium border border-blue-500/20">
                                  Policy: {exp.metadata.policy_number}
                                </span>
                              )}
                              {exp.metadata.provider && (
                                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-500 text-[10px] font-medium border border-purple-500/20">
                                  Tracker: {exp.metadata.provider}
                                </span>
                              )}
                              {exp.metadata.workshop && (
                                <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500 text-[10px] font-medium border border-yellow-500/20">
                                  Workshop: {exp.metadata.workshop}
                                </span>
                              )}
                              {exp.metadata.expiry_date && (
                                <span className="px-2 py-0.5 rounded bg-slate-500/10 text-slate-500 text-[10px] font-medium border border-slate-500/20">
                                  Expiry: {new Date(exp.metadata.expiry_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Analytics Block */}
          {pieData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Category Breakdown */}
              <div className="bg-card rounded-2xl border border-border p-6 flex flex-col">
                <h3 className="font-bold text-base mb-1">Expense Breakdown by Category</h3>
                <p className="text-xs text-muted-foreground mb-4">Total operational breakdown</p>
                
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          borderRadius: '12px',
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Vehicles */}
              {barData.length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-6 flex flex-col">
                  <h3 className="font-bold text-base mb-1">Most Expensive Vehicles</h3>
                  <p className="text-xs text-muted-foreground mb-4">Top 5 assets with cumulative expense amounts</p>
                  
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <ChartTooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            borderRadius: '12px',
                          }}
                        />
                        <Bar dataKey="amount" fill="var(--primary)" radius={[4, 4, 0, 0]}>
                          {barData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
