import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../services/adminService';
import { 
  Plus, 
  Search, 
  FileText, 
  Trash2, 
  Edit2, 
  Loader2,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Upload,
  History,
  AlertCircle,
  X,
  FileDown,
  Building2,
  Save,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../../lib/supabase';
import { toProxyUrl } from '../../utils/assetUrl';

export function AdminContractManager() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    version: '',
    pdf_url: '',
    is_active: false
  });
  const [htmlContent, setHtmlContent] = useState('');

  const [companySettings, setCompanySettings] = useState({
    company_po_box: '',
    company_signature_url: '',
    contract_logo_url: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const fetchSettings = async () => {
    try {
      const data = await adminService.getAppSettings(['company_po_box', 'company_signature_url', 'contract_logo']);
      if (data) {
        const settings: any = {};
        data.forEach(item => {
          settings[item.key] = item.logo_url || item.value || '';
          if (item.key === 'contract_logo') {
            settings.contract_logo_url = item.logo_url || item.value || '';
          }
        });
        setCompanySettings(prev => ({ ...prev, ...settings }));
      }
    } catch (error) {
      console.error('Failed to fetch app settings:', error);
    }
  };

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await adminService.getContracts();
      setContracts(data || []);
    } catch (error) {
      console.error('Failed to fetch contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
    fetchSettings();
  }, []);

  // HTML content will be uploaded upon saving
  const onDropSig = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadingSig(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `company-sig-${Date.now()}.${fileExt}`;
      const filePath = `settings/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public_assets')
        .getPublicUrl(filePath);

      setCompanySettings(prev => ({ ...prev, company_signature_url: publicUrl }));
    } catch (error: any) {
      console.error('Upload signature error:', error);
      toast.error('Failed to upload signature');
    } finally {
      setUploadingSig(false);
    }
  }, []);

  const onDropLogo = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `contract-logo-${Date.now()}.${fileExt}`;
      const filePath = `settings/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public_assets')
        .getPublicUrl(filePath);

      await supabase
        .from('app_settings')
        .upsert({
          key: 'contract_logo',
          logo_url: publicUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      setCompanySettings(prev => ({ ...prev, contract_logo_url: publicUrl }));
      toast.success('Contract logo uploaded successfully!');
    } catch (error: any) {
      console.error('Upload logo error:', error);
      toast.error('Failed to upload contract logo');
    } finally {
      setUploadingLogo(false);
    }
  }, []);

  const { getRootProps: getSigProps, getInputProps: getSigInputProps, isDragActive: isSigDragActive } = useDropzone({ 
    onDrop: onDropSig,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxFiles: 1,
    multiple: false
  } as any);

  const { getRootProps: getLogoProps, getInputProps: getLogoInputProps, isDragActive: isLogoDragActive } = useDropzone({
    onDrop: onDropLogo,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.svg'] },
    maxFiles: 1,
    multiple: false
  } as any);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const promise = (async () => {
      await adminService.updateAppSetting('company_po_box', companySettings.company_po_box, 'Company P.O. Box for contracts');
      await adminService.updateAppSetting('company_signature_url', companySettings.company_signature_url, 'Company Signature Image URL');
      await adminService.updateAppSetting('contract_logo', companySettings.contract_logo_url, 'Contract logo image URL');
    })();

    toast.promise(promise, {
      loading: 'Saving company details...',
      success: 'Company details saved successfully',
      error: 'Failed to save company details'
    });
    
    promise.finally(() => setSavingSettings(false));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!htmlContent.trim()) {
      toast.error('Please enter the contract HTML template');
      return;
    }

    setUploading(true);
    const promise = (async () => {
      // 1. Upload HTML as a file to storage
      const fileName = `contract-v${formData.version || Date.now()}-${Date.now()}.html`;
      const filePath = `contracts/${fileName}`;
      const file = new Blob([htmlContent], { type: 'text/html' });

      const { error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public_assets')
        .getPublicUrl(filePath);

      // If activating this contract, deactivate others
      if (formData.is_active) {
        await supabase
          .from('contracts_master')
          .update({ is_active: false })
          .eq('is_active', true);
      }

      await adminService.createContract({
        ...formData,
        pdf_url: publicUrl,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id
      });
      
      setIsAdding(false);
      setFormData({ version: '', pdf_url: '', is_active: false });
      setHtmlContent('');
      fetchContracts();
    })();

    toast.promise(promise, {
      loading: 'Saving contract version...',
      success: 'Contract version saved successfully',
      error: 'Failed to save contract'
    });
    
    promise.finally(() => setUploading(false));
  };

  const handleDelete = async (id: string) => {
    const promise = (async () => {
      await adminService.deleteContract(id);
      fetchContracts();
    })();

    toast.promise(promise, {
      loading: 'Deleting contract version...',
      success: 'Contract version deleted successfully',
      error: 'Failed to delete contract'
    });
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const promise = (async () => {
      // If activating, deactivate others first
      if (!currentStatus) {
        await supabase
          .from('contracts_master')
          .update({ is_active: false })
          .eq('is_active', true);
      }

      await supabase
        .from('contracts_master')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      fetchContracts();
    })();

    toast.promise(promise, {
      loading: 'Updating status...',
      success: 'Status updated successfully',
      error: 'Failed to update status'
    });
  };

  const filteredContracts = contracts.filter(c => 
    c.version.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && contracts.length === 0) {
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
          <h2 className="text-2xl font-bold">Contract Manager</h2>
          <p className="text-muted-foreground">Manage master rental agreements and legal document versions.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={20} />
          Upload New Version
        </button>
      </div>

      {isAdding && (
        <div className="bg-card p-8 rounded-2xl border border-border shadow-xl animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg">Upload Master Contract</h3>
            <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCreate} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex flex-col space-y-4">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contract HTML Template</label>
                <textarea 
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  placeholder="Enter HTML for the contract. Example: <h1>Rental Agreement</h1><p>Client: {{clientName}}</p>"
                  className="w-full h-64 px-4 py-3 bg-muted border-none rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="bg-muted/30 p-4 rounded-xl border border-border flex gap-3">
                <AlertCircle className="text-primary shrink-0" size={20} />
                <div className="space-y-1">
                  <p className="text-xs font-bold">Dynamic Data Injection</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Use placeholders like <code className="bg-muted px-1 rounded">{"{{clientName}}"}</code>, 
                    <code className="bg-muted px-1 rounded">{"{{carMake}}"}</code>, 
                    <code className="bg-muted px-1 rounded">{"{{startDate}}"}</code> 
                    in your HTML. The system will automatically replace them when the client views it.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Version Number</label>
                <input 
                  type="text"
                  required
                  value={formData.version}
                  onChange={e => setFormData({...formData, version: e.target.value})}
                  placeholder="e.g. 2.4.0"
                  className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Initial Status</label>
                <div className="flex items-center gap-4 h-10">
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, is_active: !formData.is_active})}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      formData.is_active ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {formData.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {formData.is_active ? 'Set as Active Version' : 'Keep as Draft'}
                  </button>
                </div>
                {formData.is_active && (
                  <p className="text-[10px] text-warning font-bold italic">
                    * Activating this version will automatically deactivate the current active contract.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button 
                  type="submit" 
                  disabled={uploading || !htmlContent.trim() || !formData.version}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  Save Contract Version
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)}
                  className="px-8 py-3 bg-muted text-foreground rounded-xl font-bold hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <History className="text-primary" size={20} />
            <h3 className="font-bold text-lg">Version History</h3>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder="Search versions..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-muted border-none rounded-xl text-xs w-64 outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Version</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Upload Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredContracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <FileText size={18} />
                      </div>
                      <span className="font-bold text-sm">v{contract.version}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted-foreground">{new Date(contract.created_at).toLocaleDateString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleToggleStatus(contract.id, contract.is_active)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                        contract.is_active 
                          ? 'bg-success/10 text-success border-success/20 hover:bg-success/20' 
                          : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                      }`}
                    >
                      {contract.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setPreviewUrl(contract.pdf_url)}
                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors" 
                        title="Preview PDF"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => window.open(contract.pdf_url, '_blank')}
                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors"
                        title="Download / View Template"
                      >
                        <FileDown size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(contract.id)}
                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-error transition-colors"
                        title="Delete Version"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    No contract versions found. Upload your first Master Contract to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Company Settings for Contracts */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-border flex items-center justify-between gap-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <Building2 className="text-primary" size={20} />
            <h3 className="font-bold text-lg">Company Details for Contracts</h3>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Company P.O. Box</label>
              <input 
                type="text"
                value={companySettings.company_po_box}
                onChange={e => setCompanySettings({...companySettings, company_po_box: e.target.value})}
                placeholder="e.g. 12345-00100 Nairobi"
                className="w-full px-4 py-3 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[10px] text-muted-foreground">This will be auto-filled into the master contract.</p>
            </div>
            <button 
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-transform disabled:opacity-50"
            >
              <Save size={18} />
              Save Company Details
            </button>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Company Signature</label>
            <div 
              {...getSigProps()} 
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[150px] ${
                isSigDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <input {...getSigInputProps()} />
              {uploadingSig ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-primary" size={24} />
                  <p className="text-xs font-bold">Uploading...</p>
                </div>
              ) : companySettings.company_signature_url ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <img 
                    src={companySettings.company_signature_url} 
                    alt="Company Signature" 
                    className="max-h-20 object-contain mix-blend-multiply dark:mix-blend-normal dark:bg-white/10 rounded"
                  />
                  <p className="text-xs text-primary font-bold">Click to replace signature</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={24} className="text-muted-foreground" />
                  <p className="text-sm font-bold">Upload Signature Image</p>
                  <p className="text-[10px] text-muted-foreground">PNG or JPG with transparent/white background</p>
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">This signature will be embedded onto the generated contract automatically.</p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contract Logo</label>
            <div
              {...getLogoProps()}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[150px] ${
                isLogoDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <input {...getLogoInputProps()} />
              {uploadingLogo ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-primary" size={24} />
                  <p className="text-xs font-bold">Uploading...</p>
                </div>
              ) : companySettings.contract_logo_url ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <img 
                    src={companySettings.contract_logo_url} 
                    alt="Contract Logo" 
                    className="max-h-20 object-contain"
                  />
                  <p className="text-xs text-primary font-bold">Click to replace logo</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon size={24} className="text-muted-foreground" />
                  <p className="text-sm font-bold">Upload Contract Logo</p>
                  <p className="text-[10px] text-muted-foreground">This logo appears on the rental agreement HTML template</p>
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">Use a clean logo that will be injected into the contract HTML template.</p>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-300">
          <div className="relative w-full max-w-5xl h-[90vh] bg-card rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="font-bold">Contract Preview</h3>
              <button 
                onClick={() => setPreviewUrl(null)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <iframe 
              src={toProxyUrl(previewUrl) || previewUrl} 
              className="flex-1 w-full border-none"
              title="Contract Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
