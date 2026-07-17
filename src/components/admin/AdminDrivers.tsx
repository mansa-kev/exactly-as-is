import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { 
  Search, 
  UserCheck, 
  UserX, 
  ShieldCheck, 
  AlertCircle, 
  Eye, 
  MoreHorizontal,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

// --- Types ---

type DriverStatus = 'active' | 'suspended' | 'pending_verification';
type VerificationStatus = 'verified' | 'pending' | 'rejected' | 'not_submitted';

interface DriverItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: DriverStatus;
  licenseStatus: VerificationStatus;
  idStatus: VerificationStatus;
  joinedDate: string;
  rating: number;
  totalTrips: number;
}

// --- Components ---

const StatusBadge = ({ status }: { status: DriverStatus }) => {
  const styles = {
    active: 'bg-success/10 text-success border-success/20',
    suspended: 'bg-error/10 text-error border-error/20',
    pending_verification: 'bg-warning/10 text-warning border-warning/20',
  };

  const labels = {
    active: 'Active',
    suspended: 'Suspended',
    pending_verification: 'Pending Verification',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

const VerificationIcon = ({ status }: { status: VerificationStatus }) => {
  const icons = {
    verified: <CheckCircle2 size={14} className="text-success" />,
    pending: <Clock size={14} className="text-warning" />,
    rejected: <XCircle size={14} className="text-error" />,
    not_submitted: <AlertCircle size={14} className="text-muted-foreground" />,
  };

  return (
    <div className="flex items-center gap-1.5">
      {icons[status]}
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {status.replace('_', ' ')}
      </span>
    </div>
  );
};

export function AdminDrivers() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DriverStatus | 'all'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  
  // Mobile expandable row state
  const [isMobile, setIsMobile] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const data = await adminService.getDrivers();
      setDrivers(data || []);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  // Mobile detection with resize listener
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleUpdateStatus = async (id: string, status: DriverStatus) => {
    const action = status === 'suspended' ? 'suspend' : 'activate';
    const promise = (async () => {
      await adminService.updateDriverStatus(id, status);
      fetchDrivers();
    })();

    toast.promise(promise, {
      loading: `${action === 'suspend' ? 'Suspending' : 'Activating'} driver...`,
      success: `Driver ${action === 'suspend' ? 'suspended' : 'activated'} successfully`,
      error: `Failed to ${action} driver`
    });
  };

  const filteredDrivers = drivers.map(d => {
    const driverBookings = d.bookings || [];
    const chauffeurTripsCount = driverBookings.filter((b: any) => b.needs_chauffeur).length;
    const deliveriesCount = driverBookings.filter((b: any) => !b.needs_chauffeur).length;
    return {
      id: d.id,
      name: d.full_name || 'No Name',
      email: d.email || 'No Email',
      phone: d.phone_number || 'No Phone',
      status: d.driver_profiles?.status || 'pending_verification',
      licenseStatus: d.driver_profiles?.license_status || 'pending',
      idStatus: d.driver_profiles?.id_status || 'pending',
      joinedDate: new Date(d.created_at).toLocaleDateString(),
      rating: d.driver_profiles?.rating || 0,
      totalTrips: driverBookings.length,
      chauffeurTripsCount,
      deliveriesCount,
      bookings: driverBookings
    };
  }).filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          d.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading && drivers.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <div className="animate-spin text-primary">
          <Clock size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Search drivers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-sm w-full md:w-80 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-card border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <button 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all"
          onClick={() => setIsAddModalOpen(true)}
        >
          Add New Driver
        </button>
      </div>

      {/* Table - Desktop View */}
      {!isMobile && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Driver</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Verification</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Rating / Trips</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Joined Date</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all">
                          <UserCheck size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground leading-none">{driver.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{driver.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <VerificationIcon status={driver.licenseStatus} />
                        <VerificationIcon status={driver.idStatus} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={driver.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-foreground">{(Number(driver.rating) || 0).toFixed(1)}</span>
                          <span className="text-xs text-warning">★</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-bold">{driver.totalTrips} Total Trips</span>
                        <span className="text-[10px] text-muted-foreground/80 font-medium">({driver.chauffeurTripsCount} Chauf / {driver.deliveriesCount} Del)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground font-medium">{driver.joinedDate}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setSelectedDriver(driver)}
                          className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors" title="View Profile">
                          <Eye size={18} />
                        </button>
                        <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors" title="View Documents">
                          <FileText size={18} />
                        </button>
                        {driver.status === 'active' ? (
                          <button 
                            onClick={() => handleUpdateStatus(driver.id, 'suspended')}
                            className="p-2 hover:bg-error/10 rounded-lg text-muted-foreground hover:text-error transition-colors" 
                            title="Suspend Driver"
                          >
                            <UserX size={18} />
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleUpdateStatus(driver.id, 'active')}
                            className="p-2 hover:bg-success/10 rounded-lg text-muted-foreground hover:text-success transition-colors" 
                            title="Activate Driver"
                          >
                            <UserCheck size={18} />
                          </button>
                        )}
                        <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredDrivers.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">No drivers found matching your criteria.</p>
            </div>
          )}

          <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/10">
            <span className="text-xs text-muted-foreground font-medium">Showing {filteredDrivers.length} of {drivers.length} entries</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 border border-border rounded-md text-xs font-bold disabled:opacity-50" disabled>Previous</button>
              <button className="px-3 py-1 border border-border rounded-md text-xs font-bold disabled:opacity-50" disabled>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Expandable Rows */}
      {isMobile && (
        <div className="space-y-2">
          {filteredDrivers.map((driver) => (
            <div key={driver.id}>
              {/* Summary Row */}
              <div 
                className="flex justify-between items-center px-4 py-3 bg-card border border-border rounded-xl cursor-pointer select-none hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedRowId(expandedRowId === driver.id ? null : driver.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{driver.name}</p>
                    <p className="text-xs text-muted-foreground">{driver.email}</p>
                  </div>
                </div>
                <ChevronDown 
                  size={16} 
                  className={`transition-transform duration-200 ${expandedRowId === driver.id ? 'rotate-180' : ''}`}
                />
              </div>

              {/* Expanded Card */}
              {expandedRowId === driver.id && (
                <div className="bg-card border border-border rounded-xl p-4 mb-3 max-h-[65vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Driver ID</span>
                      <p className="text-sm text-white font-medium break-all">{driver.id}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Name</span>
                      <p className="text-sm text-white font-medium">{driver.name}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Email</span>
                      <p className="text-sm text-white font-medium break-all">{driver.email}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Phone</span>
                      <p className="text-sm text-white font-medium">{driver.phone}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">License Status</span>
                      <div className="mt-1">
                        <VerificationIcon status={driver.licenseStatus} />
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">ID Status</span>
                      <div className="mt-1">
                        <VerificationIcon status={driver.idStatus} />
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Status</span>
                      <div className="mt-1">
                        <StatusBadge status={driver.status} />
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Rating</span>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-sm text-white font-medium">{driver.rating}</span>
                        <span className="text-xs text-warning">â</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Total Trips</span>
                      <p className="text-sm text-white font-medium">{driver.totalTrips}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Joined Date</span>
                      <p className="text-sm text-white font-medium">{driver.joinedDate}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
                    <button 
                      onClick={() => setSelectedDriver(driver)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Eye size={12} />
                      View Profile
                    </button>
                    <button className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors flex items-center gap-2">
                      <FileText size={12} />
                      Documents
                    </button>
                    {driver.status === 'active' ? (
                      <button 
                        onClick={() => handleUpdateStatus(driver.id, 'suspended')}
                        className="px-3 py-1.5 bg-error text-white rounded-lg text-xs font-bold hover:bg-error/90 transition-colors flex items-center gap-2"
                      >
                        <UserX size={12} />
                        Suspend
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleUpdateStatus(driver.id, 'active')}
                        className="px-3 py-1.5 bg-success text-white rounded-lg text-xs font-bold hover:bg-success/90 transition-colors flex items-center gap-2"
                      >
                        <UserCheck size={12} />
                        Activate
                      </button>
                    )}
                    <button className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors">
                      <MoreHorizontal size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {filteredDrivers.length === 0 && (
            <div className="p-12 text-center bg-card border border-border rounded-xl">
              <p className="text-muted-foreground">No drivers found matching your criteria.</p>
            </div>
          )}

          <div className="px-4 py-3 bg-card border border-border rounded-xl flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Showing {filteredDrivers.length} of {drivers.length} entries</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 border border-border rounded-md text-xs font-bold disabled:opacity-50" disabled>Previous</button>
              <button className="px-3 py-1 border border-border rounded-md text-xs font-bold disabled:opacity-50" disabled>Next</button>
            </div>
          </div>
        </div>
      )}
      {/* Add Driver Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4">Add New Driver</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const driver = {
                full_name: formData.get('full_name'),
                email: formData.get('email'),
                phone_number: formData.get('phone_number'),
                license_number: formData.get('license_number'),
              };
              try {
                const promise = adminService.addDriver(driver);
                toast.promise(promise, {
                  loading: 'Adding driver...',
                  success: 'Driver added successfully',
                  error: (err: any) => err.message || 'Failed to add driver'
                });
                await promise;
                setIsAddModalOpen(false);
                fetchDrivers();
              } catch (error) {
                // Error handled by toast.promise
              }
            }} className="space-y-4">
              <input name="full_name" placeholder="Full Name" className="w-full p-2 border border-border rounded-lg" required />
              <input name="email" type="email" placeholder="Email" className="w-full p-2 border border-border rounded-lg" required />
              <input name="phone_number" placeholder="Phone Number" className="w-full p-2 border border-border rounded-lg" required />
              <input name="license_number" placeholder="License Number" className="w-full p-2 border border-border rounded-lg" required />
              <div className="flex gap-2 mt-6">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-2 bg-muted rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl font-bold">Add Driver</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Driver Profile Modal */}
      {selectedDriver && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-card rounded-3xl border border-border shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-border bg-muted/20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-black text-lg text-foreground">{selectedDriver.name}</h3>
                  <StatusBadge status={selectedDriver.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1 uppercase font-bold tracking-wider text-primary">Driver Account Details & Tasks Log</p>
              </div>
              <button 
                onClick={() => setSelectedDriver(null)} 
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors font-bold"
              >
                Close
              </button>
            </div>
            
            {/* Modal Scroll Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal & Verification */}
                <div className="space-y-4 bg-muted/10 p-4 rounded-2xl border border-border">
                  <h4 className="font-black text-xs text-muted-foreground uppercase tracking-widest pb-2 border-b border-border/50">Driver Information</h4>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground flex justify-between"><span className="font-bold">Email:</span> <span className="text-foreground break-all">{selectedDriver.email}</span></p>
                    <p className="text-muted-foreground flex justify-between"><span className="font-bold">Phone:</span> <span className="text-foreground">{selectedDriver.phone}</span></p>
                    <p className="text-muted-foreground flex justify-between"><span className="font-bold">Joined:</span> <span className="text-foreground">{selectedDriver.joinedDate}</span></p>
                    <div className="pt-2 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                        <span>Licence Verification:</span>
                        <VerificationIcon status={selectedDriver.licenseStatus} />
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                        <span>National ID Verification:</span>
                        <VerificationIcon status={selectedDriver.idStatus} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ledger & Stats */}
                <div className="space-y-4 bg-muted/10 p-4 rounded-2xl border border-border flex flex-col justify-between">
                  <div>
                    <h4 className="font-black text-xs text-muted-foreground uppercase tracking-widest pb-2 border-b border-border/50">Performance Ledger</h4>
                    <div className="space-y-2 text-sm mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-muted-foreground">Customer Rating:</span>
                        <span className="flex items-center gap-1 font-black text-foreground">
                          {Number(selectedDriver.rating || 0).toFixed(1)} <span className="text-warning text-xs">★</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-muted-foreground">Total Managed Tasks:</span>
                        <span className="font-black text-foreground">{selectedDriver.totalTrips}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3">
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-black uppercase text-purple-400 tracking-wider">Chauffeur Jobs</p>
                      <p className="text-xl font-black text-purple-400 mt-1">{selectedDriver.chauffeurTripsCount}</p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Deliveries</p>
                      <p className="text-xl font-black text-blue-400 mt-1">{selectedDriver.deliveriesCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Task History List */}
              <div className="space-y-3">
                <h4 className="font-black text-xs text-muted-foreground uppercase tracking-widest">Job History Ledger</h4>
                {selectedDriver.bookings.length === 0 ? (
                  <div className="text-center py-8 bg-muted/20 border border-border border-dashed rounded-2xl">
                    <p className="text-xs text-muted-foreground font-medium">No tasks logged in this driver's history ledger.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {selectedDriver.bookings.map((booking: any) => {
                      const start = new Date(booking.start_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
                      const end = new Date(booking.end_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: '2-digit' });
                      return (
                        <div key={booking.id} className="p-3 bg-muted/5 border border-border rounded-xl flex items-center justify-between text-xs hover:bg-muted/10 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{booking.cars?.make} {booking.cars?.model}</span>
                              <span className="font-mono text-[10px] text-muted-foreground font-medium">({booking.cars?.license_plate})</span>
                            </div>
                            <p className="text-muted-foreground font-medium">{start} - {end}</p>
                          </div>
                          
                          <div className="text-right space-y-1">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                booking.needs_chauffeur 
                                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' 
                                  : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                              }`}>
                                {booking.needs_chauffeur ? 'Chauffeur' : 'Delivery'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                booking.status === 'completed'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                  : booking.status === 'on_trip'
                                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                              }`}>
                                {booking.status}
                              </span>
                            </div>
                            {booking.total_amount && (
                              <p className="font-bold text-foreground">KES {Number(booking.total_amount).toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border bg-muted/15 flex justify-end">
              <button 
                onClick={() => setSelectedDriver(null)} 
                className="px-5 py-2.5 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-black text-xs uppercase tracking-wider rounded-xl transition-colors"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
