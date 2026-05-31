import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { 
  ShieldAlert, Users, AlertTriangle, ShieldCheck, Database, HardDrive, 
  Wifi, BarChart3, Cloud, Clock, RefreshCw, Download, Upload, Trash2, Ban 
} from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('health');
  
  // Health Metrics state
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  // Users Management state
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Reports state
  const [reportsQueue, setReportsQueue] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  // Logs state
  const [modLogs, setModLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [restoreFile, setRestoreFile] = useState(null);

  // 1. Fetch Health Metrics
  const fetchHealthMetrics = async () => {
    try {
      setLoadingHealth(true);
      const res = await api.get('/admin/health');
      setHealthData(res.data);
    } catch (err) {
      console.error('Failed fetching health metrics:', err.message);
    } finally {
      setLoadingHealth(false);
    }
  };

  // 2. Fetch Users
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await api.get('/admin/users');
      setUsersList(res.data);
    } catch (err) {
      console.error('Failed fetching admin users:', err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 3. Fetch Reports
  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const res = await api.get('/admin/reports');
      setReportsQueue(res.data);
    } catch (err) {
      console.error('Failed fetching reports:', err.message);
    } finally {
      setLoadingReports(false);
    }
  };

  // 4. Fetch Logs
  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await api.get('/admin/logs');
      setModLogs(res.data);
    } catch (err) {
      console.error('Failed fetching logs:', err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'health') fetchHealthMetrics();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'reports') fetchReports();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab]);

  // Set account status (Block / Suspend / Reactivate)
  const handleUpdateStatus = async (targetId, newStatus) => {
    if (!window.confirm(`Are you sure you want to change user status to: ${newStatus}?`)) return;
    try {
      await api.post(`/admin/users/${targetId}/status`, { status: newStatus });
      alert(`User status changed to ${newStatus}.`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed updating status.');
    }
  };

  // Delete Reported Post
  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this reported post from feed?')) return;
    try {
      await api.delete(`/posts/${postId}`);
      alert('Post deleted.');
      fetchReports();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete post.');
    }
  };

  // Delete Reported Comment
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this reported comment?')) return;
    try {
      await api.delete(`/comments/${commentId}`);
      alert('Comment deleted.');
      fetchReports();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete comment.');
    }
  };

  // Trigger Backup Download
  const handleBackupExport = () => {
    window.open('http://localhost:5000/api/admin/backup', '_blank');
  };

  // Handle Restore JSON File
  const handleRestoreImportChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          if (!window.confirm('WARNING: Restoring will overwrite all current database tables. Proceed?')) return;
          
          const res = await api.post('/admin/restore', jsonData);
          alert(res.data.message || 'Database successfully restored!');
          fetchHealthMetrics();
        } catch (err) {
          alert('Failed restoring database. Please verify the JSON backup structure is correct.');
        }
      };
      reader.readAsText(file);
    }
  };

  // Formatting helpers
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getPercentageColor = (status) => {
    switch (status) {
      case 'critical': return 'text-anime-red';       // Red 95%+
      case 'warning': return 'text-anime-orange';    // Orange 85%+
      case 'caution': return 'text-anime-yellow';    // Yellow 70%+
      default: return 'text-anime-blue';             // Blue <70%
    }
  };

  const getPercentageBg = (status) => {
    switch (status) {
      case 'critical': return 'bg-anime-red/25 border-anime-red/40';
      case 'warning': return 'bg-anime-orange/25 border-anime-orange/40';
      case 'caution': return 'bg-anime-yellow/25 border-anime-yellow/40';
      default: return 'bg-anime-blue/15 border-anime-blue/20';
    }
  };

  const renderGauge = (title, current, limit, meta, format = 'bytes') => {
    const valueStr = format === 'bytes' ? formatBytes(current) : current.toLocaleString();
    const limitStr = format === 'bytes' ? formatBytes(limit) : limit.toLocaleString();
    const pctColor = getPercentageColor(meta.status);
    const pctBg = getPercentageBg(meta.status);

    return (
      <div className={`p-5 rounded-2xl border ${pctBg} backdrop-blur-md relative overflow-hidden flex flex-col gap-2.5`}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</span>
          <span className={`text-xs font-black ${pctColor}`}>{meta.percentage}%</span>
        </div>
        <div className="text-xl font-black text-anime-text">{valueStr} / {limitStr}</div>
        
        {/* Simple Progress Bar */}
        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${meta.status === 'critical' ? 'from-anime-red to-red-400' : meta.status === 'warning' ? 'from-anime-orange to-orange-300' : 'from-anime-blue to-anime-purple'}`}
            style={{ width: `${meta.percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-4">
        <div>
          <h2 className="text-2xl font-black italic bg-gradient-to-r from-anime-pink to-anime-purple bg-clip-text text-transparent flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-anime-pink animate-pulse" />
            Admin Moderation Dashboard
          </h2>
          <span className="text-[10px] text-anime-muted block mt-0.5">Protecting the NaruBook timelines</span>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'health', lbl: 'Health Metrics', icon: ShieldCheck },
            { id: 'users', lbl: 'User Accounts', icon: Users },
            { id: 'reports', lbl: 'Abuse Reports', icon: AlertTriangle },
            { id: 'logs', lbl: 'Moderator Logs', icon: Clock }
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${activeTab === t.id ? 'bg-anime-purple/10 border-anime-purple/35 text-anime-purple shadow-neon-purple' : 'text-slate-400 border-slate-800/80 hover:bg-slate-900/40'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.lbl}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab: System Health Monitor */}
      {activeTab === 'health' && (
        <div className="flex flex-col gap-6">
          {loadingHealth ? (
            <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 text-anime-blue animate-spin" /></div>
          ) : (
            <>
              {/* Warnings Warning Banner if any metric hits red/orange */}
              {(healthData?.status_report?.db_usage?.status === 'critical' || 
                healthData?.status_report?.api_requests?.status === 'critical') && (
                <div className="p-4 bg-anime-red/10 border border-anime-red/45 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-anime-red animate-bounce flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <h4 className="font-bold text-anime-red uppercase tracking-wider">CRITICAL FREE TIER WARNING</h4>
                    <p className="text-anime-muted mt-1">
                      One or more system metrics are above 95% of the Supabase free-tier allotment. Est. {healthData?.estimated_days_remaining} days before potential resource caps. Please schedule a database export or scale details.
                    </p>
                  </div>
                </div>
              )}

              {/* Status Indicator Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Est. Remaining Days */}
                <div className="anime-card p-5 border-l-4 border-l-anime-blue flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-anime-muted block mb-1">Time to exhaustion</span>
                    <span className="text-3xl font-black text-anime-blue shadow-neon-blue">{healthData?.estimated_days_remaining} Days</span>
                    <p className="text-[10px] text-anime-muted mt-2">Based on simulated daily usage trends</p>
                  </div>
                  <BarChart3 className="w-10 h-10 text-anime-blue/20" />
                </div>

                {/* Backend Server Status */}
                <div className="anime-card p-5 border-l-4 border-l-anime-blue flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-anime-muted block mb-1">Backend Server</span>
                    <span className="text-2xl font-black text-anime-blue flex items-center gap-1.5 shadow-neon-blue">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block pulse-glow"></span>
                      ONLINE
                    </span>
                    <p className="text-[10px] text-anime-muted mt-3">Mode: {healthData?.database_mode || 'Local Mock DB'}</p>
                  </div>
                  <HardDrive className="w-10 h-10 text-anime-blue/20" />
                </div>
                
                {/* Vercel App Status */}
                <div className="anime-card p-5 border-l-4 border-l-anime-pink flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-anime-muted block mb-1">Vercel Deployment</span>
                    <span className="text-2xl font-black text-anime-pink flex items-center gap-1.5 shadow-neon-pink">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block pulse-glow"></span>
                      ONLINE
                    </span>
                    <p className="text-[10px] text-anime-muted mt-3">Commit: main / auto-production</p>
                  </div>
                  <Cloud className="w-10 h-10 text-anime-pink/20" />
                </div>

                {/* Supabase PostgreSQL Status */}
                <div className="anime-card p-5 border-l-4 border-l-anime-purple flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-anime-muted block mb-1">Supabase DB Status</span>
                    <span className="text-2xl font-black text-anime-purple flex items-center gap-1.5 shadow-neon-purple">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block pulse-glow"></span>
                      CONNECTED
                    </span>
                    <p className="text-[10px] text-anime-muted mt-3">PostgreSQL RLS Enabled</p>
                  </div>
                  <Database className="w-10 h-10 text-anime-purple/20" />
                </div>

              </div>

              {/* Gauges Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Supabase Database Size */}
                {renderGauge('Supabase Database Storage', healthData?.metrics?.db_bytes, healthData?.limits?.supabase_db_bytes, healthData?.status_report?.db_usage)}
                
                {/* 2. Monthly API Requests */}
                {renderGauge('Monthly API Requests Hits', healthData?.metrics?.api_requests, healthData?.limits?.supabase_api_requests, healthData?.status_report?.api_requests, 'count')}

                {/* 3. Storage consumed */}
                {renderGauge('Supabase Media Storage', healthData?.metrics?.storage_bytes, healthData?.limits?.supabase_storage_bytes, healthData?.status_report?.storage_usage)}

                {/* 4. Supabase Egress Bandwidth */}
                {renderGauge('Supabase Transfer Bandwidth', healthData?.metrics?.bandwidth_bytes, healthData?.limits?.supabase_bandwidth_bytes, healthData?.status_report?.bandwidth_usage)}

                {/* 5. Vercel Egress Bandwidth */}
                {renderGauge('Vercel Network Bandwidth', healthData?.metrics?.vercel_bandwidth_bytes, healthData?.limits?.vercel_bandwidth_bytes, healthData?.status_report?.vercel_bandwidth)}

                {/* 6. Vercel Monthly Build Usage */}
                {renderGauge('Vercel Build Minutes', healthData?.metrics?.vercel_build_minutes, healthData?.limits?.vercel_build_minutes, healthData?.status_report?.vercel_builds, 'count')}

              </div>

              {/* One-Click Backup and Recovery Section */}
              <div className="anime-card p-6 border-t-2 border-t-anime-purple">
                <h3 className="font-bold text-sm text-anime-purple uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-anime-purple" />
                  Database Backup & Restoration Centre
                </h3>
                <p className="text-xs text-anime-muted mb-6 leading-relaxed">
                  Protect and restore NaruBook contents. Download a complete JSON snapshot of all database structures, or restore database tables by uploading an exported file. Restoring will override existing tables in real-time.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Backup Button */}
                  <button
                    onClick={handleBackupExport}
                    className="btn-neon-blue !py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold"
                  >
                    <Download className="w-4 h-4" />
                    Download JSON Backup
                  </button>

                  {/* Restore Button */}
                  <label className="cursor-pointer btn-neon-pink !py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-center">
                    <Upload className="w-4 h-4" />
                    Upload & Restore Backup
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreImportChange}
                      className="hidden"
                    />
                  </label>

                  {/* Simulate Failover Button */}
                  <button
                    onClick={async () => {
                      if (!window.confirm('Simulate 100% Resource Exhaustion? This will automatically trigger database replication and transfer all data to a fresh instance.')) return;
                      try {
                        const res = await api.post('/admin/simulate-exhaustion');
                        alert(res.data.message);
                        fetchHealthMetrics();
                      } catch (err) {
                        alert('Failed to simulate exhaustion.');
                      }
                    }}
                    className="btn-neon-filled !py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-center border-anime-purple shadow-neon-purple text-white bg-anime-purple/30"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Simulate Auto-Failover
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: User Accounts Management */}
      {activeTab === 'users' && (
        <div className="anime-card p-5">
          <h3 className="font-bold text-sm text-anime-blue uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-anime-blue" />
            User Accounts Portal
          </h3>

          {loadingUsers ? (
            <div className="flex justify-center py-6"><RefreshCw className="w-6 h-6 text-anime-blue animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-anime-text">
                <thead className="text-[10px] text-anime-muted uppercase border-b border-slate-900 bg-anime-dark/40">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {usersList.map(usr => (
                    <tr key={usr.id} className="hover:bg-anime-cardHover/40">
                      <td className="py-3.5 px-4 flex items-center gap-2.5">
                        <img 
                          src={usr.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                          alt={usr.username} 
                          className="w-7 h-7 rounded-lg object-cover"
                        />
                        <span className="font-bold text-anime-blue">{usr.username}</span>
                      </td>
                      <td className="py-3.5 px-4 text-anime-muted">{usr.email}</td>
                      <td className="py-3.5 px-4 uppercase font-bold text-anime-purple text-[10px]">{usr.role}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${usr.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : usr.status === 'blocked' ? 'bg-anime-red/10 text-anime-red border border-anime-red/20 shadow-neon-red' : 'bg-anime-orange/10 text-anime-orange border border-anime-orange/20'}`}>
                          {usr.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-anime-muted">{new Date(usr.created_at).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4 flex justify-center gap-2">
                        {usr.id !== user?.id && (
                          <>
                            {usr.status !== 'blocked' && (
                              <button
                                onClick={() => handleUpdateStatus(usr.id, 'blocked')}
                                className="px-2 py-1 bg-anime-red/10 text-anime-red hover:bg-anime-red hover:text-white rounded font-bold text-[10px] transition-colors border border-anime-red/20"
                              >
                                Block
                              </button>
                            )}
                            {usr.status !== 'suspended' && (
                              <button
                                onClick={() => handleUpdateStatus(usr.id, 'suspended')}
                                className="px-2 py-1 bg-anime-orange/10 text-anime-orange hover:bg-anime-orange hover:text-white rounded font-bold text-[10px] transition-colors border border-anime-orange/20"
                              >
                                Suspend
                              </button>
                            )}
                            {usr.status !== 'active' && (
                              <button
                                onClick={() => handleUpdateStatus(usr.id, 'active')}
                                className="px-2 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded font-bold text-[10px] transition-colors border border-emerald-500/20"
                              >
                                Reactivate
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Abuse Reports moderation queue */}
      {activeTab === 'reports' && (
        <div className="anime-card p-5">
          <h3 className="font-bold text-sm text-anime-pink uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-anime-pink animate-bounce" />
            Abuse Moderation Queue
          </h3>

          {loadingReports ? (
            <div className="flex justify-center py-6"><RefreshCw className="w-6 h-6 text-anime-pink animate-spin" /></div>
          ) : reportsQueue.length === 0 ? (
            <p className="text-center text-xs text-anime-muted py-6">All timelines clear. No reported content found!</p>
          ) : (
            <div className="flex flex-col gap-4">
              {reportsQueue.map(rep => (
                <div key={rep.id} className="p-4 bg-anime-dark/70 rounded-xl border border-slate-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="text-xs flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-anime-pink/20 text-anime-pink border border-anime-pink/30 shadow-neon-pink">
                        {rep.reason.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-anime-muted">Report #{rep.id} filed by <strong>{rep.reporter_username}</strong></span>
                    </div>

                    <p className="text-anime-text italic bg-anime-card/85 p-3 rounded-lg border border-slate-800/80 my-2 text-xs">
                      "{rep.content_excerpt}"
                    </p>

                    <span className="text-[10px] text-anime-muted">Author: <strong className="text-anime-blue">{rep.content_author}</strong></span>
                  </div>

                  <div className="flex gap-2 text-[10px]">
                    {rep.post_id && (
                      <button
                        onClick={() => handleDeletePost(rep.post_id)}
                        className="px-3 py-1.5 bg-anime-red text-white hover:brightness-110 rounded-lg font-bold flex items-center gap-1 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Post
                      </button>
                    )}
                    {rep.comment_id && (
                      <button
                        onClick={() => handleDeleteComment(rep.comment_id)}
                        className="px-3 py-1.5 bg-anime-red text-white hover:brightness-110 rounded-lg font-bold flex items-center gap-1 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Comment
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const targetUser = usersList.find(u => u.username === rep.content_author);
                        if (targetUser) handleUpdateStatus(targetUser.id, 'blocked');
                        else alert('Could not resolve author ID.');
                      }}
                      className="px-3 py-1.5 border border-slate-850 hover:bg-slate-900 rounded-lg text-anime-muted font-bold flex items-center gap-1 transition-all"
                    >
                      <Ban className="w-3.5 h-3.5 text-anime-muted" />
                      Block Author
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Moderator Action Logs */}
      {activeTab === 'logs' && (
        <div className="anime-card p-5">
          <h3 className="font-bold text-sm text-anime-purple uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-anime-purple" />
            Moderator Action Logs
          </h3>

          {loadingLogs ? (
            <div className="flex justify-center py-6"><RefreshCw className="w-6 h-6 text-anime-purple animate-spin" /></div>
          ) : modLogs.length === 0 ? (
            <p className="text-center text-xs text-anime-muted py-6">No moderator log entries recorded.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {modLogs.map(log => (
                <div key={log.id} className="p-3 bg-anime-dark/50 rounded-xl border border-slate-950/80 text-xs flex justify-between items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-anime-pink uppercase tracking-widest text-[9px]">{log.action}</strong>
                      <span className="text-[10px] text-anime-muted">Admin: <strong>{log.admin_username || 'System'}</strong></span>
                    </div>
                    <p className="text-anime-text text-[11px] mt-1">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-anime-muted whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
