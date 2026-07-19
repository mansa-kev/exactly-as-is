// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { 
  AlertTriangle, 
  Search, 
  Clock, 
  CheckCircle2, 
  Loader2,
  Phone,
  MessageSquare,
  ShieldAlert,
  MapPin,
  Activity,
  Server,
  Database,
  Wifi,
  Car,
  User,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminExtensionRequestsQueue } from './AdminExtensionRequestsQueue';


export function AdminIncidentCommand() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incidentsData, bookingsResult, healthData] = await Promise.all([
        adminService.getIncidents(),
        adminService.getBookings(),
        adminService.getSystemHealth()
      ]);
      setIncidents(incidentsData || []);
      
      let bookings = [];
      if (bookingsResult && 'data' in bookingsResult) {
        bookings = bookingsResult.data || [];
      } else if (Array.isArray(bookingsResult)) {
        bookings = bookingsResult;
      }
      
      setActiveBookings(bookings.filter((b: any) => b.status === 'confirmed' || b.status === 'in_progress'));
      setSystemHealth(healthData);
    } catch (error) {
      console.error('Failed to fetch incident command data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    const promise = (async () => {
      await adminService.updateIncidentStatus(id, status);
      fetchData();
      if (selectedIncident && selectedIncident.id === id) {
        setSelectedIncident({ ...selectedIncident, status });
      }
    })();

    toast.promise(promise, {
      loading: `Updating incident status to ${status}...`,
      success: `Incident status updated to ${status} successfully`,
      error: 'Failed to update status'
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredIncidents = incidents.filter(i => {
    const carName = i.car?.make ? `${i.car.make} ${i.car.model}` : 'Unknown Car';
    const userName = i.user?.full_name || 'Unknown User';
    return i.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
           carName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           userName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading && incidents.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Incident Command</h2>
          <p className="text-muted-foreground">Real-time monitoring and conflict resolution center.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-xl font-bold border border-error/20">
          <ShieldAlert size={20} />
          {incidents.filter(i => i.status === 'open').length} Active Incidents
        </div>
      </div>

      {/* Top Row: Map & Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Booking Map (Placeholder) */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2"><MapPin size={18} className="text-primary" /> Live Booking Map</h3>
            <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-lg">{activeBookings.length} Active</span>
          </div>
          <div className="flex-1 bg-muted/10 relative min-h-[300px] flex items-center justify-center">
            {/* Mock Map Background */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ccc 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            <div className="text-center z-10">
              <MapPin size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium">Live GPS tracking map view</p>
              <p className="text-xs text-muted-foreground mt-1">Displays {activeBookings.length} vehicles currently on the road.</p>
            </div>
          </div>
        </div>

        {/* System Health Monitor */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="font-bold flex items-center gap-2"><Activity size={18} className="text-success" /> System Health</h3>
          </div>
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {systemHealth?.services.map((service: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${service.status === 'operational' ? 'bg-success' : 'bg-error'}`}></div>
                  <div>
                    <p className="text-sm font-bold">{service.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{service.uptime} Uptime</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-muted-foreground">{service.latency}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Bookings Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-bold flex items-center gap-2"><Car size={18} className="text-primary" /> Active Bookings</h3>
        </div>
        <div className="overflow-x-auto max-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Booking ID</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Vehicle</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Client</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Return Date</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono">{booking.id.split('-')[0]}</td>
                  <td className="px-4 py-3 text-sm font-medium">{booking.cars?.make} {booking.cars?.model}</td>
                  <td className="px-4 py-3 text-sm">{booking.client?.full_name}</td>
                  <td className="px-4 py-3 text-sm">{new Date(booking.end_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-primary hover:underline text-xs font-bold flex items-center justify-end gap-1">
                      Details <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {activeBookings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No active bookings at the moment.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conflict Resolution Center */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2"><AlertTriangle size={20} className="text-warning" /> Conflict Resolution Center</h3>
            <p className="text-xs text-muted-foreground mt-1">Manage disputes, damage claims, and extension requests.</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder="Search issues..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Incidents List */}
          <div className="lg:col-span-1 overflow-y-auto max-h-[500px]">
            {filteredIncidents.map((incident) => {
              const carName = incident.car?.make ? `${incident.car.make} ${incident.car.model}` : 'Unknown Car';
              const userName = incident.user?.full_name || 'Unknown User';
              const isSelected = selectedIncident?.id === incident.id;
              
              return (
                <div 
                  key={incident.id} 
                  onClick={() => setSelectedIncident(incident)}
                  className={`p-4 border-b border-border cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-muted/30 border-l-4 border-l-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      incident.status === 'open' ? 'bg-error/10 text-error border-error/20' : 
                      incident.status === 'in-progress' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                      'bg-success/10 text-success border-success/20'
                    }`}>
                      {incident.status}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={12}/> {new Date(incident.created_at).toLocaleDateString()}</span>
                  </div>
                  <h4 className="font-bold text-sm mb-1">{incident.type}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{incident.description || 'No description provided.'}</p>
                  <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Car size={10}/> {carName}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><User size={10}/> {userName}</span>
                  </div>
                </div>
              );
            })}
            {filteredIncidents.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">No incidents found.</div>
            )}
          </div>

          {/* Incident Details & Actions */}
          <div className="lg:col-span-2 bg-muted/5 flex flex-col min-h-[500px]">
            {selectedIncident ? (
              <>
                <div className="p-6 border-b border-border bg-card">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{selectedIncident.type}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <MapPin size={14} /> {selectedIncident.location_text || 'Location not provided'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                      selectedIncident.severity === 'high' ? 'bg-error/10 text-error border-error/20' : 
                      selectedIncident.severity === 'medium' ? 'bg-warning/10 text-warning border-warning/20' : 
                      'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    }`}>
                      {selectedIncident.severity} Severity
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 bg-muted/50 rounded-xl border border-border">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Client</span>
                      <p className="text-sm font-medium">{selectedIncident.user?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedIncident.user?.phone_number || 'No phone'}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-xl border border-border">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Vehicle</span>
                      <p className="text-sm font-medium">{selectedIncident.car?.make} {selectedIncident.car?.model}</p>
                      <p className="text-xs text-muted-foreground">{selectedIncident.car?.license_plate}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Description</span>
                    <p className="text-sm bg-muted/30 p-4 rounded-xl border border-border">{selectedIncident.description || 'No detailed description provided by the user.'}</p>
                  </div>
                </div>

                {/* Three-Way Chat Placeholder */}
                <div className="flex-1 p-6 flex flex-col justify-end">
                  <div className="text-center mb-6">
                    <MessageSquare size={32} className="mx-auto text-muted-foreground mb-2 opacity-50" />
                    <p className="text-sm font-medium text-muted-foreground">Three-Way Chat Interface</p>
                    <p className="text-xs text-muted-foreground">Admin • Client • Fleet Owner</p>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Type a message..." className="flex-1 px-4 py-2 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                    <button className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors">Send</button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="p-4 border-t border-border bg-card flex flex-wrap gap-3 justify-end">
                  {selectedIncident.status !== 'resolved' && (
                    <button 
                      onClick={() => handleUpdateStatus(selectedIncident.id, 'resolved')}
                      className="px-4 py-2 bg-success/10 text-success hover:bg-success hover:text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                    >
                      <CheckCircle2 size={16} /> Mark Resolved
                    </button>
                  )}
                  <button className="px-4 py-2 bg-muted text-foreground hover:bg-muted/80 rounded-xl text-sm font-bold transition-colors">
                    Approve Extension
                  </button>
                  <button className="px-4 py-2 bg-error/10 text-error hover:bg-error hover:text-white rounded-xl text-sm font-bold transition-colors">
                    Initiate Damage Claim
                  </button>
                  <button className="px-4 py-2 bg-warning/10 text-warning hover:bg-warning hover:text-white rounded-xl text-sm font-bold transition-colors">
                    Issue Refund
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                <AlertTriangle size={48} className="mb-4 opacity-20" />
                <p className="font-medium">Select an incident to view details and resolve conflicts.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Extension Requests Queue */}
      <AdminExtensionRequestsQueue />
    </div>
  );
}
