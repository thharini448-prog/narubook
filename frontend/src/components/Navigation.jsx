import React, { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Home, User, Bell, LogOut, ShieldAlert, Search, Flame, Heart, MessageSquare, UserCheck } from 'lucide-react';

const Navigation = ({ currentView, setCurrentView, onSearchTriggered }) => {
  const { user, profile, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  // Fetch notifications list
  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
      setUnreadCount(res.data.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Error fetching notifications:', err.message);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll notifications every 15 seconds for live feel
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Click outside handlers to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && unreadCount > 0) {
      try {
        await api.post('/notifications/read');
        setUnreadCount(0);
        // Refresh local items to marked read
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch (err) {
        console.error('Failed to clear notifications:', err.message);
      }
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchTriggered(searchQuery.trim());
      setCurrentView('search');
    }
  };

  const renderNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return <Flame className="w-5 h-5 text-anime-pink animate-pulse" />;
      case 'comment':
        return <MessageSquare className="w-5 h-5 text-anime-blue" />;
      case 'follow':
        return <UserCheck className="w-5 h-5 text-anime-purple" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const getNotificationText = (notif) => {
    switch (notif.type) {
      case 'like':
        return <span><strong>{notif.sender_username}</strong> reacted fire to your post.</span>;
      case 'comment':
        return <span><strong>{notif.sender_username}</strong> commented on your post.</span>;
      case 'follow':
        return <span><strong>{notif.sender_username}</strong> followed you!</span>;
      default:
        return <span>Activity from {notif.sender_username}</span>;
    }
  };

  return (
    <nav className="sticky top-0 z-40 w-full bg-anime-dark/95 border-b border-purple-500/20 backdrop-blur-md px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Left Side: Brand Logo */}
        <div 
          onClick={() => { setCurrentView('feed'); setSearchQuery(''); }}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-neon-gradient p-0.5 flex items-center justify-center shadow-neon-glow">
            <span className="text-xl font-black text-white italic">NB</span>
          </div>
          <span className="text-2xl font-black italic bg-gradient-to-r from-anime-blue via-anime-purple to-anime-pink bg-clip-text text-transparent hidden sm:block">
            NaruBook
          </span>
        </div>

        {/* Center: Search Engine input */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Search fans, posts, or tags (e.g. Naruto)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-anime-card/90 border border-slate-800/80 rounded-full px-5 py-2 pl-12 text-sm text-anime-text placeholder-anime-muted focus:outline-none focus:border-anime-blue focus:ring-1 focus:ring-anime-blue/20"
            />
            <Search className="w-4 h-4 text-anime-muted absolute left-4 top-1/2 transform -translate-y-1/2" />
          </div>
          {searchQuery && (
            <button type="submit" className="hidden">Search</button>
          )}
        </form>

        {/* Right Side: Action Icons */}
        <div className="flex items-center gap-3">
          
          {/* Timeline Feed link */}
          <button
            onClick={() => setCurrentView('feed')}
            title="Timeline Feed"
            className={`p-2.5 rounded-xl transition-all duration-200 hover:bg-slate-800/50 ${currentView === 'feed' ? 'text-anime-blue bg-anime-blue/10 border border-anime-blue/20' : 'text-slate-400'}`}
          >
            <Home className="w-5 h-5" />
          </button>

          {/* Direct Messages link */}
          <button
            onClick={() => setCurrentView('messages')}
            title="Direct Messages"
            className={`p-2.5 rounded-xl transition-all duration-200 hover:bg-slate-800/50 ${currentView === 'messages' ? 'text-anime-purple bg-anime-purple/10 border border-anime-purple/20' : 'text-slate-400'}`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* Admin Dashboard Shield */}
          {user?.role === 'admin' && (
            <button
              onClick={() => setCurrentView('admin')}
              title="Admin Mod Dashboard"
              className={`p-2.5 rounded-xl transition-all duration-200 hover:bg-slate-800/50 ${currentView === 'admin' ? 'text-anime-pink bg-anime-pink/10 border border-anime-pink/20' : 'text-slate-400'}`}
            >
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </button>
          )}

          {/* Real-time Notifications Bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleNotificationClick}
              title="Notifications"
              className={`p-2.5 rounded-xl transition-all duration-200 hover:bg-slate-800/50 relative ${showNotifications ? 'text-anime-purple bg-anime-purple/10 border border-anime-purple/20' : 'text-slate-400'}`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-anime-pink text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-anime-dark shadow-neon-pink">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 max-h-96 overflow-y-auto bg-anime-card border border-purple-500/25 rounded-2xl p-2 shadow-2xl z-50 backdrop-blur-lg">
                <div className="px-3 py-2 border-b border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-sm text-anime-purple">Activities</span>
                  <span className="text-[10px] text-anime-muted">Click bell to clear</span>
                </div>
                
                <div className="divide-y divide-slate-900/60 mt-1">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-anime-muted">No recent notifications.</div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                          setShowNotifications(false);
                          if (n.post_id) {
                            // View specific post in timeline, can trigger filter or focus
                          } else {
                            setCurrentView(`profile-${n.sender_id}`);
                          }
                        }}
                        className={`flex gap-3 p-3 rounded-lg hover:bg-anime-cardHover/80 cursor-pointer transition-colors ${!n.is_read ? 'bg-anime-purple/5' : ''}`}
                      >
                        <img 
                          src={n.sender_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                          alt={n.sender_username} 
                          className="w-9 h-9 rounded-full object-cover border border-slate-800"
                        />
                        <div className="flex-1 text-xs">
                          <p className="text-anime-text leading-tight">{getNotificationText(n)}</p>
                          <span className="text-[10px] text-anime-muted block mt-1">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center">
                          {renderNotificationIcon(n.type)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile avatar dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 focus:outline-none"
            >
              <img
                src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={user?.username}
                className="w-10 h-10 rounded-xl object-cover border-2 border-anime-blue hover:border-anime-pink transition-all duration-300"
              />
            </button>

            {/* Profile Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-48 bg-anime-card border border-slate-800/80 rounded-2xl p-2 shadow-2xl z-50">
                <div className="px-3 py-2 border-b border-slate-800 mb-1">
                  <p className="text-xs font-bold truncate text-anime-blue">{user?.username}</p>
                  <p className="text-[10px] text-anime-muted truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); setCurrentView('my-profile'); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-anime-cardHover text-anime-text hover:text-anime-blue transition-all duration-150 flex items-center gap-2"
                >
                  <User className="w-3.5 h-3.5" />
                  My Profile
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); logout(); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-anime-cardHover text-anime-pink transition-all duration-150 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </nav>
  );
};

export default Navigation;
