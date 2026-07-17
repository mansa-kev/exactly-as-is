// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Wrench, AlertTriangle, CheckCircle, Edit, MapPin, DollarSign, Activity } from 'lucide-react';
import { fleetService } from '../../services/fleetService';
import { AddMaintenanceModal } from './AddMaintenanceModal';
import { AddDamageReportModal } from './AddDamageReportModal';

interface CarDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  carId: string | null;
  onEdit: (car: any) => void;
  onStatusChange: (carId: string, status: string) => void;
  initialTab?: string;
}

export function CarDetailModal({ isOpen, onClose, carId, onEdit, onStatusChange, initialTab = 'specs' }: CarDetailModalProps) {
  const [carDetails, setCarDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isAddMaintenanceModalOpen, setIsAddMaintenanceModalOpen] = useState(false);
  const [isAddDamageModalOpen, setIsAddDamageModalOpen] = useState(false);

  const fetchCarDetails = () => {
    if (carId) {
      setLoading(true);
      fleetService.getCarDetails(carId).then(data => {
        setCarDetails(data);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      fetchCarDetails();
    }
  }, [isOpen, carId, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-5xl rounded-2xl shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        {loading ? (
          <div className="p-12 text-center animate-pulse">Loading car details...</div>
        ) : !carDetails ? (
          <div className="p-12 text-center text-error">Failed to load car details.</div>
        ) : (
          <>
            <div className="p-6 border-b border-border flex justify-between items-start sticky top-0 bg-card z-10">
              <div className="flex gap-6 items-center">
                <div className="w-24 h-24 rounded-xl overflow-hidden border border-border bg-muted">
                  {carDetails.primary_image_url ? (
                    <img src={carDetails.primary_image_url} alt={carDetails.make} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">No Image</div>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{carDetails.make} {carDetails.model} ({carDetails.year})</h2>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="px-3 py-1 bg-muted rounded-lg text-sm font-bold uppercase tracking-wider">{carDetails.license_plate}</span>
                    <span className={`px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider ${
                      carDetails.status === 'available' ? 'bg-success/10 text-success' :
                      carDetails.status === 'booked' ? 'bg-primary/10 text-primary' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {carDetails.status}
                    </span>
                    {!carDetails.is_approved && (
                      <span className="px-3 py-1 bg-error/10 text-error rounded-lg text-sm font-bold uppercase tracking-wider">Pending Approval</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { onClose(); onEdit(carDetails); }} className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground">
                  <Edit size={20} />
                </button>
                <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex border-b border-border bg-muted/30 px-6">
              {[
                { id: 'specs', label: 'Specifications', icon: Activity },
                { id: 'pricing', label: 'Pricing', icon: DollarSign },
                { id: 'calendar', label: 'Availability', icon: CalendarIcon },
                { id: 'maintenance', label: 'Maintenance', icon: Wrench },
                { id: 'damage', label: 'Damage Reports', icon: AlertTriangle },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
                    activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon size={16} /> {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {activeTab === 'specs' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Make</p>
                      <p className="font-bold text-lg">{carDetails.make}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Model</p>
                      <p className="font-bold text-lg">{carDetails.model}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Year</p>
                      <p className="font-bold text-lg">{carDetails.year}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Color</p>
                      <p className="font-bold text-lg">{carDetails.color || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Transmission</p>
                      <p className="font-bold text-lg capitalize">{carDetails.transmission}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Fuel Type</p>
                      <p className="font-bold text-lg capitalize">{carDetails.fuel_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Category</p>
                      <p className="font-bold text-lg capitalize">{carDetails.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Seats</p>
                      <p className="font-bold text-lg">{carDetails.seats || '5'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">Description</p>
                    <p className="text-sm leading-relaxed">{carDetails.description || 'No description provided.'}</p>
                  </div>
                </div>
              )}

              {activeTab === 'pricing' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-muted/30 p-6 rounded-2xl border border-border">
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Daily Rate</p>
                    <p className="text-3xl font-bold mt-2">Ksh {carDetails.daily_rate?.toLocaleString()}</p>
                  </div>
                  <div className="bg-muted/30 p-6 rounded-2xl border border-border">
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Overtime Rate (Hourly)</p>
                    <p className="text-3xl font-bold mt-2">Ksh {carDetails.overtime_rate?.toLocaleString() || 0}</p>
                  </div>
                  <div className="bg-muted/30 p-6 rounded-2xl border border-border">
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Security Deposit</p>
                    <p className="text-3xl font-bold mt-2">Ksh {carDetails.security_deposit?.toLocaleString() || 0}</p>
                  </div>
                </div>
              )}

              {activeTab === 'calendar' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold">Upcoming Bookings</h3>
                  {carDetails.bookings && carDetails.bookings.length > 0 ? (
                    <div className="space-y-4">
                      {carDetails.bookings.filter((b: any) => new Date(b.end_date) >= new Date()).map((booking: any) => (
                        <div key={booking.id} className="flex justify-between items-center p-4 border border-border rounded-xl bg-muted/10">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 text-primary rounded-xl">
                              <CalendarIcon size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-sm">Booking #{booking.id.substring(0, 8)}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                            booking.status === 'confirmed' ? 'bg-success/10 text-success' :
                            booking.status === 'pending' ? 'bg-warning/10 text-warning' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No upcoming bookings for this car.</p>
                  )}
                </div>
              )}

              {activeTab === 'maintenance' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">Maintenance History</h3>
                    <button 
                      onClick={() => setIsAddMaintenanceModalOpen(true)}
                      className="px-4 py-2 bg-primary/10 text-primary rounded-xl font-bold text-sm hover:bg-primary/20 transition-colors"
                    >
                      + Add Record
                    </button>
                  </div>
                  {carDetails.maintenance && carDetails.maintenance.length > 0 ? (
                    <div className="space-y-4">
                      {carDetails.maintenance.map((log: any) => (
                        <div key={log.id} className="p-4 border border-border rounded-xl bg-muted/10">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-bold text-sm">{new Date(log.date).toLocaleDateString()}</p>
                            <p className="font-bold text-sm text-primary">Ksh {log.cost?.toLocaleString()}</p>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{log.description}</p>
                          {log.next_due_date && (
                            <div className="flex items-center text-xs font-medium text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded-md">
                              <CalendarIcon className="w-3 h-3 mr-1" />
                              Next Due: {new Date(log.next_due_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No maintenance records found.</p>
                  )}
                </div>
              )}

              {activeTab === 'damage' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">Damage Reports</h3>
                    <button 
                      onClick={() => setIsAddDamageModalOpen(true)}
                      className="px-4 py-2 bg-error/10 text-error rounded-xl font-bold text-sm hover:bg-error/20 transition-colors"
                    >
                      + Report Damage
                    </button>
                  </div>
                  {carDetails.damageReports && carDetails.damageReports.length > 0 ? (
                    <div className="space-y-4">
                      {carDetails.damageReports.map((report: any) => (
                        <div key={report.id} className="p-4 border border-border rounded-xl bg-muted/10">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-bold text-sm">{new Date(report.created_at).toLocaleDateString()}</p>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                              report.status === 'resolved' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                            }`}>
                              {report.status}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{report.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No damage reports found.</p>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border bg-muted/30 flex justify-end gap-4 sticky bottom-0">
              {carDetails.status !== 'maintenance' && (
                <button 
                  onClick={() => onStatusChange(carDetails.id, 'maintenance')}
                  className="px-6 py-2 bg-warning/10 text-warning rounded-xl font-bold flex items-center gap-2 hover:bg-warning/20 transition-colors"
                >
                  <Wrench size={16} /> Mark in Maintenance
                </button>
              )}
              {carDetails.status !== 'available' && (
                <button 
                  onClick={() => onStatusChange(carDetails.id, 'available')}
                  className="px-6 py-2 bg-success/10 text-success rounded-xl font-bold flex items-center gap-2 hover:bg-success/20 transition-colors"
                >
                  <CheckCircle size={16} /> Mark Available
                </button>
              )}
            </div>
          </>
        )}
      </div>
      
      <AddMaintenanceModal 
        isOpen={isAddMaintenanceModalOpen} 
        onClose={() => setIsAddMaintenanceModalOpen(false)} 
        onSuccess={fetchCarDetails} 
        initialCarId={carId}
      />
      
      <AddDamageReportModal 
        isOpen={isAddDamageModalOpen} 
        onClose={() => setIsAddDamageModalOpen(false)} 
        onSuccess={fetchCarDetails} 
        initialCarId={carId}
      />
    </div>
  );
}