import React, { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Send, Search, MessageSquare, ChevronLeft, ImageOff, User } from 'lucide-react';

const Chat = ({ initialChatPartnerId = null, onBackToFeed }) => {
  const { user: currentUser } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activePartner, setActivePartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);

  // 1. Fetch available chat partners (active users)
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await api.get('/users/list');
      setUsers(res.data);
      
      // If there's an initial chat partner passed via props, select them!
      if (initialChatPartnerId) {
        const partner = res.data.find(u => u.id === initialChatPartnerId);
        if (partner) {
          setActivePartner(partner);
        }
      } else if (res.data.length > 0 && !activePartner) {
        // Default to first user in list
        setActivePartner(res.data[0]);
      }
    } catch (err) {
      console.error('Error fetching users for chat:', err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [initialChatPartnerId]);

  // 2. Fetch conversation history for active partner
  const fetchConversation = async (partnerId) => {
    if (!partnerId) return;
    try {
      const res = await api.get(`/messages/${partnerId}`);
      setMessages(res.data);
    } catch (err) {
      console.error('Error fetching conversation messages:', err.message);
    }
  };

  // Poll conversation history every 3 seconds for mock real-time feel
  useEffect(() => {
    if (!activePartner) return;
    
    // Initial fetch
    setLoadingMessages(true);
    fetchConversation(activePartner.id).finally(() => setLoadingMessages(false));

    const interval = setInterval(() => {
      fetchConversation(activePartner.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [activePartner]);

  // Auto-scroll to bottom of messages container
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. Send message handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!activePartner || !messageInput.trim() || sending) return;

    const textContent = messageInput.trim();

    // STRICT TEXT VALIDATION: Reject any image/video files, attachments, or tags
    const hasImage = /!\[.*\]\(.*\)/.test(textContent) || /<img/i.test(textContent) || textContent.startsWith('data:image');
    if (hasImage) {
      alert('Only plain text messages are allowed in direct messages. Media links and images are prohibited.');
      return;
    }

    try {
      setSending(true);
      const res = await api.post('/messages', {
        recipient_id: activePartner.id,
        content: textContent
      });

      // Optimistically add message to state immediately for responsiveness
      setMessages(prev => [...prev, res.data]);
      setMessageInput('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.favorite_anime && u.favorite_anime.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      
      {/* Mobile back trigger */}
      <button 
        onClick={onBackToFeed}
        className="flex items-center gap-1.5 text-xs text-anime-pink hover:underline mb-4 font-bold md:hidden"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to timelines
      </button>

      <div className="grid grid-cols-1 md:grid-cols-12 rounded-2xl overflow-hidden border border-purple-500/20 bg-anime-card/90 backdrop-blur-xl h-[calc(100vh-140px)] min-h-[550px] shadow-2xl relative z-10">
        
        {/* Left Pane: Chat Partners Sidebar List */}
        <div className="md:col-span-4 border-r border-slate-900/60 flex flex-col h-full bg-gradient-to-br from-anime-dark to-anime-cardHover/20">
          
          <div className="p-4 border-b border-slate-900/60 flex flex-col gap-3">
            <h2 className="text-md font-black text-white italic uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-anime-purple animate-pulse" />
              Otaku Channels
            </h2>
            
            {/* Search filter input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Find fans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-anime-dark/95 border border-slate-800 rounded-xl px-4 py-2 pl-9 text-xs text-anime-text placeholder-anime-muted focus:outline-none focus:border-anime-blue focus:ring-1 focus:ring-anime-blue/20"
              />
              <Search className="w-3.5 h-3.5 text-anime-muted absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
          </div>

          {/* List panel */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-950/20">
            {loadingUsers ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-t-anime-blue border-b-anime-pink rounded-full animate-spin"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-xs text-anime-muted">No other fans found.</div>
            ) : (
              filteredUsers.map(u => {
                const isActive = activePartner?.id === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => setActivePartner(u)}
                    className={`flex items-center gap-3 p-3.5 cursor-pointer transition-all duration-150 hover:bg-anime-purple/5 ${isActive ? 'bg-anime-purple/10 border-l-4 border-l-anime-purple' : ''}`}
                  >
                    <img
                      src={u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={u.username}
                      className={`w-10 h-10 rounded-xl object-cover border-2 ${isActive ? 'border-anime-purple shadow-neon-purple' : 'border-slate-800'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="font-bold text-xs text-anime-text truncate">{u.username}</span>
                        <span className="text-[9px] uppercase font-black text-anime-purple">{u.role}</span>
                      </div>
                      <p className="text-[10px] text-anime-muted truncate">{u.bio || 'New Otaku on board!'}</p>
                      {u.favorite_anime && u.favorite_anime !== 'None' && (
                        <span className="text-[8px] bg-anime-pink/10 border border-anime-pink/20 text-anime-pink font-bold px-1.5 py-0.5 rounded mt-1.5 inline-block">
                          {u.favorite_anime}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Direct Conversations Panel */}
        <div className="md:col-span-8 flex flex-col h-full bg-anime-dark/25">
          {activePartner ? (
            <>
              {/* Active Conversation Header */}
              <div className="p-4 border-b border-slate-900/60 flex items-center justify-between bg-anime-card/45 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <img
                    src={activePartner.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={activePartner.username}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-800 shadow-neon-blue"
                  />
                  <div>
                    <h3 className="font-bold text-sm text-anime-blue leading-tight hover:underline cursor-pointer">
                      {activePartner.username}
                    </h3>
                    <p className="text-[10px] text-anime-muted truncate max-w-md mt-0.5">{activePartner.bio || 'New Otaku on board!'}</p>
                  </div>
                </div>
              </div>

              {/* Chat Messages List Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="w-8 h-8 border-4 border-t-anime-blue border-b-anime-pink rounded-full animate-spin"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-anime-muted gap-2">
                    <MessageSquare className="w-10 h-10 text-slate-700 animate-bounce" />
                    <p className="text-xs">No direct messages exchanged yet.</p>
                    <p className="text-[10px] text-anime-muted/80">Start the conversation by sending a text message below!</p>
                  </div>
                ) : (
                  messages.map(m => {
                    const isMe = m.sender_id === currentUser?.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex gap-2.5 items-end max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                      >
                        {!isMe && (
                          <img
                            src={activePartner.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                            alt={activePartner.username}
                            className="w-7 h-7 rounded-lg object-cover border border-slate-800"
                          />
                        )}
                        <div className="flex flex-col gap-0.5">
                          <div
                            className={`p-3 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed shadow-lg ${isMe ? 'bg-anime-blue/10 border border-anime-blue/20 text-white rounded-br-none shadow-neon-blue' : 'bg-anime-purple/10 border border-anime-purple/20 text-white rounded-bl-none shadow-neon-purple'}`}
                          >
                            {m.content}
                          </div>
                          <span className={`text-[8px] text-anime-muted block mt-0.5 ${isMe ? 'text-right' : 'text-left'}`}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Typing Form Footer */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-900/60 bg-anime-card/30 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder={`Message ${activePartner.username}...`}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="flex-1 bg-anime-dark/95 border border-slate-800 rounded-xl px-4 py-3 text-xs text-anime-text placeholder-anime-muted focus:outline-none focus:border-anime-purple focus:ring-1 focus:ring-anime-purple/20"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || sending}
                    className="bg-neon-gradient p-3 rounded-xl flex items-center justify-center text-white hover:brightness-110 hover:shadow-neon-purple transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Warning message check strictly no media */}
                <div className="flex items-center gap-1.5 text-[9px] text-anime-muted uppercase font-black px-1.5 tracking-wider">
                  <ImageOff className="w-3 h-3 text-anime-pink animate-pulse" />
                  <span>Text Messaging Only (No Images, Videos, or File Attachments)</span>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-anime-muted gap-3">
              <MessageSquare className="w-12 h-12 text-slate-800 animate-pulse" />
              <h3 className="font-bold text-sm text-anime-purple uppercase tracking-widest">Select Conversation</h3>
              <p className="text-xs max-w-xs">Pick an Otaku fan from the sidebar channels to begin direct secure text messaging.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Chat;
