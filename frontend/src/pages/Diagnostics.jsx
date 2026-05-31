import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { ShieldCheck, AlertTriangle, RefreshCw, HardDrive, Database, Network } from 'lucide-react';

const Diagnostics = () => {
  const [apiUrl, setApiUrl] = useState(api.defaults.baseURL);
  const [healthStatus, setHealthStatus] = useState('checking'); // 'checking', 'online', 'offline'
  const [healthResult, setHealthResult] = useState(null);
  const [supabaseConnected, setSupabaseConnected] = useState('checking'); // 'checking', 'connected', 'mock', 'disconnected'
  const [authReachable, setAuthReachable] = useState('checking'); // 'checking', 'reachable', 'unreachable'
  const [authResult, setAuthResult] = useState(null);
  const [logOutput, setLogOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    setHealthStatus('checking');
    setSupabaseConnected('checking');
    setAuthReachable('checking');
    setLogOutput('Starting diagnostics suite...\n\n');

    // Test 1: Health Check Endpoint
    try {
      setLogOutput(prev => prev + `[Test 1] Pinging health check endpoint at: ${apiUrl}/health...\n`);
      const res = await api.get('/health');
      setHealthStatus('online');
      setHealthResult(res.data);
      
      const dbMode = res.data.databaseMode || 'Unknown';
      setLogOutput(prev => prev + `[SUCCESS] Health endpoint responds 200 OK.\nResponse: ${JSON.stringify(res.data, null, 2)}\n\n`);
      
      if (dbMode === 'Supabase PostgreSQL' || dbMode.includes('Supabase')) {
        setSupabaseConnected('connected');
      } else {
        setSupabaseConnected('mock');
      }
    } catch (err) {
      setHealthStatus('offline');
      setSupabaseConnected('disconnected');
      console.error('Diagnostics - Health check error:', err);
      let errorDetail = '';
      if (err.response) {
        errorDetail = `Status: ${err.response.status}\nData: ${JSON.stringify(err.response.data)}`;
      } else if (err.request) {
        errorDetail = `Request sent but no response received. Preflight CORS block or server unreachable.`;
      } else {
        errorDetail = err.message;
      }
      setLogOutput(prev => prev + `[FAILURE] Health endpoint unreachable.\nError Details:\n${errorDetail}\n\nStack Trace:\n${err.stack || 'No stack trace available'}\n\n`);
    }

    // Test 2: Auth Login Endpoint bad request check
    try {
      setLogOutput(prev => prev + `[Test 2] Pinging auth login endpoint at: ${apiUrl}/auth/login...\n`);
      // Sending blank POST request which should return 400 Bad Request if reachable
      const res = await api.post('/auth/login', {});
      setAuthReachable('reachable');
      setAuthResult(res.data);
      setLogOutput(prev => prev + `[SUCCESS] Auth login endpoint reachable.\nResponse: ${JSON.stringify(res.data, null, 2)}\n\n`);
    } catch (err) {
      if (err.response && err.response.status === 400) {
        setAuthReachable('reachable');
        setAuthResult(err.response.data);
        setLogOutput(prev => prev + `[SUCCESS] Auth login endpoint reachable (returned expected 400 Bad Request due to empty payload).\nResponse: ${JSON.stringify(err.response.data, null, 2)}\n\n`);
      } else {
        setAuthReachable('unreachable');
        console.error('Diagnostics - Auth check error:', err);
        let errorDetail = '';
        if (err.response) {
          errorDetail = `Status: ${err.response.status}\nData: ${JSON.stringify(err.response.data)}`;
        } else if (err.request) {
          errorDetail = `Preflight preflight CORS blocked or server offline.`;
        } else {
          errorDetail = err.message;
        }
        setLogOutput(prev => prev + `[FAILURE] Auth login endpoint unreachable.\nError Details:\n${errorDetail}\n\nStack Trace:\n${err.stack || 'No stack trace available'}\n\n`);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="min-h-screen bg-anime-dark cyber-grid p-6 text-anime-text flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center border-b border-purple-500/20 pb-4">
        <div>
          <h1 className="text-3xl font-black italic bg-gradient-to-r from-anime-blue to-anime-pink bg-clip-text text-transparent uppercase tracking-wider">
            Diagnostics Suite
          </h1>
          <p className="text-xs text-anime-muted mt-1">Deep network connectivity and backend integration diagnostics</p>
        </div>
        <button
          onClick={runTests}
          disabled={loading}
          className="btn-neon-blue !py-2 !px-4 flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Test Connection
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Status gauges card */}
        <div className="anime-card flex flex-col gap-4">
          <h2 className="text-md font-bold uppercase tracking-wider border-b border-slate-900/60 pb-2 text-anime-purple">System Statuses</h2>
          
          <div className="flex items-center justify-between text-xs p-2 border-b border-slate-900/40">
            <span className="text-anime-muted flex items-center gap-1.5"><Network className="w-4 h-4" /> API Gateway URL</span>
            <span className="font-mono text-anime-pink select-all">{apiUrl}</span>
          </div>

          <div className="flex items-center justify-between text-xs p-2 border-b border-slate-900/40">
            <span className="text-anime-muted flex items-center gap-1.5"><HardDrive className="w-4 h-4" /> Backend Server Reachable</span>
            <span>
              {healthStatus === 'checking' ? (
                <span className="text-amber-400">CHECKING...</span>
              ) : healthStatus === 'online' ? (
                <span className="text-emerald-400 font-bold">YES (ONLINE)</span>
              ) : (
                <span className="text-anime-red font-bold">NO (OFFLINE)</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs p-2 border-b border-slate-900/40">
            <span className="text-anime-muted flex items-center gap-1.5"><Database className="w-4 h-4" /> Supabase Connection</span>
            <span>
              {supabaseConnected === 'checking' ? (
                <span className="text-amber-400">CHECKING...</span>
              ) : supabaseConnected === 'connected' ? (
                <span className="text-emerald-400 font-bold">YES (LIVE POSTGRESQL)</span>
              ) : supabaseConnected === 'mock' ? (
                <span className="text-anime-purple font-bold">YES (LOCAL MOCK DB)</span>
              ) : (
                <span className="text-anime-red font-bold">NO (DISCONNECTED)</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs p-2">
            <span className="text-anime-muted flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Auth Endpoints Active</span>
            <span>
              {authReachable === 'checking' ? (
                <span className="text-amber-400">CHECKING...</span>
              ) : authReachable === 'reachable' ? (
                <span className="text-emerald-400 font-bold">YES (REACHABLE)</span>
              ) : (
                <span className="text-anime-red font-bold">NO (UNREACHABLE)</span>
              )}
            </span>
          </div>
        </div>

        {/* Quick troubleshooting tips */}
        <div className="anime-card flex flex-col gap-3">
          <h2 className="text-md font-bold uppercase tracking-wider border-b border-slate-900/60 pb-2 text-anime-pink">Quick Fix Guide</h2>
          <div className="text-xs text-anime-muted flex flex-col gap-2 leading-relaxed">
            <p className="text-anime-text font-semibold flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-500" /> Receiving CORS / Preflight Errors?</p>
            <p>Ensure that the backend cors allowedHeaders allows `Bypass-Tunnel-Reminder`. All origins and headers have been provisioned in the backend server config.</p>
            <p className="text-anime-text font-semibold flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-500" /> Supabase Disconnected?</p>
            <p>Check that `SUPABASE_DB_URL` is set in Vercel project environment variables. If missing, backend auto-fails over to memory-persistent Local Mock DB.</p>
          </div>
        </div>

      </div>

      {/* Logging Console panel */}
      <div className="anime-card flex-1 flex flex-col gap-3 p-4">
        <h2 className="text-md font-bold uppercase tracking-wider border-b border-slate-900/60 pb-2 text-anime-blue">Console Logs</h2>
        <textarea
          readOnly
          value={logOutput}
          className="flex-1 w-full bg-slate-950 border border-slate-900 rounded-xl p-4 font-mono text-[10px] text-emerald-400 focus:outline-none focus:border-anime-blue/30 leading-normal min-h-[300px]"
        />
      </div>

      <div className="flex justify-between items-center mt-2">
        <button
          onClick={() => { window.location.hash = ''; window.location.reload(); }}
          className="btn-neon-blue !py-2.5 !px-6 text-xs font-bold uppercase"
        >
          Go Back
        </button>
        <span className="text-[10px] text-anime-muted font-bold tracking-widest uppercase">NaruBook Diagnostics v1.2</span>
      </div>
    </div>
  );
};

export default Diagnostics;
