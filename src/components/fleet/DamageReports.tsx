import React, { useState, useEffect } from 'react';
import { fleetService } from '../../services/fleetService';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, Plus, Search, Calendar, CheckCircle, Clock } from 'lucide-react';
import { AddDamageReportModal } from './AddDamageReportModal';

export default function DamageReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const data = await fleetService.getDamageReports(user.id);
        setReports(data || []);
      }
    } catch (error) {
      console.error('Error fetching damage reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => {
    const searchString = `${report.cars?.make} ${report.cars?.model} ${report.cars?.license_plate} ${report.description}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Damage Reports</h1>
          <p className="text-muted-foreground">Track and manage vehicle damage across your fleet.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Report Damage
        </button>
      </div>

      <AddDamageReportModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={fetchReports} 
      />

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder="Search by car, license plate, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading damage reports...</div>
        ) : filteredReports.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto text-muted mb-4" />
            <p className="text-lg font-medium text-foreground">No damage reports found</p>
            <p>You haven't recorded any damage for your cars yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="p-4 font-medium text-muted-foreground">Date Reported</th>
                  <th className="p-4 font-medium text-muted-foreground">Car</th>
                  <th className="p-4 font-medium text-muted-foreground">Description</th>
                  <th className="p-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center text-foreground">
                        <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                        {new Date(report.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-foreground">
                        {report.cars?.make} {report.cars?.model}
                      </div>
                      <div className="text-sm text-muted-foreground">{report.cars?.license_plate}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-start max-w-md">
                        <AlertTriangle className="w-4 h-4 mr-2 text-red-400 mt-1 flex-shrink-0" />
                        <span className="text-foreground line-clamp-2">{report.description}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {report.status === 'resolved' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/20 text-green-400">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Resolved
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900/20 text-yellow-400">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
