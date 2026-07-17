import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  User, 
  Mail, 
  Phone, 
  Shield, 
  MoreHorizontal, 
  UserX, 
  UserCheck, 
  Eye, 
  Filter,
  ArrowUpDown,
  Building2,
  Loader2,
  X,
  KeyRound,
  Trash2,
  Activity,
  Link as LinkIcon,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

// --- Types ---

type UserRole = 'client' | 'fleet_owner' | 'admin' | 'driver';
type UserStatus = 'active' | 'suspended' | 'pending';

interface UserItem {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  last_login: string;
  avatar_url?: string;
}

// --- Components ---

const RoleBadge = ({ role }: { role: UserRole }) => {
  const styles: Record<UserRole, string> = {
    client: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    fleet_owner: 'bg-primary/10 text-primary border-primary/20',
    admin: 'bg-error/10 text-error border-error/20',
    driver: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  };

  const labels: Record<UserRole, string> = {
    client: 'Client',
    fleet_owner: 'Fleet Owner',
    admin: 'Admin',
    driver: 'Driver',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[role]}`}>
      {labels[role]}
    </span>
  );
};

const StatusBadge = ({ status }: { status: UserStatus }) => {
  const styles: Record<UserStatus, string> = {
    active: 'bg-success/10 text-success border-success/20',
    suspended: 'bg-error/10 text-error border-error/20',
    pending: 'bg-warning/10 text-warning border-warning/20',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {status}
    </span>
  );
};

export function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  
  // Modal State
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<UserItem | null>(null);
  
  // Mobile expandable row state
  const [isMobile, setIsMobile] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await adminService.getUsers();
      setUsers(data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Mobile detection with resize listener
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleUpdateRole = async (id: string, role: UserRole) => {
    const promise = (async () => {
      await adminService.updateUserRole(id, role);
      fetchUsers();
      if (selectedUser?.id === id) {
        setSelectedUser({ ...selectedUser, role });
      }
    })();

    toast.promise(promise, {
      loading: `Changing user's role to ${role}...`,
      success: `User's role changed to ${role} successfully`,
      error: 'Failed to update user role'
    });
  };

  const handleUpdateStatus = async (id: string, status: UserStatus) => {
    const action = status === 'suspended' ? 'suspend' : 'activate';
    const promise = (async () => {
      await adminService.updateUserStatus(id, status);
      fetchUsers();
      if (selectedUser?.id === id) {
        setSelectedUser({ ...selectedUser, status });
      }
    })();

    toast.promise(promise, {
      loading: `${action === 'suspend' ? 'Suspending' : 'Activating'} user...`,
      success: `User ${action === 'suspend' ? 'suspended' : 'activated'} successfully`,
      error: `Failed to ${action} user`
    });
  };

  const handleDeleteUser = async (id: string) => {
    const promise = (async () => {
      await adminService.deleteUser(id);
      setIsProfileModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    })();

    toast.promise(promise, {
      loading: 'Deleting user...',
      success: 'User deleted successfully',
      error: (err) => err instanceof Error ? err.message : 'Failed to delete user'
    });
  };

  const openProfile = (user: UserItem) => {
    setSelectedUser(user);
    setIsProfileModalOpen(true);
  };

  const handleResetPassword = async (email: string) => {
    const promise = (async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
    })();
    toast.promise(promise, {
      loading: 'Sending password reset email...',
      success: `Reset link sent to ${email}`,
      error: 'Failed to send reset email'
    });
  };

  const handleViewProfile = (user: UserItem) => {
    setIsProfileModalOpen(false);
    if (user.role === 'client') {
      navigate(`/admin/clients?userId=${user.id}`);
    } else if (user.role === 'fleet_owner') {
      navigate(`/admin/fleet-owners?userId=${user.id}`);
    } else if (user.role === 'driver') {
      navigate(`/admin/drivers?userId=${user.id}`);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || (u.status || 'active') === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading && users.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-sm w-full md:w-80 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="bg-card border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          >
            <option value="all">All Roles</option>
            <option value="client">Clients</option>
            <option value="fleet_owner">Fleet Owners</option>
            <option value="driver">Drivers</option>
            <option value="admin">Admins</option>
          </select>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-card border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Table - Desktop View */}
      {!isMobile && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">User ID</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">User</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Last Login</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-muted-foreground">{user.id.substring(0, 8)}...</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all overflow-hidden">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                          ) : (
                            user.role === 'fleet_owner' ? <Building2 size={20} /> : <User size={20} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground leading-none">{user.full_name || 'No Name'}</p>
                          <p className="text-xs text-muted-foreground mt-1">{user.email || 'No email provided'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={user.status || 'active'} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground font-medium">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openProfile(user)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors" title="View Profile">
                          <Eye size={18} />
                        </button>
                        {(user.status || 'active') === 'active' ? (
                          <button onClick={() => handleUpdateStatus(user.id, 'suspended')} className="p-2 hover:bg-error/10 rounded-lg text-muted-foreground hover:text-error transition-colors" title="Suspend User">
                            <UserX size={18} />
                          </button>
                        ) : (
                          <button onClick={() => handleUpdateStatus(user.id, 'active')} className="p-2 hover:bg-success/10 rounded-lg text-muted-foreground hover:text-success transition-colors" title="Activate User">
                            <UserCheck size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredUsers.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">No users found matching your criteria.</p>
            </div>
          )}

          <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/10">
            <span className="text-xs text-muted-foreground font-medium">Showing {filteredUsers.length} of {users.length} entries</span>
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
          {filteredUsers.map((user) => (
            <div key={user.id}>
              {/* Summary Row */}
              <div 
                className="flex justify-between items-center px-4 py-3 bg-card border border-border rounded-xl cursor-pointer select-none hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedRowId(expandedRowId === user.id ? null : user.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                    ) : (
                      user.role === 'fleet_owner' ? <Building2 size={20} /> : <User size={20} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{user.full_name || 'No Name'}</p>
                    <p className="text-xs text-muted-foreground">{user.email || 'No email provided'}</p>
                  </div>
                </div>
                <ChevronDown 
                  size={16} 
                  className={`transition-transform duration-200 ${expandedRowId === user.id ? 'rotate-180' : ''}`}
                />
              </div>

              {/* Expanded Card */}
              {expandedRowId === user.id && (
                <div className="bg-card border border-border rounded-xl p-4 mb-3 max-h-[65vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">User ID</span>
                      <p className="text-sm text-white font-medium break-all">{user.id}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Full Name</span>
                      <p className="text-sm text-white font-medium">{user.full_name || 'No Name'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Email</span>
                      <p className="text-sm text-white font-medium break-all">{user.email || 'No email provided'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Role</span>
                      <div className="mt-1">
                        <RoleBadge role={user.role} />
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Status</span>
                      <div className="mt-1">
                        <StatusBadge status={user.status || 'active'} />
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide">Last Login</span>
                      <p className="text-sm text-white font-medium">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
                    <button 
                      onClick={() => openProfile(user)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Eye size={12} />
                      View Profile
                    </button>
                    {(user.status || 'active') === 'active' ? (
                      <button 
                        onClick={() => handleUpdateStatus(user.id, 'suspended')}
                        className="px-3 py-1.5 bg-error text-white rounded-lg text-xs font-bold hover:bg-error/90 transition-colors flex items-center gap-2"
                      >
                        <UserX size={12} />
                        Suspend
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleUpdateStatus(user.id, 'active')}
                        className="px-3 py-1.5 bg-success text-white rounded-lg text-xs font-bold hover:bg-success/90 transition-colors flex items-center gap-2"
                      >
                        <UserCheck size={12} />
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {filteredUsers.length === 0 && (
            <div className="p-12 text-center bg-card border border-border rounded-xl">
              <p className="text-muted-foreground">No users found matching your criteria.</p>
            </div>
          )}

          <div className="px-4 py-3 bg-card border border-border rounded-xl flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Showing {filteredUsers.length} of {users.length} entries</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 border border-border rounded-md text-xs font-bold disabled:opacity-50" disabled>Previous</button>
              <button className="px-3 py-1 border border-border rounded-md text-xs font-bold disabled:opacity-50" disabled>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {isProfileModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsProfileModalOpen(false)} />
          <div className="relative bg-card w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-border flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground overflow-hidden">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt={selectedUser.full_name} className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.role === 'fleet_owner' ? <Building2 size={24} /> : <User size={24} />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedUser.full_name || 'No Name'}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-muted-foreground">ID: {selectedUser.id}</span>
                    <StatusBadge status={selectedUser.status || 'active'} />
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-8">
              
              {/* Personal Information */}
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <User size={16} /> Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted/30 p-4 rounded-xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Email Address</p>
                    <p className="font-medium flex items-center gap-2">
                      <Mail size={14} className="text-muted-foreground" />
                      {selectedUser.email || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
                    <p className="font-medium flex items-center gap-2">
                      <Phone size={14} className="text-muted-foreground" />
                      {selectedUser.phone_number || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Joined Date</p>
                    <p className="font-medium">
                      {new Date(selectedUser.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-xl border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Last Login</p>
                    <p className="font-medium">
                      {selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Role & Permissions */}
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <Shield size={16} /> Role & Permissions
                </h3>
                <div className="bg-muted/30 p-6 rounded-xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium mb-1 flex items-center gap-2">
                      Current Role: <RoleBadge role={selectedUser.role} />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedUser.role === 'admin' && 'Has full access to all system modules and settings.'}
                      {selectedUser.role === 'fleet_owner' && 'Can manage their own fleet, view bookings, and access financials.'}
                      {selectedUser.role === 'client' && 'Can browse cars, make bookings, and manage their profile.'}
                      {selectedUser.role === 'driver' && 'Can view assigned trips and manage their driving schedule.'}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <select 
                      className="bg-background border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                      value={selectedUser.role}
                      onChange={(e) => handleUpdateRole(selectedUser.id, e.target.value as UserRole)}
                    >
                      <option value="client">Make Client</option>
                      <option value="fleet_owner">Make Fleet Owner</option>
                      <option value="driver">Make Driver</option>
                      <option value="admin">Make Admin</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Associated Entities */}
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <LinkIcon size={16} /> Associated Entities
                </h3>
                <div className="bg-muted/30 p-4 rounded-xl border border-border">
                  {selectedUser.role === 'fleet_owner' ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Fleet Owner Profile</p>
                        <p className="text-sm text-muted-foreground">Manage company details, payout settings, and fleet.</p>
                      </div>
                      <button
                        onClick={() => handleViewProfile(selectedUser)}
                        className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-sm font-bold transition-colors"
                      >
                        View Fleet Profile
                      </button>
                    </div>
                  ) : selectedUser.role === 'client' ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Client Profile</p>
                        <p className="text-sm text-muted-foreground">View booking history, saved payment methods, and preferences.</p>
                      </div>
                      <button
                        onClick={() => handleViewProfile(selectedUser)}
                        className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-sm font-bold transition-colors"
                      >
                        View Client Profile
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No associated entities for this role.</p>
                  )}
                </div>
              </section>

              {/* Activity Log */}
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <Activity size={16} /> Activity Log
                </h3>
                <div className="bg-muted/30 p-4 rounded-xl border border-border">
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-primary flex-shrink-0"></div>
                      <div>
                        <p className="text-sm font-medium">Account Created</p>
                        <p className="text-xs text-muted-foreground">{new Date(selectedUser.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    {selectedUser.last_login && (
                      <div className="flex gap-4">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-success flex-shrink-0"></div>
                        <div>
                          <p className="text-sm font-medium">Last Login</p>
                          <p className="text-xs text-muted-foreground">{new Date(selectedUser.last_login).toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-4">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-muted-foreground flex-shrink-0"></div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Further activity logs will appear here.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

            </div>

            {/* Modal Footer (Action Buttons) */}
            <div className="sticky bottom-0 z-10 bg-card/80 backdrop-blur-md border-t border-border px-6 py-4 flex flex-wrap items-center justify-between gap-4 rounded-b-3xl">
              <div className="flex gap-2">
                <button
                  onClick={() => handleResetPassword(selectedUser.email)}
                  className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-sm font-bold transition-colors"
                >
                  <KeyRound size={16} /> Reset Password
                </button>
              </div>
              <div className="flex gap-2">
                {(selectedUser.status || 'active') === 'active' ? (
                  <button 
                    onClick={() => handleUpdateStatus(selectedUser.id, 'suspended')}
                    className="flex items-center gap-2 px-4 py-2 bg-warning/10 hover:bg-warning/20 text-warning rounded-xl text-sm font-bold transition-colors"
                  >
                    <UserX size={16} /> Suspend Account
                  </button>
                ) : (
                  <button 
                    onClick={() => handleUpdateStatus(selectedUser.id, 'active')}
                    className="flex items-center gap-2 px-4 py-2 bg-success/10 hover:bg-success/20 text-success rounded-xl text-sm font-bold transition-colors"
                  >
                    <UserCheck size={16} /> Activate Account
                  </button>
                )}
                <button 
                  onClick={() => handleDeleteUser(selectedUser.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-error/10 hover:bg-error/20 text-error rounded-xl text-sm font-bold transition-colors"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

