import React, { useEffect, useState } from 'react';
import { fleetService } from '../../services/fleetService';
import { supabase } from '../../lib/supabase';
import { FileText, User } from 'lucide-react';

export function DigitalVault() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVaultData();
  }, []);

  const fetchVaultData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [contractsData, docsData] = await Promise.all([
          fleetService.getEContracts(user.id),
          fleetService.getRenterDocuments(user.id)
        ]);
        setContracts(contractsData || []);
        setDocuments(docsData || []);
      }
    } catch (err) {
      console.error("Error fetching vault data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading digital vault...</div>;

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Digital Vault</h2>
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><FileText size={20} /> Signed E-Contracts</h3>
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="text-left text-muted-foreground text-sm uppercase tracking-wider">
                <th className="pb-4">Car</th>
                <th className="pb-4">Signed At</th>
                <th className="pb-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract: any) => (
                <tr key={contract.id} className="border-t border-border">
                  <td className="py-4">{contract.bookings?.cars?.make} {contract.bookings?.cars?.model}</td>
                  <td className="py-4">{new Date(contract.signed_at).toLocaleDateString()}</td>
                  <td className="py-4">
                    <a href={contract.pdf_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><User size={20} /> Renter ID Documents</h3>
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="text-left text-muted-foreground text-sm uppercase tracking-wider">
                <th className="pb-4">Document Type</th>
                <th className="pb-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc: any) => (
                <tr key={doc.id} className="border-t border-border">
                  <td className="py-4">{doc.document_type}</td>
                  <td className="py-4">
                    <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Document</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
