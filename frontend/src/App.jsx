import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navigation from './components/Navigation';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import Chat from './pages/Chat';
import { KeyRound, Mail, UserPlus, LogIn, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

const AuthPortal = () => {
  const { login, signup, resetPassword, error, loading } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login', 'signup', 'reset'
  
  // Inputs
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');

    if (authMode === 'login') {
      const res = await login(email, password);
      if (res.success) {
        // Success logged in
      }
    } else if (authMode === 'signup') {
      const res = await signup(username, email, password);
      if (res.success) {
        alert('Signup completed successfully! Welcome to NaruBook.');
      }
    } else if (authMode === 'reset') {
      const res = await resetPassword(email, password); // takes email & new password to simulate instantly
      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          setAuthMode('login');
          setPassword('');
          setSuccessMessage('');
        }, 3000);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-anime-dark cyber-grid relative overflow-hidden">
      {/* Dynamic Background glowing circles */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-anime-purple/10 rounded-full blur-[100px] pulse-glow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-anime-blue/10 rounded-full blur-[100px] pulse-glow"></div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden border border-purple-500/20 bg-anime-card/85 backdrop-blur-xl shadow-2xl relative z-10">
        
        {/* Left pane: branding and intro */}
        <div className="p-8 flex flex-col justify-center bg-gradient-to-br from-anime-dark to-anime-cardHover border-r border-slate-900/60 relative">
          <div className="absolute top-6 left-6 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neon-gradient p-0.5 flex items-center justify-center">
              <span className="text-sm font-black text-white italic">NB</span>
            </div>
            <span className="text-md font-black text-anime-text italic">NaruBook</span>
          </div>

          <div className="my-8">
            <h1 className="text-4xl font-black italic bg-gradient-to-r from-anime-blue via-anime-purple to-anime-pink bg-clip-text text-transparent leading-tight uppercase tracking-wider">
              Enter The <br/> Fandom Universe
            </h1>
            <p className="text-xs text-anime-muted mt-3 leading-relaxed max-w-sm">
              Connect with fellow Otakus, share your favorite anime clips, debate trending manga discussions, and build your epic fandom timeline.
            </p>
          </div>

          <div className="mt-4 flex gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-anime-blue">
              <ShieldCheck className="w-4 h-4" />
              <span>Full Moderation</span>
            </div>
            <div className="flex items-center gap-1.5 text-anime-pink">
              <KeyRound className="w-4 h-4" />
              <span>Secure Authentication</span>
            </div>
          </div>
        </div>

        {/* Right pane: Auth forms */}
        <div className="p-8 flex flex-col justify-center">
          <h2 className="text-2xl font-black text-anime-text mb-1 uppercase tracking-wider flex items-center gap-2">
            {authMode === 'login' ? (
              <>
                <LogIn className="w-5 h-5 text-anime-blue" />
                Otaku Login
              </>
            ) : authMode === 'signup' ? (
              <>
                <UserPlus className="w-5 h-5 text-anime-purple" />
                Sign Up Fandom
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 text-anime-pink animate-spin" />
                Reset Password
              </>
            )}
          </h2>
          <p className="text-xs text-anime-muted mb-6">
            {authMode === 'login' ? 'Welcome back! Log in to join the timelines.' : 
             authMode === 'signup' ? 'Create a secure account and profile today!' : 
             'Enter details to reset password instantly.'}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* Error notifications */}
            {error && (
              <div className="p-3.5 bg-anime-red/10 border border-anime-red/30 rounded-xl flex items-center gap-2.5 text-xs text-anime-red">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success notifications */}
            {successMessage && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400">
                {successMessage}
              </div>
            )}

            {authMode === 'signup' && (
              <div>
                <label className="text-[10px] font-black uppercase text-anime-muted mb-1 block">Fandom Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NarutoUzumaki"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="anime-input text-xs"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] font-black uppercase text-anime-muted mb-1 block">Email Address</label>
              <input
                type="email"
                required
                placeholder="e.g. goku@dbz.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="anime-input text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-anime-muted mb-1 block">
                {authMode === 'reset' ? 'New Secure Password' : 'Password'}
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="anime-input text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-neon-filled w-full mt-2 font-bold py-3 text-xs uppercase flex items-center justify-center gap-2 shadow-neon-glow"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : authMode === 'login' ? (
                'Login to NaruBook'
              ) : authMode === 'signup' ? (
                'Launch Account'
              ) : (
                'Reset Account Now'
              )}
            </button>
          </form>

          {/* Toggle triggers */}
          <div className="mt-6 pt-6 border-t border-slate-900/60 flex flex-col gap-2.5 text-center text-xs">
            {authMode === 'login' ? (
              <>
                <p className="text-anime-muted">
                  New to NaruBook?{' '}
                  <span onClick={() => { setAuthMode('signup'); setPassword(''); }} className="text-anime-purple font-bold hover:underline cursor-pointer">
                    Sign Up
                  </span>
                </p>
                <p className="text-anime-muted">
                  Forgot your password?{' '}
                  <span onClick={() => { setAuthMode('reset'); setPassword(''); }} className="text-anime-pink font-bold hover:underline cursor-pointer">
                    Reset Password
                  </span>
                </p>
              </>
            ) : authMode === 'signup' ? (
              <p className="text-anime-muted">
                Already have an account?{' '}
                <span onClick={() => { setAuthMode('login'); setPassword(''); }} className="text-anime-blue font-bold hover:underline cursor-pointer">
                  Log In
                </span>
              </p>
            ) : (
              <p className="text-anime-muted">
                Remember your password?{' '}
                <span onClick={() => { setAuthMode('login'); setPassword(''); }} className="text-anime-blue font-bold hover:underline cursor-pointer">
                  Back to Login
                </span>
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

const MainLayout = () => {
  const [currentView, setCurrentView] = useState('feed'); // 'feed', 'my-profile', 'admin', 'search', 'profile-X'
  const [searchQuery, setSearchQuery] = useState('');

  const renderActiveView = () => {
    if (currentView === 'feed') {
      return <Feed onSelectUser={(uid) => setCurrentView(`profile-${uid}`)} />;
    }
    
    if (currentView === 'search') {
      return <Feed currentSearchQuery={searchQuery} onSelectUser={(uid) => setCurrentView(`profile-${uid}`)} />;
    }

    if (currentView === 'my-profile') {
      return <Profile onBackToFeed={() => setCurrentView('feed')} onMessageClick={(uid) => setCurrentView(`messages-${uid}`)} onSelectUser={(uid) => setCurrentView(`profile-${uid}`)} />;
    }

    if (currentView.startsWith('profile-')) {
      const targetUid = parseInt(currentView.split('-')[1]);
      return <Profile targetUserId={targetUid} onBackToFeed={() => setCurrentView('feed')} onMessageClick={(uid) => setCurrentView(`messages-${uid}`)} onSelectUser={(uid) => setCurrentView(`profile-${uid}`)} />;
    }

    if (currentView.startsWith('messages')) {
      const parts = currentView.split('-');
      const initialChatPartnerId = parts[1] ? parseInt(parts[1]) : null;
      return <Chat initialChatPartnerId={initialChatPartnerId} onBackToFeed={() => setCurrentView('feed')} />;
    }

    if (currentView === 'admin') {
      return <AdminDashboard />;
    }

    return <Feed onSelectUser={(uid) => setCurrentView(`profile-${uid}`)} />;
  };

  return (
    <div className="min-h-screen bg-anime-dark pb-12">
      <Navigation 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        onSearchTriggered={(q) => {
          setSearchQuery(q);
          setCurrentView('search');
        }}
      />
      {renderActiveView()}
    </div>
  );
};

const AppContent = () => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-anime-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-t-anime-blue border-b-anime-pink rounded-full animate-spin"></div>
          <span className="text-xs uppercase tracking-widest font-black text-anime-purple animate-pulse">Launching NaruBook...</span>
        </div>
      </div>
    );
  }

  return token ? <MainLayout /> : <AuthPortal />;
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
