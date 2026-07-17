// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Truck,
  Search,
  DollarSign,
  Car as CarIcon,
  Users,
  TrendingUp,
  Phone,
  Mail,
  Edit,
  Eye,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  X,
  Percent,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  FileText,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { logger } from '../../utils/logger';
import { adminService } from '../../services/adminService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  license_plate: string;
  daily_rate: number;
  status: string;
  primary_image_url?: string;
  is_outsourced: boolean;
  outsource_owner_name?: string;
  outsource_owner_phone?: string;
  outsource_owner_email?: string;
  outsource_commission_rate?: number;
}

interface Broker {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  default_commission_rate: number;
  created_at: string;
}

interface PayoutSettlement {
  id: string;
  booking_id: string | null;
  type: 'supplier' | 'broker';
  target_id: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  payment_reference: string | null;
  settled_at: string | null;
  created_at: string;
  // joined relations
  booking?: {
    id: string;
    booking_reference?: string;
    total_amount?: number;
    status?: string;
    cars?: { make: string; model: string; license_plate: string } | null;
  } | null;
}

type TabId = 'overview' | 'supplier_cars' | 'brokers' | 'settlements' | 'financials';

const PIE_COLORS = ['#3b82f6', '#a855f7', '#ef4444', '#f59e0b', '#10b981'];

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminOutsourcedCars() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [cars, setCars] = useState<Car[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [settlements, setSettlements] = useState<PayoutSettlement[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState<PayoutSettlement | null>(null);
  const [showSupplierEditModal, setShowSupplierEditModal] = useState<Car | null>(null);

  // Form states
  const [brokerName, setBrokerName] = useState('');
  const [brokerPhone, setBrokerPhone] = useState('');
  const [brokerEmail, setBrokerEmail] = useState('');
  const [brokerRate, setBrokerRate] = useState('10');
  const [submittingBroker, setSubmittingBroker] = useState(false);

  const [paymentRef, setPaymentRef] = useState('');
  const [settling, setSettling] = useState(false);

  // Supplier update form state
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [commissionRate, setCommissionRate] = useState('15');
  const [updatingSupplier, setUpdatingSupplier] = useState(false);

  // Add supplier car form state
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState(String(new Date().getFullYear()));
  const [carPlate, setCarPlate] = useState('');
  const [carColor, setCarColor] = useState('');
  const [carCategory, setCarCategory] = useState('Sedan');
  const [carDailyRate, setCarDailyRate] = useState('');
  const [carImageFile, setCarImageFile] = useState<File | null>(null);
  const [addingSupplierCar, setAddingSupplierCar] = useState(false);

  const resetAddSupplierForm = () => {
    setCarMake('');
    setCarModel('');
    setCarYear(String(new Date().getFullYear()));
    setCarPlate('');
    setCarColor('');
    setCarCategory('Sedan');
    setCarDailyRate('');
    setCarImageFile(null);
    setOwnerName('');
    setOwnerPhone('');
    setOwnerEmail('');
    setCommissionRate('15');
  };

  const openAddSupplierModal = () => {
    resetAddSupplierForm();
    setShowAddSupplierModal(true);
  };

  // ── Fetch data ─────────────────────────────────────────────────────────────

  const fetchLedgers = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Outsourced Cars
      const { data: carsData, error: carsError } = await supabase
        .from('cars')
        .select('*')
        .eq('is_outsourced', true)
        .order('created_at', { ascending: false });
      if (carsError) throw carsError;
      setCars(carsData || []);

      // 2. Fetch Brokers
      try {
        const brokersData = await adminService.getBrokers();
        setBrokers(brokersData);
      } catch (brokersError) {
        logger.warn('Brokers table fetch failed, using fallback empty list', brokersError);
        setBrokers([]);
      }

      // 3. Fetch Payout Settlements with joined booking & car details
      const { data: settlementsData, error: setlError } = await supabase
        .from('payout_settlements')
        .select(`
          *,
          booking:bookings(
            id,
            status,
            total_amount,
            status,
            cars(*)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (setlError) {
        logger.warn('Payout settlements fetch failed, using fallback empty list');
        setSettlements([]);
      } else {
        setSettlements((settlementsData as PayoutSettlement[]) || []);
      }
    } catch (error) {
      logger.error('Error fetching outsourced module data:', error);
      toast.error('Failed to load outsourced records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLedgers();
  }, [fetchLedgers]);

  // ── Actions ────────────────────────────────────────────────────────────────

  // Add outsourced supplier car
  const handleAddSupplierCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carMake || !carModel || !carPlate || !carDailyRate || !ownerName) {
      toast.error('Please fill in vehicle details and supplier owner name');
      return;
    }
    const dailyRate = Number(carDailyRate);
    if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
      toast.error('Daily rate must be a positive number');
      return;
    }

    setAddingSupplierCar(true);
    try {
      let primaryImageUrl = '';
      if (carImageFile) {
        primaryImageUrl = await adminService.uploadCarImage(carImageFile);
      }

      const result = await adminService.addOutsourcedCar({
        make: carMake.trim(),
        model: carModel.trim(),
        year: Number(carYear) || new Date().getFullYear(),
        license_plate: carPlate.trim(),
        color: carColor.trim() || undefined,
        category: carCategory,
        daily_rate: dailyRate,
        primary_image_url: primaryImageUrl || undefined,
        outsource_owner_name: ownerName.trim(),
        outsource_owner_phone: ownerPhone.trim() || null,
        outsource_owner_email: ownerEmail.trim() || null,
        outsource_commission_rate: Number(commissionRate) || 15,
      });

      if (!result || (Array.isArray(result) && result.length === 0)) {
        throw new Error('Insert returned no data');
      }

      toast.success('Supplier car registered successfully');
      setShowAddSupplierModal(false);
      resetAddSupplierForm();
      await fetchLedgers();
    } catch (err: any) {
      logger.error('Failed to add supplier car:', err);
      const msg = err?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('A car with this license plate already exists');
      } else {
        toast.error('Failed to register supplier car');
      }
    } finally {
      setAddingSupplierCar(false);
    }
  };

  // Add Broker
  const handleAddBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brokerName) {
      toast.error('Please specify a broker name');
      return;
    }
    setSubmittingBroker(true);
    try {
      await adminService.addBroker({
        name: brokerName,
        phone: brokerPhone || null,
        email: brokerEmail || null,
        default_commission_rate: Number(brokerRate) || 10,
      });
      toast.success('Broker registered successfully!');
      
      // Reset form
      setBrokerName('');
      setBrokerPhone('');
      setBrokerEmail('');
      setBrokerRate('10');
      setShowBrokerModal(false);
      await fetchLedgers();
    } catch (err: any) {
      logger.error('Failed to add broker:', err);
      const message = err?.message || '';
      if (message.includes('brokers') || message.includes('schema cache') || message.includes('relation')) {
        toast.error('Brokers table missing. Run scripts/apply_outsourced_module_extension.sql in Supabase.');
      } else {
        toast.error('Failed to register broker');
      }
    } finally {
      setSubmittingBroker(false);
    }
  };

  // Update Supplier Car Owner detail
  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSupplierEditModal) return;
    setUpdatingSupplier(true);
    try {
      const { error } = await supabase
        .from('cars')
        .update({
          outsource_owner_name: ownerName,
          outsource_owner_phone: ownerPhone || null,
          outsource_owner_email: ownerEmail || null,
          outsource_commission_rate: Number(commissionRate) || 15
        })
        .eq('id', showSupplierEditModal.id);

      if (error) throw error;
      toast.success('Supplier details updated successfully');
      setShowSupplierEditModal(null);
      await fetchLedgers();
    } catch (err) {
      logger.error('Update supplier error:', err);
      toast.error('Failed to update supplier details');
    } finally {
      setUpdatingSupplier(false);
    }
  };

  // Open Edit Supplier Modal
  const openEditSupplier = (car: Car) => {
    setShowSupplierEditModal(car);
    setOwnerName(car.outsource_owner_name || '');
    setOwnerPhone(car.outsource_owner_phone || '');
    setOwnerEmail(car.outsource_owner_email || '');
    setCommissionRate(String(car.outsource_commission_rate || 15));
  };

  // Settle Payout
  const handleSettlePayout = async () => {
    if (!showSettleModal || !paymentRef) {
      toast.error('Please provide payment transaction reference');
      return;
    }
    setSettling(true);
    try {
      const { error } = await supabase
        .from('payout_settlements')
        .update({
          status: 'paid',
          payment_reference: paymentRef,
          settled_at: new Date().toISOString()
        })
        .eq('id', showSettleModal.id);

      if (error) throw error;

      // Fix #5: Auto-create WHT tax ledger entry (5% withholding on supplier service fees in KE)
      try {
        const amount = Number(showSettleModal.amount) || 0;
        const whtRate = 0.05;
        const whtAmount = Math.round(amount * whtRate * 100) / 100;
        await supabase.from('tax_ledger').insert({
          booking_id: showSettleModal.booking_id,
          settlement_id: showSettleModal.id,
          tax_type: 'WHT',
          rate: whtRate,
          taxable_amount: amount,
          tax_amount: whtAmount,
          status: 'recorded',
          reference: paymentRef,
          notes: `Withholding tax on ${showSettleModal.type} payout — ${paymentRef}`,
        }).then(null, (e: any) => logger.warn('Tax ledger insert skipped (table may not exist or RLS):', e?.message));
      } catch (e: any) {
        logger.warn('WHT entry skipped:', e?.message);
      }

      toast.success('Payout marked as settled');
      setPaymentRef('');
      setShowSettleModal(null);
      await fetchLedgers();
    } catch (err) {
      logger.error('Failed to settle payout:', err);
      toast.error('Failed to settle payout');
    } finally {
      setSettling(false);
    }
  };

  // ── Computed Stats ─────────────────────────────────────────────────────────

  const totalOwedSupplier = settlements
    .filter(s => s.type === 'supplier' && s.status === 'pending')
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const totalPaidSupplier = settlements
    .filter(s => s.type === 'supplier' && s.status === 'paid')
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const totalOwedBroker = settlements
    .filter(s => s.type === 'broker' && s.status === 'pending')
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const totalPaidBroker = settlements
    .filter(s => s.type === 'broker' && s.status === 'paid')
    .reduce((sum, s) => sum + Number(s.amount), 0);

  // Group settlements by status
  const pendingCount = settlements.filter(s => s.status === 'pending').length;
  const paidCount = settlements.filter(s => s.status === 'paid').length;

  // Filter cars or brokers based on search queries
  const filteredCars = cars.filter(car => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      `${car.make} ${car.model}`.toLowerCase().includes(q) ||
      car.license_plate?.toLowerCase().includes(q) ||
      car.outsource_owner_name?.toLowerCase().includes(q)
    );
  });

  const filteredBrokers = brokers.filter(broker => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      broker.name.toLowerCase().includes(q) ||
      (broker.phone && broker.phone.includes(q)) ||
      (broker.email && broker.email.toLowerCase().includes(q))
    );
  });

  const filteredSettlements = settlements.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.booking?.booking_reference?.toLowerCase() || '').includes(q) ||
      s.type.toLowerCase().includes(q) ||
      s.payment_reference?.toLowerCase().includes(q)
    );
  });

  // Chart data
  const pieData = [
    { name: 'Supplier Payouts Owed', value: totalOwedSupplier },
    { name: 'Supplier Payouts Paid', value: totalPaidSupplier },
    { name: 'Broker Payouts Owed', value: totalOwedBroker },
    { name: 'Broker Payouts Paid', value: totalPaidBroker },
  ].filter(d => d.value > 0);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'supplier_cars', label: 'Supplier Cars', count: cars.length },
    { id: 'brokers', label: 'Brokers Registry', count: brokers.length },
    { id: 'settlements', label: 'Settlements Queue', count: pendingCount },
    { id: 'financials', label: 'Ledger Analytics' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Truck size={22} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Outsourced Management</h1>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              Supply & Referral Ledgers
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage partner supplier vehicles (supply side) and broker referral commissions (demand side).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'supplier_cars' && (
            <button
              type="button"
              onClick={openAddSupplierModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={16} />
              Add Supplier Car
            </button>
          )}
          {activeTab === 'brokers' && (
            <button
              type="button"
              onClick={() => setShowBrokerModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={16} />
              Register Broker
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto scrollbar-none">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-card/50 text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-card border border-border p-6 rounded-2xl flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <CarIcon size={20} />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Outsourced Fleet</span>
                  <h3 className="text-2xl font-bold text-foreground">{cars.length} Supplier Cars</h3>
                  <span className="text-[10px] text-muted-foreground">Internal platform partner vehicles</span>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <Users size={20} />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Broker Agents</span>
                  <h3 className="text-2xl font-bold text-foreground">{brokers.length} Registered</h3>
                  <span className="text-[10px] text-muted-foreground">Demands referral sources registered</span>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending Payouts</span>
                  <h3 className="text-2xl font-bold text-amber-500">
                    KSh {Math.round(totalOwedSupplier + totalOwedBroker).toLocaleString()}
                  </h3>
                  <span className="text-[10px] text-muted-foreground">
                    KSh {Math.round(totalOwedSupplier).toLocaleString()} Partner · KSh {Math.round(totalOwedBroker).toLocaleString()} Broker
                  </span>
                </div>

                <div className="bg-card border border-border p-6 rounded-2xl flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center">
                    <CheckCircle2 size={20} />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed Payouts</span>
                  <h3 className="text-2xl font-bold text-green-500">
                    KSh {Math.round(totalPaidSupplier + totalPaidBroker).toLocaleString()}
                  </h3>
                  <span className="text-[10px] text-muted-foreground">Total settled supplier & referral commissions</span>
                </div>
              </div>

              {/* Action Banner */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h4 className="font-bold text-foreground text-base">Unsettled Commissions Queue</h4>
                  <p className="text-xs text-muted-foreground">You currently have {pendingCount} outstanding payout records waiting to be settled.</p>
                </div>
                <button
                  onClick={() => setActiveTab('settlements')}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  Go to settlements queue <ArrowRight size={14} />
                </button>
              </div>

              {/* Preview Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Supplier Cars */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-border flex justify-between items-center">
                    <h4 className="font-bold text-sm text-foreground">Recent Supplier Additions</h4>
                    <button onClick={() => setActiveTab('supplier_cars')} className="text-xs text-primary font-bold hover:underline">View All</button>
                  </div>
                  <div className="divide-y divide-border flex-1">
                    {cars.length === 0 ? (
                      <div className="p-10 text-center text-sm text-muted-foreground">No supplier cars registered yet.</div>
                    ) : (
                      cars.slice(0, 4).map(car => (
                        <div key={car.id} className="p-4 flex items-center gap-3">
                          <div className="w-12 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            {car.primary_image_url ? (
                              <img src={car.primary_image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted"><CarIcon size={16} /></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{car.make} {car.model}</p>
                            <p className="text-[10px] text-muted-foreground">Owner: {car.outsource_owner_name || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-primary">KSh {car.daily_rate.toLocaleString()}/day</p>
                            <p className="text-[9px] text-muted-foreground">{car.outsource_commission_rate || 15}% comm.</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Broker Additions */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-border flex justify-between items-center">
                    <h4 className="font-bold text-sm text-foreground">Active Broker Agents</h4>
                    <button onClick={() => setActiveTab('brokers')} className="text-xs text-primary font-bold hover:underline">View All</button>
                  </div>
                  <div className="divide-y divide-border flex-1">
                    {brokers.length === 0 ? (
                      <div className="p-10 text-center text-sm text-muted-foreground">No brokers registered yet.</div>
                    ) : (
                      brokers.slice(0, 4).map(b => {
                        const brokerReferrals = settlements.filter(s => s.type === 'broker' && s.target_id === b.id);
                        const brokerEarnings = brokerReferrals.reduce((sum, s) => sum + Number(s.amount), 0);
                        return (
                          <div key={b.id} className="p-4 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-foreground">{b.name}</p>
                              <p className="text-[10px] text-muted-foreground">{b.email || b.phone || 'No contact'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-foreground">KSh {brokerEarnings.toLocaleString()}</p>
                              <p className="text-[9px] text-muted-foreground">{brokerReferrals.length} Referral(s)</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUPPLIER CARS TAB */}
          {activeTab === 'supplier_cars' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by vehicle name, plate number, or owner name..."
                  className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-all"
                />
              </div>

              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vehicle</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Owner / Contact</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Daily Rate</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Commission</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredCars.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center">
                            <p className="text-sm text-muted-foreground mb-4">
                              {searchQuery ? 'No supplier cars found matching criteria.' : 'No supplier cars registered yet.'}
                            </p>
                            {!searchQuery && (
                              <button
                                type="button"
                                onClick={openAddSupplierModal}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold"
                              >
                                <Plus size={14} /> Add your first supplier car
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredCars.map(car => (
                          <tr key={car.id} className="hover:bg-muted/15 transition-all">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                  {car.primary_image_url ? (
                                    <img src={car.primary_image_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted"><CarIcon size={16} /></div>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-foreground">{car.make} {car.model}</p>
                                  <p className="text-[10px] text-muted-foreground">{car.license_plate} · {car.year}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-sm font-semibold text-foreground">{car.outsource_owner_name || 'N/A'}</p>
                              <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                                {car.outsource_owner_phone && <span>{car.outsource_owner_phone}</span>}
                                {car.outsource_owner_email && <span>· {car.outsource_owner_email}</span>}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-sm font-bold text-foreground">KSh {car.daily_rate.toLocaleString()}</span>
                            </td>
                            <td className="px-5 py-4">
                              <span className="text-sm text-foreground">{car.outsource_commission_rate || 15}%</span>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                car.status === 'available'
                                  ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                  : 'bg-red-500/10 text-red-500 border-red-500/20'
                              }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${car.status === 'available' ? 'bg-green-500' : 'bg-red-500'}`} />
                                {car.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => openEditSupplier(car)}
                                className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-lg text-muted-foreground transition-all"
                                title="Edit Supplier details"
                              >
                                <Edit size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* BROKERS REGISTRY TAB */}
          {activeTab === 'brokers' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by broker name, phone number, or email..."
                  className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-all"
                />
              </div>

              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Broker Agent</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Default Rate</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Total Owed</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Total Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredBrokers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                            No registered brokers found. Click "Register Broker" to create one.
                          </td>
                        </tr>
                      ) : (
                        filteredBrokers.map(b => {
                          const brokerReferrals = settlements.filter(s => s.type === 'broker' && s.target_id === b.id);
                          const owed = brokerReferrals.filter(s => s.status === 'pending').reduce((sum, s) => sum + Number(s.amount), 0);
                          const paid = brokerReferrals.filter(s => s.status === 'paid').reduce((sum, s) => sum + Number(s.amount), 0);

                          return (
                            <tr key={b.id} className="hover:bg-muted/15 transition-all">
                              <td className="px-5 py-4 font-bold text-sm text-foreground">{b.name}</td>
                              <td className="px-5 py-4 text-sm text-muted-foreground">{b.email || '—'}</td>
                              <td className="px-5 py-4 text-sm text-muted-foreground">{b.phone || '—'}</td>
                              <td className="px-5 py-4 text-sm text-foreground">{b.default_commission_rate}%</td>
                              <td className="px-5 py-4 text-sm text-right font-bold text-amber-500">KSh {owed.toLocaleString()}</td>
                              <td className="px-5 py-4 text-sm text-right font-bold text-green-500">KSh {paid.toLocaleString()}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SETTLEMENTS TAB */}
          {activeTab === 'settlements' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by booking reference, transaction type or status..."
                  className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-all"
                />
              </div>

              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Booking Ref</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recipient Name</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Amount Owed</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date Generated</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredSettlements.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                            No settlements found in queue.
                          </td>
                        </tr>
                      ) : (
                        filteredSettlements.map(s => {
                          // Get recipient name
                          let recipientName = 'Unknown';
                          if (s.type === 'broker') {
                            recipientName = brokers.find(b => b.id === s.target_id)?.name || 'Agent';
                          } else {
                            // Find car and get owner name
                            recipientName = s.booking?.cars?.outsource_owner_name || 'Car Owner';
                          }

                          return (
                            <tr key={s.id} className="hover:bg-muted/15 transition-all">
                              <td className="px-5 py-4">
                                <span className="font-mono text-xs font-bold text-foreground">
                                  {s.booking?.booking_reference || 'N/A'}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  s.type === 'broker' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                                }`}>
                                  {s.type}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-sm font-semibold text-foreground">{recipientName}</td>
                              <td className="px-5 py-4">
                                <span className="text-sm font-bold text-foreground">KSh {s.amount.toLocaleString()}</span>
                              </td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  s.status === 'paid'
                                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                }`}>
                                  {s.status === 'paid' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                                  {s.status}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-xs text-muted-foreground">
                                {new Date(s.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-5 py-4 text-right">
                                {s.status === 'pending' ? (
                                  <button
                                    onClick={() => setShowSettleModal(s)}
                                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-xs font-bold transition-all border border-primary/20"
                                  >
                                    Settle Payment
                                  </button>
                                ) : (
                                  <div className="text-right">
                                    <span className="text-[10px] font-mono text-muted-foreground block truncate max-w-[120px]" title={s.payment_reference || ''}>
                                      Ref: {s.payment_reference}
                                    </span>
                                    {s.settled_at && (
                                      <span className="text-[9px] text-muted-foreground block">
                                        {new Date(s.settled_at).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* FINANCIAL LEDGER ANALYTICS */}
          {activeTab === 'financials' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                <p className="text-sm text-muted-foreground">
                  For separated outsourced vs fleet vs broker breakdown and booking-level reconciliation, use Financials → Partner Ledger.
                </p>
                <a
                  href="/admin/financials?tab=partner-ledger"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shrink-0"
                >
                  Open Partner Ledger <ArrowRight size={14} />
                </a>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                
                {/* Owed Breakdown pie chart */}
                <div className="bg-card border border-border p-6 rounded-2xl flex flex-col">
                  <h4 className="font-bold text-base text-foreground mb-1">Payout Share Breakdown</h4>
                  <p className="text-xs text-muted-foreground mb-4">Total distributed funds in KSh</p>
                  
                  {pieData.length > 0 ? (
                    <div className="flex-1 min-h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {pieData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                      No payouts recorded yet
                    </div>
                  )}
                </div>

                {/* Recipient breakdown chart */}
                <div className="lg:col-span-2 bg-card border border-border p-6 rounded-2xl flex flex-col">
                  <h4 className="font-bold text-base text-foreground mb-1">Top Broker Commissions Paid</h4>
                  <p className="text-xs text-muted-foreground mb-4">Brokers with highest settled earnings</p>

                  <div className="flex-1 min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={brokers.map(b => {
                          const settledBrokerReferrals = settlements.filter(s => s.type === 'broker' && s.target_id === b.id && s.status === 'paid');
                          const settledAmount = settledBrokerReferrals.reduce((sum, s) => sum + Number(s.amount), 0);
                          return { name: b.name, amount: settledAmount };
                        }).filter(d => d.amount > 0).sort((a,b) => b.amount - a.amount).slice(0, 5)}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <ChartTooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            borderRadius: '12px',
                          }}
                        />
                        <Bar dataKey="amount" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>
          )}
        </>
      )}

      {/* ADD SUPPLIER CAR MODAL */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl border border-border p-8 max-w-lg w-full shadow-2xl relative my-8">
            <button
              type="button"
              onClick={() => setShowAddSupplierModal(false)}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-lg"
            >
              <X size={16} />
            </button>

            <h3 className="text-xl font-bold mb-1">Add Supplier Car</h3>
            <p className="text-xs text-muted-foreground mb-6">
              Register a partner-owned vehicle for the outsourced fleet. It will be bookable without a platform fleet owner.
            </p>

            <form onSubmit={handleAddSupplierCar} className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vehicle</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Make</label>
                    <input
                      type="text"
                      required
                      value={carMake}
                      onChange={(e) => setCarMake(e.target.value)}
                      placeholder="e.g. Toyota"
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Model</label>
                    <input
                      type="text"
                      required
                      value={carModel}
                      onChange={(e) => setCarModel(e.target.value)}
                      placeholder="e.g. Axio"
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Year</label>
                    <input
                      type="number"
                      required
                      min={1990}
                      max={new Date().getFullYear() + 1}
                      value={carYear}
                      onChange={(e) => setCarYear(e.target.value)}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">License Plate</label>
                    <input
                      type="text"
                      required
                      value={carPlate}
                      onChange={(e) => setCarPlate(e.target.value)}
                      placeholder="e.g. KDA 123A"
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Color</label>
                    <input
                      type="text"
                      value={carColor}
                      onChange={(e) => setCarColor(e.target.value)}
                      placeholder="e.g. White"
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Category</label>
                    <select
                      value={carCategory}
                      onChange={(e) => setCarCategory(e.target.value)}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                    >
                      <option value="Sedan">Sedan</option>
                      <option value="SUV">SUV</option>
                      <option value="Van">Van</option>
                      <option value="Pickup">Pickup</option>
                      <option value="Luxury">Luxury</option>
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Daily Rate (KSh)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={carDailyRate}
                      onChange={(e) => setCarDailyRate(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Photo (optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCarImageFile(e.target.files?.[0] || null)}
                      className="w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Supplier / Owner</h4>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Owner Name</label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Samuel Gachiri"
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Phone</label>
                    <input
                      type="text"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="+254 7..."
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Email</label>
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="owner@email.com"
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Platform Commission (%)</label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Supplier receives daily rate minus this commission on completed bookings.</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={addingSupplierCar}
                className="w-full py-3 bg-primary hover:bg-primary/95 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {addingSupplierCar ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Register Supplier Car'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER BROKER MODAL */}
      {showBrokerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowBrokerModal(false)}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-lg"
            >
              <X size={16} />
            </button>
            
            <h3 className="text-xl font-bold mb-1">Register Referral Broker</h3>
            <p className="text-xs text-muted-foreground mb-6">Create broker profiles to allocate commissions during concierge bookings.</p>

            <form onSubmit={handleAddBroker} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Broker Name</label>
                <input
                  type="text"
                  required
                  value={brokerName}
                  onChange={(e) => setBrokerName(e.target.value)}
                  placeholder="e.g. John KRA Referrals"
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Phone Number</label>
                <input
                  type="text"
                  value={brokerPhone}
                  onChange={(e) => setBrokerPhone(e.target.value)}
                  placeholder="e.g. +254 712 345678"
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Email Address</label>
                <input
                  type="email"
                  value={brokerEmail}
                  onChange={(e) => setBrokerEmail(e.target.value)}
                  placeholder="e.g. john@broker.com"
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Default Commission Rate (%)</label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                  <input
                    type="number"
                    value={brokerRate}
                    onChange={(e) => setBrokerRate(e.target.value)}
                    placeholder="10"
                    className="w-full pl-9 pr-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingBroker}
                className="w-full py-3 bg-primary hover:bg-primary/95 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {submittingBroker ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Broker'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUPPLIER DETAILS MODAL */}
      {showSupplierEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowSupplierEditModal(null)}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-lg"
            >
              <X size={16} />
            </button>
            
            <h3 className="text-xl font-bold mb-1">Edit Supplier / Car Owner</h3>
            <p className="text-xs text-muted-foreground mb-6">
              Update billing details for the owner of {showSupplierEditModal.make} {showSupplierEditModal.model} ({showSupplierEditModal.license_plate}).
            </p>

            <form onSubmit={handleUpdateSupplier} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Owner Name</label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Samuel Gachiri"
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Phone Number</label>
                <input
                  type="text"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="e.g. +254 711 222333"
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Email Address</label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="e.g. samuel@gmail.com"
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Supplier Commission Rate (%)</label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                  <input
                    type="number"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    placeholder="15"
                    className="w-full pl-9 pr-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={updatingSupplier}
                className="w-full py-3 bg-primary hover:bg-primary/95 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {updatingSupplier ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Supplier'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SETTLE PAYOUT MODAL */}
      {showSettleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border p-8 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowSettleModal(null)}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-lg"
            >
              <X size={16} />
            </button>
            
            <h3 className="text-xl font-bold mb-1">Confirm Commission Settlement</h3>
            <p className="text-xs text-muted-foreground mb-6">
              Mark this payout of KSh {showSettleModal.amount.toLocaleString()} as settled.
            </p>

            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-xl border border-border text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Type:</span>
                  <span className="font-bold text-foreground capitalize">{showSettleModal.type} Payout</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference Booking:</span>
                  <span className="font-mono text-foreground font-bold">
                    {showSettleModal.booking?.booking_reference || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Payment Reference / Code</label>
                <input
                  type="text"
                  required
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. M-Pesa Code (QRT18H93K) or Bank Ref"
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <button
                onClick={handleSettlePayout}
                disabled={settling}
                className="w-full py-3 bg-primary hover:bg-primary/95 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {settling ? <><Loader2 size={16} className="animate-spin" /> Settling...</> : 'Mark as Settled'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}