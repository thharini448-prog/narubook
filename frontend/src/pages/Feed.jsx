import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { 
  Flame, Heart, MessageSquare, AlertTriangle, Trash2, Send, Image, Link, 
  HelpCircle, Eye, RefreshCw, Star, Tag, ChevronRight, Edit2, CornerDownRight 
} from 'lucide-react';

const REACTION_TYPES = [
  { name: 'like', emoji: '👍', color: 'text-anime-blue bg-anime-blue/10 border-anime-blue/20' },
  { name: 'heart', emoji: '❤️', color: 'text-anime-pink bg-anime-pink/10 border-anime-pink/20' },
  { name: 'fire', emoji: '🔥', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
  { name: 'wow', emoji: '😲', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' }
];

const ANIME_RECOMMENDATIONS = [
  { id: 1, title: 'Solo Leveling', rating: '9.1', genre: 'Action, Fantasy', image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop&q=80', desc: 'From weak hunter to world conqueror. Pure adrenaline!' },
  { id: 2, title: 'Demon Slayer', rating: '9.0', genre: 'Action, Supernatural', image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80', desc: 'Stunning animation, emotional family bonds, and epic blade battles.' },
  { id: 3, title: 'Jujutsu Kaisen', rating: '8.8', genre: 'Dark Fantasy, Action', image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80', desc: 'Sorcerers battling curses. Incredible combat choreography.' }
];

const Feed = ({ currentSearchQuery, onSelectUser }) => {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Post Creator State
  const [postText, setPostText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image'); // 'image', 'video', 'gif'
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);

  // Comments State (indexed by post ID)
  const [postComments, setPostComments] = useState({});
  const [activeCommentInput, setActiveCommentInput] = useState({});
  const [replyToCommentId, setReplyToCommentId] = useState({}); // comment ID mapping for nested replies
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState('');

  // Report Modal State
  const [reportingPost, setReportingPost] = useState(null);
  const [reportReason, setReportReason] = useState('spam');
  const [showReportModal, setShowReportModal] = useState(false);

  // Fetch all posts
  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/posts');
      setPosts(res.data);
    } catch (err) {
      console.error('Error fetching posts:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [currentSearchQuery]);

  // Handle direct file uploads (convert to Base64)
  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaUrl(reader.result); // Base64 encoding URL
        setMediaType('image');
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Post
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!postText.trim() && !mediaUrl) return;

    try {
      const res = await api.post('/posts', {
        content: postText,
        media_url: mediaUrl,
        media_type: mediaType
      });
      setPosts(prev => [res.data.post, ...prev]);
      
      // Reset State
      setPostText('');
      setMediaUrl('');
      setSelectedImageFile(null);
      setShowMediaInput(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create post.');
    }
  };

  // Delete Post
  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this anime post?')) return;
    try {
      await api.delete(`/posts/${postId}`);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete post.');
    }
  };

  // Reaction Liking Toggle
  const handleToggleReaction = async (postId, reactionName) => {
    try {
      const res = await api.post(`/posts/${postId}/like`, { reaction: reactionName });
      
      // Update post in status array
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            user_has_liked: res.data.user_has_liked,
            my_reaction: res.data.user_has_liked ? reactionName : null,
            likes_count: res.data.likes_count,
            reactions_breakdown: res.data.reactions_breakdown
          };
        }
        return p;
      }));
    } catch (err) {
      console.error('Failed to react:', err.message);
    }
  };

  // Load comments
  const toggleComments = async (postId) => {
    if (postComments[postId]) {
      // Toggle close
      setPostComments(prev => {
        const copy = { ...prev };
        delete copy[postId];
        return copy;
      });
    } else {
      // Toggle open & load
      try {
        const res = await api.get(`/comments/${postId}`);
        setPostComments(prev => ({ ...prev, [postId]: res.data }));
      } catch (err) {
        console.error('Failed to load comments:', err.message);
      }
    }
  };

  // Submit Comment (Root or Nested)
  const handlePostComment = async (postId) => {
    const text = activeCommentInput[postId];
    if (!text || !text.trim()) return;

    const parentId = replyToCommentId[postId] || null;

    try {
      const res = await api.post(`/comments/${postId}`, {
        content: text,
        parent_id: parentId
      });

      // Reload comments list to render tree structure
      const commentsRes = await api.get(`/comments/${postId}`);
      setPostComments(prev => ({ ...prev, [postId]: commentsRes.data }));

      // Clear input
      setActiveCommentInput(prev => ({ ...prev, [postId]: '' }));
      setReplyToCommentId(prev => {
        const copy = { ...prev };
        delete copy[postId];
        return copy;
      });

      // Update local comment count in post lists
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return { ...p, comments_count: p.comments_count + 1 };
        }
        return p;
      }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit comment.');
    }
  };

  // Delete Comment
  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm('Delete comment?')) return;
    try {
      await api.delete(`/comments/${commentId}`);
      // Reload
      const res = await api.get(`/comments/${postId}`);
      setPostComments(prev => ({ ...prev, [postId]: res.data }));
      // Adjust counter
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return { ...p, comments_count: Math.max(0, p.comments_count - 1) };
        }
        return p;
      }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete comment.');
    }
  };

  // Edit Comment Submit
  const handleEditComment = async (postId, commentId) => {
    if (!editText.trim()) return;
    try {
      await api.put(`/comments/${commentId}`, { content: editText });
      setEditingCommentId(null);
      setEditText('');
      const res = await api.get(`/comments/${postId}`);
      setPostComments(prev => ({ ...prev, [postId]: res.data }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to edit comment.');
    }
  };

  // Handle reporting
  const handleOpenReportModal = (post) => {
    setReportingPost(post);
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    try {
      await api.post('/reports', {
        post_id: reportingPost.id,
        reason: reportReason
      });
      alert('Content reported. Administrators will moderate this shortly.');
      setShowReportModal(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to file report.');
    }
  };

  // Render Comment List Item (Recursive for nested replies)
  const renderComment = (comment, postId) => {
    const isOwner = comment.user_id === user?.id;
    const isAdmin = user?.role === 'admin';

    return (
      <div key={comment.id} className="group flex flex-col gap-1.5 mt-3 pl-2 border-l border-slate-800">
        <div className="flex gap-2.5 items-start">
          <img 
            src={comment.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
            alt={comment.username} 
            className="w-7 h-7 rounded-lg object-cover cursor-pointer"
            onClick={() => onSelectUser(comment.user_id)}
          />
          <div className="flex-1 bg-anime-dark/60 rounded-xl p-3 border border-slate-900">
            <div className="flex justify-between items-center mb-1">
              <span 
                className="font-bold text-xs text-anime-blue hover:underline cursor-pointer"
                onClick={() => onSelectUser(comment.user_id)}
              >
                {comment.username}
              </span>
              <span className="text-[9px] text-anime-muted">
                {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            {editingCommentId === comment.id ? (
              <div className="flex gap-2 mt-1">
                <input 
                  type="text" 
                  value={editText} 
                  onChange={(e) => setEditText(e.target.value)}
                  className="flex-1 bg-anime-dark border border-purple-500/30 rounded-lg px-2.5 py-1 text-xs outline-none"
                />
                <button 
                  onClick={() => handleEditComment(postId, comment.id)}
                  className="px-3 py-1 bg-anime-blue text-black text-xs font-bold rounded-lg"
                >
                  Save
                </button>
                <button 
                  onClick={() => setEditingCommentId(null)}
                  className="px-2 py-1 text-xs text-anime-muted"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p className="text-xs text-anime-text">{comment.content}</p>
            )}

            {/* Actions Bar */}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-anime-muted">
              <button 
                onClick={() => {
                  setReplyToCommentId(prev => ({ ...prev, [postId]: comment.id }));
                  setActiveCommentInput(prev => ({ ...prev, [postId]: `@${comment.username} ` }));
                }}
                className="hover:text-anime-blue font-semibold transition-colors"
              >
                Reply
              </button>
              {isOwner && (
                <button 
                  onClick={() => { setEditingCommentId(comment.id); setEditText(comment.content); }}
                  className="hover:text-anime-purple font-semibold transition-colors"
                >
                  Edit
                </button>
              )}
              {(isOwner || isAdmin) && (
                <button 
                  onClick={() => handleDeleteComment(postId, comment.id)}
                  className="hover:text-anime-pink font-semibold transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Render nested replies */}
        {comment.replies && comment.replies.map(reply => (
          <div key={reply.id} className="pl-6 flex gap-1 items-start mt-2">
            <CornerDownRight className="w-3.5 h-3.5 text-anime-muted mt-1 flex-shrink-0" />
            <div className="flex-1">
              {renderComment(reply, postId)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
      
      {/* 1. Left Sidebar: User Mini Card */}
      <div className="lg:col-span-1 hidden lg:block">
        <div className="anime-card sticky top-24">
          <div className="relative -mt-6 -mx-6 h-20 bg-cover bg-center rounded-t-xl" style={{ backgroundImage: `url(${profile?.banner_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600'})` }}>
            <div className="absolute inset-0 bg-anime-dark/45"></div>
          </div>
          <div className="flex flex-col items-center -mt-8 relative z-10">
            <img 
              src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
              alt={user?.username} 
              className="w-16 h-16 rounded-xl object-cover border-2 border-anime-blue shadow-neon-blue"
            />
            <h3 className="font-black text-anime-blue mt-3 text-center cursor-pointer hover:underline" onClick={() => onSelectUser(user.id)}>
              {user?.username}
            </h3>
            <span className="text-[10px] text-anime-pink font-black uppercase tracking-wider mt-0.5">{user?.role}</span>
            <p className="text-xs text-anime-muted text-center mt-3 line-clamp-2 px-1">
              {profile?.bio || 'Check out my profile for more!'}
            </p>
          </div>
          
          <div className="border-t border-slate-900/60 mt-4 pt-4 divide-y divide-slate-900/40 text-xs">
            <div className="flex justify-between py-2">
              <span className="text-anime-muted">Favorite Anime</span>
              <span className="font-semibold text-anime-text truncate max-w-[120px]">{profile?.favorite_anime || 'None'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-anime-muted">Followers</span>
              <span className="font-bold text-anime-purple">{profile?.followers_count || 0}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-anime-muted">Following</span>
              <span className="font-bold text-anime-blue">{profile?.following_count || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Middle Main Section: Timeline & Post Creator */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        
        {/* Post Creator Widget */}
        <div className="anime-card p-5 border-l-4 border-l-anime-blue">
          <form onSubmit={handleCreatePost} className="flex flex-col gap-4">
            <div className="flex gap-3">
              <img 
                src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                alt={user?.username} 
                className="w-10 h-10 rounded-xl object-cover border border-slate-800"
              />
              <textarea
                placeholder="What anime are you watching? Share your fandom! Use hashtags (#Naruto)..."
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                rows="2"
                className="flex-grow bg-transparent text-sm text-anime-text outline-none resize-none placeholder-anime-muted pt-1.5"
              />
            </div>

            {/* Media Attachment fields */}
            {showMediaInput && (
              <div className="bg-anime-dark/60 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-anime-purple uppercase tracking-wider">Embed Media</span>
                  <div className="flex gap-2 text-[10px]">
                    {['image', 'video', 'gif'].map(t => (
                      <button 
                        key={t}
                        type="button" 
                        onClick={() => setMediaType(t)}
                        className={`px-2 py-0.5 rounded ${mediaType === t ? 'bg-anime-purple text-white' : 'text-anime-muted bg-slate-900'}`}
                      >
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`Paste ${mediaType} URL (e.g. https://...)...`}
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className="flex-grow bg-anime-dark border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-anime-text focus:outline-none focus:border-anime-blue"
                  />
                </div>

                {mediaType === 'image' && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-anime-muted">Or upload direct file:</span>
                    <label className="cursor-pointer bg-slate-850 hover:bg-slate-800 border border-slate-700/85 px-3 py-1 rounded-lg text-[10px] text-anime-blue font-bold flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5" />
                      Choose File
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageFileChange} 
                        className="hidden" 
                      />
                    </label>
                    {selectedImageFile && <span className="text-[10px] text-anime-pink truncate max-w-[150px]">{selectedImageFile.name}</span>}
                  </div>
                )}

                {mediaUrl && (
                  <div className="relative rounded-lg overflow-hidden max-h-40 border border-slate-900">
                    <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={() => { setMediaUrl(''); setSelectedImageFile(null); }}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded-full text-anime-pink"
                    >
                      &times;
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center border-t border-slate-900/60 pt-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowMediaInput(!showMediaInput)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${showMediaInput ? 'text-anime-blue bg-anime-blue/5 border border-anime-blue/15' : 'text-anime-muted hover:text-anime-blue hover:bg-slate-900/40'}`}
                >
                  <Image className="w-4 h-4" />
                  Media
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMediaInput(true);
                    setMediaType('gif');
                    setMediaUrl('https://media.giphy.com/media/V8tD54CX95khy/giphy.gif'); // Preload default cute GIF
                  }}
                  className="flex items-center gap-1.5 text-xs text-anime-muted hover:text-anime-purple hover:bg-slate-900/40 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Flame className="w-4 h-4" />
                  Anime GIF
                </button>
              </div>

              <button
                type="submit"
                disabled={!postText.trim() && !mediaUrl}
                className="btn-neon-filled !px-4 !py-2 flex items-center gap-1.5 text-xs font-bold"
              >
                <Send className="w-3.5 h-3.5" />
                Publish
              </button>
            </div>
          </form>
        </div>

        {/* Loading Indicator */}
        {loading ? (
          <div className="flex justify-center py-10">
            <RefreshCw className="w-8 h-8 text-anime-purple animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="anime-card p-10 text-center flex flex-col items-center gap-3">
            <HelpCircle className="w-12 h-12 text-anime-muted" />
            <h3 className="font-bold text-lg">No timeline posts found</h3>
            <p className="text-xs text-anime-muted">Be the first to publish an anime topic or check your query!</p>
          </div>
        ) : (
          posts.map(post => {
            const isPostOwner = post.user_id === user?.id;
            const isAdmin = user?.role === 'admin';

            return (
              <div key={post.id} className="anime-card p-0 overflow-hidden">
                
                {/* Post Header */}
                <div className="p-5 flex justify-between items-start">
                  <div className="flex gap-3">
                    <img 
                      src={post.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                      alt={post.username} 
                      className="w-10 h-10 rounded-xl object-cover border border-slate-800 cursor-pointer"
                      onClick={() => onSelectUser(post.user_id)}
                    />
                    <div>
                      <h4 
                        className="font-bold text-sm text-anime-blue hover:underline cursor-pointer flex items-center gap-1"
                        onClick={() => onSelectUser(post.user_id)}
                      >
                        {post.username}
                        {post.user_id === 1 && (
                          <span className="bg-anime-pink/20 text-anime-pink text-[8px] font-black uppercase px-1 rounded border border-anime-pink/30">Mod</span>
                        )}
                      </h4>
                      <span className="text-[10px] text-anime-muted block mt-0.5">
                        {new Date(post.created_at).toLocaleDateString()} at {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleOpenReportModal(post)}
                      title="Report Abuse" 
                      className="p-1.5 rounded-lg text-anime-muted hover:text-anime-yellow hover:bg-slate-900 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </button>
                    {(isPostOwner || isAdmin) && (
                      <button 
                        onClick={() => handleDeletePost(post.id)}
                        title="Delete Post" 
                        className="p-1.5 rounded-lg text-anime-muted hover:text-anime-pink hover:bg-slate-900 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Post Content */}
                <div className="px-5 pb-4">
                  <p className="text-sm text-anime-text leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  
                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {post.tags.map((t, idx) => (
                        <span key={idx} className="text-[10px] font-black bg-anime-purple/10 text-anime-purple border border-anime-purple/20 px-2 py-0.5 rounded-md flex items-center gap-0.5 hover:shadow-neon-purple cursor-default">
                          <Tag className="w-2.5 h-2.5" />
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Media Attachment Viewer */}
                {post.media_url && (
                  <div className="border-y border-slate-900 relative bg-black max-h-96 overflow-hidden flex items-center justify-center">
                    {post.media_type === 'video' ? (
                      <video src={post.media_url} controls className="w-full max-h-96" />
                    ) : (
                      <img src={post.media_url} alt="Attachment" className="w-full max-h-96 object-contain" />
                    )}
                  </div>
                )}

                {/* Reactions Breakdown List */}
                {post.likes_count > 0 && (
                  <div className="px-5 py-2.5 border-b border-slate-900/60 bg-anime-dark/20 flex items-center justify-between text-xs text-anime-muted">
                    <div className="flex items-center gap-1.5">
                      <div className="flex -space-x-1.5">
                        {post.reactions_breakdown && Object.keys(post.reactions_breakdown).map(k => (
                          <span key={k} className="text-xs" title={`${k}: ${post.reactions_breakdown[k]}`}>
                            {REACTION_TYPES.find(r => r.name === k)?.emoji || '👍'}
                          </span>
                        ))}
                      </div>
                      <span className="font-semibold text-anime-text">{post.likes_count} reactions</span>
                    </div>
                    <span>{post.comments_count} comments</span>
                  </div>
                )}

                {/* Interactive Action Tray */}
                <div className="px-3 py-2 flex justify-between items-center border-t border-slate-950 bg-anime-dark/10">
                  
                  {/* Glowing Reactions Tray */}
                  <div className="relative group/tray">
                    <button
                      onClick={() => handleToggleReaction(post.id, post.my_reaction || 'like')}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all duration-200 ${post.user_has_liked ? 'text-anime-pink bg-anime-pink/5 border border-anime-pink/20 shadow-neon-pink' : 'text-anime-muted hover:text-anime-blue hover:bg-slate-900/40'}`}
                    >
                      <Flame className="w-4 h-4" />
                      {post.user_has_liked ? (post.my_reaction ? post.my_reaction.toUpperCase() : 'REACTED') : 'REACT'}
                    </button>

                    {/* Hidden Reactions Dropdown */}
                    <div className="absolute left-0 bottom-full mb-2 bg-anime-card border border-purple-500/20 rounded-full px-3 py-2 flex gap-2.5 shadow-2xl scale-0 group-hover/tray:scale-100 origin-bottom-left transition-all duration-300 z-30">
                      {REACTION_TYPES.map(react => (
                        <button
                          key={react.name}
                          onClick={() => handleToggleReaction(post.id, react.name)}
                          className={`text-xl hover:scale-130 active:scale-95 duration-200 p-1.5 rounded-full ${post.my_reaction === react.name ? 'bg-purple-500/20' : 'hover:bg-slate-800'}`}
                          title={react.name.toUpperCase()}
                        >
                          {react.emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleComments(post.id)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-all duration-200 ${postComments[post.id] ? 'text-anime-blue bg-anime-blue/5 border border-anime-blue/20' : 'text-anime-muted hover:text-anime-blue hover:bg-slate-900/40'}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    COMMENTS
                  </button>
                </div>

                {/* Comments Section Drawer */}
                {postComments[post.id] && (
                  <div className="bg-anime-cardHover/35 border-t border-slate-950 p-5">
                    
                    {/* Add Comment Input Form */}
                    <div className="flex gap-2.5 items-center">
                      <img 
                        src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                        alt={user?.username} 
                        className="w-8 h-8 rounded-xl object-cover border border-slate-800"
                      />
                      <div className="flex-1 relative flex items-center">
                        <input
                          type="text"
                          placeholder={replyToCommentId[post.id] ? "Type your reply..." : "Write a comment..."}
                          value={activeCommentInput[post.id] || ''}
                          onChange={(e) => setActiveCommentInput(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handlePostComment(post.id);
                          }}
                          className="w-full bg-anime-dark border border-slate-900/90 rounded-full px-4 py-2 pr-10 text-xs text-anime-text outline-none focus:border-anime-blue"
                        />
                        <button 
                          onClick={() => handlePostComment(post.id)}
                          className="absolute right-3.5 text-anime-blue hover:text-anime-pink transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      {replyToCommentId[post.id] && (
                        <button 
                          onClick={() => {
                            setReplyToCommentId(prev => {
                              const copy = { ...prev };
                              delete copy[post.id];
                              return copy;
                            });
                            setActiveCommentInput(prev => ({ ...prev, [post.id]: '' }));
                          }}
                          className="text-[10px] text-anime-pink hover:underline"
                        >
                          Cancel Reply
                        </button>
                      )}
                    </div>

                    {/* Comments Render List */}
                    <div className="mt-4 flex flex-col gap-2">
                      {postComments[post.id].length === 0 ? (
                        <p className="text-center text-xs text-anime-muted py-2">No comments yet. Start the anime chat!</p>
                      ) : (
                        postComments[post.id].map(c => renderComment(c, post.id))
                      )}
                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* 3. Right Sidebar: Trending Tags & Live Recommendations */}
      <div className="lg:col-span-1 hidden lg:block">
        <div className="flex flex-col gap-6 sticky top-24">
          
          {/* Recommendations Box Widget */}
          <div className="anime-card p-5 border-t-2 border-t-anime-pink">
            <h3 className="font-black text-sm text-anime-pink uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Star className="w-4 h-4 fill-current text-anime-pink" />
              Recommendations
            </h3>
            
            <div className="flex flex-col gap-4">
              {ANIME_RECOMMENDATIONS.map(rec => (
                <div key={rec.id} className="group/rec flex gap-3 p-2.5 rounded-xl hover:bg-anime-cardHover/75 transition-all duration-200">
                  <img 
                    src={rec.image} 
                    alt={rec.title} 
                    className="w-12 h-16 rounded-lg object-cover border border-slate-900 group-hover/rec:scale-105 transition-transform"
                  />
                  <div className="flex-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-anime-text">{rec.title}</span>
                      <span className="text-[9px] text-yellow-400 font-bold bg-yellow-400/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        ⭐ {rec.rating}
                      </span>
                    </div>
                    <span className="text-[9px] text-anime-muted block mt-0.5">{rec.genre}</span>
                    <p className="text-[10px] text-anime-muted line-clamp-2 mt-1 leading-normal">{rec.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fandom tags discussions list */}
          <div className="anime-card p-5">
            <h3 className="font-black text-sm text-anime-purple uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-anime-purple" />
              Trending Discussions
            </h3>
            <div className="flex flex-col divide-y divide-slate-900/60">
              {[
                { tag: '#OnePiece', count: '1,450 fans' },
                { tag: '#Naruto', count: '984 fans' },
                { tag: '#DemonSlayer', count: '840 fans' },
                { tag: '#Gear5', count: '620 fans' }
              ].map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-anime-blue hover:underline cursor-pointer">{item.tag}</span>
                    <span className="text-[9px] text-anime-muted block mt-0.5">{item.count} posting</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-anime-muted" />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* 4. ABUSE REPORT MODAL WINDOW */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-anime-card border border-purple-500/25 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <h3 className="text-lg font-black text-anime-pink mb-2">Report Content</h3>
            <p className="text-xs text-anime-muted mb-4">
              Help us keep NaruBook safe. Please select a reason for reporting this content. Administrators will moderates it immediately.
            </p>
            
            <div className="flex flex-col gap-2.5 mb-6">
              {[
                { val: 'harassment', lbl: 'Harassment / Cyberbullying' },
                { val: 'hate_speech', lbl: 'Hate Speech / Toxicity' },
                { val: 'nsfw', lbl: 'NSFW Content / Graphic Media' },
                { val: 'spam', lbl: 'Spam / Repeated Posts' },
                { val: 'copyright', lbl: 'Copyright Infringement' }
              ].map(opt => (
                <label key={opt.val} className="flex items-center gap-3 p-3 bg-anime-dark border border-slate-900 rounded-xl cursor-pointer hover:border-purple-500/20">
                  <input
                    type="radio"
                    name="reportReason"
                    value={opt.val}
                    checked={reportReason === opt.val}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="accent-anime-pink"
                  />
                  <span className="text-xs text-anime-text">{opt.lbl}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 border border-slate-800 rounded-lg text-xs text-anime-muted hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                className="px-4 py-2 bg-anime-pink text-white text-xs font-bold rounded-lg hover:shadow-neon-pink"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Feed;
