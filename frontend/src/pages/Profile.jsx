import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Edit2, ShieldAlert, Heart, Flame, MessageSquare, Star, Plus, Check, Tag, ChevronRight } from 'lucide-react';

const Profile = ({ targetUserId = null, onBackToFeed, onMessageClick, onSelectUser }) => {
  const { user: currentUser, profile: currentProfile, updateProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Follow Modal listing states
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [followModalTab, setFollowModalTab] = useState('followers'); // 'followers', 'following'
  const [followModalList, setFollowModalList] = useState([]);
  const [loadingFollowModal, setLoadingFollowModal] = useState(false);

  const handleOpenFollowModal = async (tab) => {
    try {
      setShowFollowModal(true);
      setFollowModalTab(tab);
      setLoadingFollowModal(true);
      setFollowModalList([]);
      const res = await api.get(`/users/${activeProfileUserId}/${tab}`);
      setFollowModalList(res.data);
    } catch (err) {
      console.error(`Failed to fetch ${tab} list:`, err.message);
    } finally {
      setLoadingFollowModal(false);
    }
  };

  const handleSwitchFollowModalTab = async (tab) => {
    setFollowModalTab(tab);
    setLoadingFollowModal(true);
    setFollowModalList([]);
    try {
      const res = await api.get(`/users/${activeProfileUserId}/${tab}`);
      setFollowModalList(res.data);
    } catch (err) {
      console.error(`Failed to switch to ${tab} list:`, err.message);
    } finally {
      setLoadingFollowModal(false);
    }
  };

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bio, setBio] = useState('');
  const [favoriteAnime, setFavoriteAnime] = useState('');
  const [fandomInput, setFandomInput] = useState('');
  const [fandomsList, setFandomsList] = useState([]);

  const isMyProfile = !targetUserId || targetUserId === currentUser?.id;
  const activeProfileUserId = targetUserId || currentUser?.id;

  const fetchProfileDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/users/profile/${activeProfileUserId}`);
      setProfile(res.data.profile);
      setIsFollowing(res.data.isFollowing);
      setPosts(res.data.posts);

      // Populate edit defaults
      if (isMyProfile && res.data.profile) {
        setAvatarUrl(res.data.profile.avatar_url || '');
        setBannerUrl(res.data.profile.banner_url || '');
        setBio(res.data.profile.bio || '');
        setFavoriteAnime(res.data.profile.favorite_anime || '');
        setFandomsList(res.data.profile.fandoms || []);
      }
    } catch (err) {
      console.error('Error fetching profile detail:', err.message);
      alert('Failed to load profile details.');
      onBackToFeed();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeProfileUserId) {
      fetchProfileDetails();
    }
  }, [activeProfileUserId]);

  const handleToggleFollow = async () => {
    try {
      const res = await api.post(`/users/follow/${activeProfileUserId}`);
      setIsFollowing(res.data.isFollowing);
      // Locally increment/decrement followers count to reflect state instantly
      setProfile(prev => ({
        ...prev,
        followers_count: res.data.isFollowing 
          ? prev.followers_count + 1 
          : Math.max(0, prev.followers_count - 1)
      }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to toggle follow status.');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await updateProfile({
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        bio,
        favorite_anime: favoriteAnime,
        fandoms: fandomsList
      });

      if (res.success) {
        setProfile(prev => ({
          ...prev,
          avatar_url: avatarUrl,
          banner_url: bannerUrl,
          bio,
          favorite_anime: favoriteAnime,
          fandoms: fandomsList
        }));
        setIsEditing(false);
        alert('Profile saved successfully!');
      } else {
        alert(res.error);
      }
    } catch (err) {
      alert('Failed to update profile.');
    }
  };

  const handleAddFandom = () => {
    if (fandomInput.trim() && !fandomsList.includes(fandomInput.trim())) {
      setFandomsList(prev => [...prev, fandomInput.trim()]);
      setFandomInput('');
    }
  };

  const handleRemoveFandom = (t) => {
    setFandomsList(prev => prev.filter(f => f !== t));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-4 border-t-anime-blue border-b-anime-pink rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
      
      {/* 1. Header Banner & Profile Avatars */}
      <div className="anime-card p-0 overflow-hidden relative">
        {/* Cover Photo */}
        <div 
          className="h-48 md:h-64 bg-cover bg-center bg-no-repeat relative border-b border-slate-900" 
          style={{ backgroundImage: `url(${profile?.banner_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200'})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-anime-dark to-transparent opacity-60"></div>
        </div>

        {/* Profile Card details */}
        <div className="p-6 relative flex flex-col md:flex-row items-center md:items-end justify-between gap-6 -mt-16 md:-mt-20">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-4 relative z-10 text-center md:text-left">
            <img 
              src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
              alt={profile?.username} 
              className="w-28 h-28 md:w-32 md:h-32 rounded-2xl object-cover border-4 border-anime-dark bg-anime-card shadow-neon-blue"
            />
            <div className="mb-2">
              <h2 className="text-2xl md:text-3xl font-black italic bg-gradient-to-r from-anime-blue to-anime-purple bg-clip-text text-transparent">
                {profile?.username}
              </h2>
              <span className="text-[10px] text-anime-pink font-black uppercase tracking-wider block mt-0.5">{profile?.role}</span>
              <p className="text-xs text-anime-muted max-w-md mt-1 leading-relaxed">{profile?.bio || 'This anime fan has not written a bio yet.'}</p>
            </div>
          </div>

          <div className="flex gap-3 relative z-10 mb-2">
            {isMyProfile ? (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="btn-neon-blue !py-2 flex items-center gap-1.5 text-xs font-bold"
              >
                <Edit2 className="w-3.5 h-3.5" />
                {isEditing ? 'Cancel Edit' : 'Edit Profile'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => onMessageClick && onMessageClick(activeProfileUserId)}
                  className="btn-neon-blue !px-5 !py-2 flex items-center gap-1.5 text-xs font-bold"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-anime-blue" />
                  Message
                </button>
                
                <button
                  onClick={handleToggleFollow}
                  className={`btn-neon-filled !px-6 !py-2 flex items-center gap-1.5 text-xs font-bold ${isFollowing ? 'shadow-neon-pink !border-anime-pink' : ''}`}
                >
                  {isFollowing ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      Following
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Follow Fandom
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Profiles Stats summary footer */}
        <div className="border-t border-slate-900/60 p-4 px-6 flex justify-around md:justify-start gap-12 bg-anime-dark/30 text-xs">
          <div 
            onClick={() => handleOpenFollowModal('followers')}
            className="text-center md:text-left cursor-pointer hover:opacity-80 select-none hover:scale-105 transition-all"
            title="View Followers"
          >
            <span className="text-anime-muted block uppercase tracking-widest text-[9px]">Followers</span>
            <span className="text-lg font-black text-anime-purple shadow-neon-purple-text">{profile?.followers_count || 0}</span>
          </div>
          <div 
            onClick={() => handleOpenFollowModal('following')}
            className="text-center md:text-left cursor-pointer hover:opacity-80 select-none hover:scale-105 transition-all"
            title="View Following"
          >
            <span className="text-anime-muted block uppercase tracking-widest text-[9px]">Following</span>
            <span className="text-lg font-black text-anime-blue shadow-neon-blue-text">{profile?.following_count || 0}</span>
          </div>
          <div className="text-center md:text-left">
            <span className="text-anime-muted block uppercase tracking-widest text-[9px]">Favorite Anime</span>
            <span className="text-lg font-black text-anime-pink truncate max-w-[150px] block">{profile?.favorite_anime || 'None'}</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Editing Panel Drawer */}
      {isEditing && (
        <div className="anime-card p-6 border-l-4 border-l-anime-purple">
          <h3 className="text-md font-black text-anime-purple uppercase tracking-wider mb-4">Edit Profile Fandom Settings</h3>
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-anime-muted mb-1 block">Avatar Image URL</label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="anime-input text-xs"
                  placeholder="Paste URL..."
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-anime-muted mb-1 block">Cover Banner Image URL</label>
                <input
                  type="text"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  className="anime-input text-xs"
                  placeholder="Paste URL..."
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-anime-muted mb-1 block">Profile Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="anime-input text-xs"
                rows="2"
                placeholder="Write an anime quote or describe yourself..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-anime-muted mb-1 block">Favorite Anime</label>
                <input
                  type="text"
                  value={favoriteAnime}
                  onChange={(e) => setFavoriteAnime(e.target.value)}
                  className="anime-input text-xs"
                  placeholder="e.g. Naruto Shippuden..."
                />
              </div>
              
              <div>
                <label className="text-[10px] uppercase font-bold text-anime-muted mb-1 block">Anime Fandom Tags</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fandomInput}
                    onChange={(e) => setFandomInput(e.target.value)}
                    className="anime-input text-xs"
                    placeholder="e.g. Naruto, Shonen..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFandom();
                      }
                    }}
                  />
                  <button 
                    type="button" 
                    onClick={handleAddFandom} 
                    className="px-3 bg-anime-purple text-white font-bold rounded-xl text-xs hover:shadow-neon-purple"
                  >
                    Add
                  </button>
                </div>
                
                {/* Active tags drawer */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {fandomsList.map(tag => (
                    <span 
                      key={tag} 
                      onClick={() => handleRemoveFandom(tag)}
                      className="text-[9px] bg-slate-900 border border-slate-700 rounded-md px-2 py-0.5 text-anime-muted cursor-pointer hover:bg-anime-pink/10 hover:text-anime-pink hover:border-anime-pink/20"
                    >
                      {tag} &times;
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-slate-800 text-xs text-anime-muted rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-anime-purple text-white text-xs font-bold rounded-lg hover:shadow-neon-purple"
              >
                Save Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Favorite Anime Shelf Bookcase */}
      {profile?.fandoms && profile.fandoms.length > 0 && (
        <div className="anime-card p-5 border-t-2 border-t-anime-pink">
          <h3 className="text-sm font-black text-anime-pink uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Star className="w-4 h-4 fill-current text-anime-pink" />
            Favorite Fandom Groups
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {profile.fandoms.map((tag, idx) => (
              <span key={idx} className="text-xs bg-anime-pink/10 border border-anime-pink/25 text-anime-pink font-bold px-3 py-1 rounded-xl shadow-neon-pink">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 4. User posts timeline list */}
      <div className="flex flex-col gap-5 mt-2">
        <h3 className="font-black text-lg text-anime-blue border-b border-slate-900 pb-2">
          {isMyProfile ? 'My timeline posts' : `${profile?.username}'s posts`}
        </h3>

        {posts.length === 0 ? (
          <div className="anime-card p-10 text-center text-anime-muted text-xs">
            This user has not published any posts on their timeline.
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="anime-card p-5">
              <div className="flex justify-between items-center mb-3">
                <div className="flex gap-2.5 items-center">
                  <img 
                    src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                    alt={profile?.username} 
                    className="w-8 h-8 rounded-xl object-cover border border-slate-800"
                  />
                  <div>
                    <h4 className="font-bold text-xs text-anime-blue">{profile?.username}</h4>
                    <span className="text-[9px] text-anime-muted block mt-0.5">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-anime-text leading-relaxed whitespace-pre-wrap mb-4">{post.content}</p>

              {post.media_url && (
                <div className="rounded-xl overflow-hidden border border-slate-900 max-h-80 bg-black mb-4">
                  {post.media_type === 'video' ? (
                    <video src={post.media_url} controls className="w-full max-h-80" />
                  ) : (
                    <img src={post.media_url} alt="Attachment" className="w-full max-h-80 object-contain" />
                  )}
                </div>
              )}

              {/* Minimal Reactions count */}
              <div className="flex gap-4 text-[10px] text-anime-muted pt-3 border-t border-slate-900/50">
                <span className="flex items-center gap-1 hover:text-anime-pink cursor-pointer">
                  <Flame className="w-3.5 h-3.5 text-anime-pink" />
                  {post.likes_count} reactions
                </span>
                <span className="flex items-center gap-1 hover:text-anime-blue cursor-pointer">
                  <MessageSquare className="w-3.5 h-3.5 text-anime-blue" />
                  {post.comments_count} comments
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 5. FOLLOW LISTING MODAL DIALOG */}
      {showFollowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-anime-card border border-purple-500/25 rounded-2xl w-full max-w-md p-6 relative shadow-2xl flex flex-col max-h-[80vh] backdrop-blur-md">
            
            {/* Header / Tabs */}
            <div className="flex border-b border-slate-900 pb-3 mb-4 justify-between items-center">
              <div className="flex gap-4">
                <button
                  onClick={() => handleSwitchFollowModalTab('followers')}
                  className={`text-sm font-black uppercase tracking-wider transition-all duration-150 ${followModalTab === 'followers' ? 'text-anime-purple border-b-2 border-b-anime-purple shadow-neon-purple-text' : 'text-anime-muted'}`}
                >
                  Followers
                </button>
                <button
                  onClick={() => handleSwitchFollowModalTab('following')}
                  className={`text-sm font-black uppercase tracking-wider transition-all duration-150 ${followModalTab === 'following' ? 'text-anime-blue border-b-2 border-b-anime-blue shadow-neon-blue-text' : 'text-anime-muted'}`}
                >
                  Following
                </button>
              </div>
              <button 
                onClick={() => setShowFollowModal(false)}
                className="text-anime-muted hover:text-anime-pink font-black text-lg transition-colors px-2"
              >
                &times;
              </button>
            </div>

            {/* List Container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingFollowModal ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-t-anime-blue border-b-anime-pink rounded-full animate-spin"></div>
                </div>
              ) : followModalList.length === 0 ? (
                <div className="p-8 text-center text-xs text-anime-muted">
                  No Otaku fans listed in this category yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-900/50">
                  {followModalList.map(usr => (
                    <div 
                      key={usr.id}
                      onClick={() => {
                        setShowFollowModal(false);
                        onSelectUser && onSelectUser(usr.id);
                      }}
                      className="flex items-center justify-between py-3 cursor-pointer hover:bg-slate-900/30 rounded-lg px-2 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={usr.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                          alt={usr.username} 
                          className="w-9 h-9 rounded-lg object-cover border border-slate-800"
                        />
                        <div className="text-xs">
                          <h4 className="font-bold text-anime-text hover:text-anime-blue transition-colors">{usr.username}</h4>
                          {usr.favorite_anime && usr.favorite_anime !== 'None' && (
                            <span className="text-[9px] text-anime-pink font-bold block mt-0.5">{usr.favorite_anime}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-anime-muted" />
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
