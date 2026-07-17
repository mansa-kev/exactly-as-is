import React, { useState, useEffect } from 'react';
import { fleetService } from '../../services/fleetService';
import { supabase } from '../../lib/supabase';
import { Wrench, Plus, Search, Calendar, DollarSign, FileText } from 'lucide-react';
import { AddMaintenanceModal } from './AddMaintenanceModal';

export default function MaintenanceLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const data = await fleetService.getMaintenanceLogs(user.id);
        setLogs(data || []);
      }
    } catch (error) {
      console.error('Error fetching maintenance logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const searchString = `${log.cars?.make} ${log.cars?.model} ${log.cars?.license_plate} ${log.description}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Maintenance Logs</h1>
          <p className="text-muted-foreground">Track service history and costs across your fleet.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Maintenance Record
        </button>
      </div>

      <AddMaintenanceModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={fetchLogs} 
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
          <div className="p-8 text-center text-muted-foreground">Loading maintenance logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Wrench className="w-12 h-12 mx-auto text-muted mb-4" />
            <p className="text-lg font-medium text-foreground">No maintenance logs found</p>
            <p>You haven't recorded any maintenance for your cars yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="p-4 font-medium text-muted-foreground">Date</th>
                  <th className="p-4 font-medium text-muted-foreground">Car</th>
                  <th className="p-4 font-medium text-muted-foreground">Description</th>
                  <th className="p-4 font-medium text-muted-foreground">Cost</th>
                  <th className="p-4 font-medium text-muted-foreground">Next Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center text-foreground">
                        <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                        {new Date(log.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-foreground">
                        {log.cars?.make} {log.cars?.model}
                      </div>
                      <div className="text-sm text-muted-foreground">{log.cars?.license_plate}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-start max-w-md">
                        <FileText className="w-4 h-4 mr-2 text-muted-foreground mt-1 flex-shrink-0" />
                        <span className="text-foreground line-clamp-2">{log.description}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center font-medium text-foreground">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        {log.cost.toLocaleString()}
                      </div>
                    </td>
                    <td className="p-4">
                      {log.next_due_date ? (
                        <div className="flex items-center text-foreground">
                          <Calendar className="w-4 h-4 mr-2 text-blue-400" />
                          {new Date(log.next_due_date).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
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
