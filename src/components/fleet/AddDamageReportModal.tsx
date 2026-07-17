import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { fleetService } from '../../services/fleetService';
import { supabase } from '../../lib/supabase';

interface AddDamageReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialCarId?: string;
}

export function AddDamageReportModal({ isOpen, onClose, onSuccess, initialCarId }: AddDamageReportModalProps) {
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    car_id: initialCarId || '',
    description: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchCars();
      if (initialCarId) {
        setFormData(prev => ({ ...prev, car_id: initialCarId }));
      }
    }
  }, [isOpen, initialCarId]);

  const fetchCars = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const data = await fleetService.getMyCars(user.id);
        setCars(data || []);
        if (data && data.length > 0 && !initialCarId) {
          setFormData(prev => ({ ...prev, car_id: data[0].id }));
        }
      }
    } catch (error) {
      console.error('Error fetching cars:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await fleetService.addDamageReport({
          car_id: formData.car_id,
          fleet_owner_id: user.id,
          description: formData.description,
          status: 'pending',
        });
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Error reporting damage:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Report Damage</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="add-damage-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Car</label>
              <select
                required
                value={formData.car_id}
                onChange={(e) => setFormData({ ...formData, car_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {(cars || []).map(car => (
                  <option key={car.id} value={car.id}>
                    {car.make} {car.model} ({car.license_plate})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe the damage in detail..."
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-damage-form"
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
