// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { adminService } from '../../services/adminService';
import { 
  Search, 
  ShieldCheck, 
  User, 
  Building2, 
  Car, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Clock,
  MoreHorizontal,
  AlertCircle,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

// --- Types ---

type VerificationType = 'driver' | 'fleet_owner' | 'car' | 'client_document';

interface VerificationItem {
  id: string;
  type: VerificationType;
  subjectName: string;
  submittedDate: string;
  documents: {
    name: string;
    url: string;
    status: 'pending' | 'approved' | 'rejected';
  }[];
  status: 'pending' | 'approved' | 'rejected';
}

// --- Components ---

const TypeBadge = ({ type }: { type: VerificationType }) => {
  const icons = {
    driver: <User size={14} />,
    fleet_owner: <Building2 size={14} />,
    car: <Car size={14} />,
    client_document: <FileText size={14} />,
  };

  const labels = {
    driver: 'Driver',
    fleet_owner: 'Fleet Owner',
    car: 'Car',
    client_document: 'Client Doc',
  };

  return (
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider border border-border">
      {icons[type]}
      {labels[type]}
    </div>
  );
};

export function AdminVerification() {
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<VerificationType | 'all'>('all');
  
  // Mobile expandable row state
  const [isMobile, setIsMobile] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const [data, docs] = await Promise.all([
        adminService.getVerifications(),
        adminService.getClientDocuments()
      ]);
      const formatted: VerificationItem[] = [];

      data.drivers.forEach((d: any) => {
        formatted.push({
          id: d.id,
          type: 'driver',
          subjectName: d.user_profiles?.full_name || 'Anonymous',
          submittedDate: new Date(d.created_at).toLocaleString(),
          documents: [
            { name: 'Driving License', url: '#', status: d.status === 'active' ? 'approved' : 'pending' }
          ],
          status: d.status === 'active' ? 'approved' : 'pending'
        });
      });

      data.fleetOwners.forEach((o: any) => {
        formatted.push({
          id: o.id,
          type: 'fleet_owner',
          subjectName: o.user_profiles?.full_name || 'Anonymous',
          submittedDate: new Date(o.created_at).toLocaleString(),
          documents: [
            { name: 'Business Registration', url: '#', status: o.status === 'active' ? 'approved' : 'pending' }
          ],
          status: o.status === 'active' ? 'approved' : 'pending'
        });
      });

      data.cars.forEach((c: any) => {
        formatted.push({
          id: c.id,
          type: 'car',
          subjectName: `${c.make} ${c.model} (${c.license_plate})`,
          submittedDate: new Date(c.created_at).toLocaleString(),
          documents: [
            { name: 'Vehicle Registration', url: '#', status: c.status === 'available' ? 'approved' : 'pending' }
          ],
          status: c.status === 'available' ? 'approved' : 'pending'
        });
      });

      docs.forEach((doc: any) => {
        formatted.push({
          id: doc.id,
          type: 'client_document',
          subjectName: doc.client?.full_name || 'Anonymous',
          submittedDate: new Date(doc.uploaded_at).toLocaleString(),
          documents: [
            { name: doc.document_type, url: doc.document_url, status: doc.status }
          ],
          status: doc.status
        });
      });

      setVerifications(formatted);
    } catch (error) {
      console.error('Failed to fetch verifications:', error);
      toast.error('Failed to fetch verifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, []);

  // Mobile detection with resize listener
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleApprove = async (item: VerificationItem) => {
    const promise = (async () => {
      if (item.type === 'driver') await adminService.updateDriverStatus(item.id, 'active');
      else if (item.type === 'fleet_owner') await adminService.updateFleetOwnerStatus(item.id, 'active');
      else if (item.type === 'car') await adminService.updateCarStatus(item.id, 'available');
      else if (item.type === 'client_document') {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        await adminService.approveClientDocument(item.id, user.id);
      }
      fetchVerifications();
    })();

    toast.promise(promise, {
      loading: 'Approving...',
      success: 'Approved successfully!',
      error: 'Failed to approve'
    });
  };

  const filteredVerifications = verifications.filter(v => 
    activeType === 'all' || v.type === activeType
  );

  if (loading && verifications.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['all', 'driver', 'fleet_owner', 'car'].map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeType === type 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            {type === 'all' ? 'All Queue' : (type ? (type.replace('_', ' ').charAt(0).toUpperCase() + type.replace('_', ' ').slice(1) + 's') : '')}
          </button>
        ))}
      </div>

      {/* Queue Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredVerifications.map((item) => (
          <div key={item.id} className="bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <TypeBadge type={item.type} />
                <span className="text-xs text-muted-foreground font-medium">{item.submittedDate}</span>
              </div>
              <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                item.status === 'reviewing' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-warning/10 text-warning border-warning/20'
              }`}>
                {item.status}
              </div>
            </div>

            <h3 className="text-lg font-bold text-foreground mb-4">{item.subjectName}</h3>

            <div className="space-y-3 mb-8">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground opacity-50 mb-2">Submitted Documents</p>
              {item.documents.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-muted-foreground" />
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-primary transition-colors">{doc.name}</a>
                  </div>
                  {doc.status === 'approved' ? (
                    <CheckCircle2 size={16} className="text-success" />
                  ) : doc.status === 'rejected' ? (
                    <XCircle size={16} className="text-error" />
                  ) : (
                    <Clock size={16} className="text-warning" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => handleApprove(item)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20"
              >
                <ShieldCheck size={18} /> Approve
              </button>
              <button className="px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-xl transition-colors">
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredVerifications.length === 0 && (
        <div className="p-20 text-center bg-card rounded-2xl border border-border border-dashed">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-success" />
          </div>
          <h3 className="text-lg font-bold mb-1">Queue Clear</h3>
          <p className="text-muted-foreground">All pending verifications have been processed.</p>
        </div>
      )}
    </div>
  );
}