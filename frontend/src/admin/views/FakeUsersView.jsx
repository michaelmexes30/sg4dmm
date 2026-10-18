import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Sparkles, 
  Search, 
  RotateCcw,
  Check, 
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Bot,
  Radio,
  Image as ImageIcon,
  CheckCircle2,
  X
} from 'lucide-react';
import { apiClient } from '../../api/client';

const PRESET_AVATARS = [
  { id: 'av1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=faces', label: 'Girl 1' },
  { id: 'av2', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=faces', label: 'Man 1' },
  { id: 'av3', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=faces', label: 'Girl 2' },
  { id: 'av4', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=faces', label: 'Man 2' },
  { id: 'av5', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop&crop=faces', label: 'Girl 3' },
  { id: 'av6', url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=faces', label: 'Man 3' },
  { id: 'av7', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop&crop=faces', label: 'Girl 4' },
  { id: 'av8', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop&crop=faces', label: 'Girl 5' },
  { id: 'av9', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=LuckyPeacock', label: 'Bot 1' },
  { id: 'av10', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=GoldenDragon', label: 'Bot 2' },
  { id: 'av11', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=FortuneKing', label: 'Bot 3' },
  { id: 'av12', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=MyanmarWinner', label: 'Bot 4' },
];

const NICKNAME_SUGGESTIONS = [
  'ရွှေမင်းသား', 'Cherry', 'အောင်ကောင်း', 'Ko Min', 'နှင်းဆီ', 
  'Kyaw Gyi', 'LuckyStar', 'Thura', 'Su Su', 'မောင်မောင်'
];

export default function FakeUsersView({ onNotify }) {
  const [fakeUsers, setFakeUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Add form state
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0].url);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [useCustomAvatar, setUseCustomAvatar] = useState(false);
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadFakeUsers();
  }, [page, limit, activeSearch]);

  const loadFakeUsers = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
      };
      if (activeSearch.trim()) {
        params.search = activeSearch.trim();
      }
      const res = await apiClient.getAdminFakeUsers(params);
      
      // Support both list response and paginated { results, total } response
      if (Array.isArray(res)) {
        setFakeUsers(res);
        setTotal(res.length);
      } else if (res && (res.results || res.users)) {
        setFakeUsers(res.results || res.users || []);
        setTotal(res.total || 0);
      } else {
        setFakeUsers([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error loading simulated profiles:', err);
      if (onNotify) onNotify(err.message || 'Failed to load simulated profiles', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchInput);
  };

  const handleResetSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setPage(1);
  };

  const handleAddFakeUser = async (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    const avatar = useCustomAvatar && customAvatarUrl.trim() 
      ? customAvatarUrl.trim() 
      : selectedAvatar;

    try {
      setSubmitting(true);
      await apiClient.createAdminFakeUser({
        nickname: nickname.trim(),
        avatar_url: avatar
      });
      if (onNotify) onNotify(`Added simulated profile "${nickname}" successfully`, 'success');
      setNickname('');
      setCustomAvatarUrl('');
      setUseCustomAvatar(false);
      setIsAddOpen(false);
      loadFakeUsers();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to add simulated profile', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiClient.deleteAdminFakeUser(deleteTarget.id);
      if (onNotify) onNotify(`Simulated profile "${deleteTarget.nickname || deleteTarget.nick_name}" removed`, 'success');
      setDeleteTarget(null);
      loadFakeUsers();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to delete simulated profile', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      {/* 1. Header & KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Total Simulated Profiles</p>
            <p className="text-2xl font-black font-mono text-gold-400 mt-1">{total.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Used for live winner marquee</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-gold-400">
            <Bot className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Ticker Broadcast</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-lg font-bold text-emerald-400">ACTIVE</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Auto-rotates in player app</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Radio className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Strict Data Isolation</p>
            <p className="text-lg font-bold text-sky-400 mt-1">100% ISOLATED</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Never mixed with 4 real players</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Current Pagination</p>
            <p className="text-lg font-bold text-white font-mono mt-1">
              Page {page} / {totalPages}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{limit} profiles per page</p>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-950 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Bot</span>
          </button>
        </div>
      </div>

      {/* 2. Add Simulated Profile Modal / Drawer */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-gold-500/30 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-navy-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-gold-400" />
              <h3 className="text-base font-bold text-white uppercase tracking-wider font-serif">
                Create Simulated Winner Profile
              </h3>
            </div>

            <form onSubmit={handleAddFakeUser} className="space-y-4">
              {/* Avatar Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  1. Choose Avatar (or custom URL)
                </label>
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {PRESET_AVATARS.map((av) => (
                    <button
                      type="button"
                      key={av.id}
                      onClick={() => {
                        setSelectedAvatar(av.url);
                        setUseCustomAvatar(false);
                      }}
                      className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all p-0.5 ${
                        !useCustomAvatar && selectedAvatar === av.url
                          ? 'border-amber-400 scale-105 shadow-md shadow-amber-500/40 ring-2 ring-amber-400/30'
                          : 'border-gold-500/20 opacity-60 hover:opacity-100 hover:border-slate-500'
                      }`}
                    >
                      <img src={av.url} alt={av.label} className="w-full h-full rounded-full object-cover" />
                      {!useCustomAvatar && selectedAvatar === av.url && (
                        <span className="absolute inset-0 bg-amber-500/20 flex items-center justify-center text-amber-300">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="Or enter custom image URL (https://...)"
                    value={customAvatarUrl}
                    onChange={(e) => {
                      setCustomAvatarUrl(e.target.value);
                      if (e.target.value.trim()) setUseCustomAvatar(true);
                    }}
                    className="flex-1 bg-navy-950 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
                  />
                  {useCustomAvatar && (
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
                      Using Custom
                    </span>
                  )}
                </div>
              </div>

              {/* Nickname with quick suggestions */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  2. Nickname (အမည်/အမည်ဝှက်)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ရွှေမင်းသား, Cherry, Ko Min..."
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-navy-950 border border-gold-500/20 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
                />

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400 mr-1">Suggestions:</span>
                  {NICKNAME_SUGGESTIONS.map((sug) => (
                    <button
                      type="button"
                      key={sug}
                      onClick={() => setNickname(sug)}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-navy-800 hover:bg-gold-500/20 text-slate-300 hover:text-gold-300 border border-gold-500/10 transition-colors"
                    >
                      +{sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gold-500/20">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !nickname.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-950 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{submitting ? 'Creating Profile...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Filter & Search Controls */}
      <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by nickname (e.g. Ko Min)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-navy-950 border border-gold-500/20 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-400"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-gold-500/20 hover:bg-gold-500/30 text-gold-300 text-xs font-bold border border-gold-500/30 transition-all"
          >
            Search
          </button>
          {activeSearch && (
            <button
              type="button"
              onClick={handleResetSearch}
              className="px-2.5 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-slate-400 text-xs transition-colors"
              title="Reset Search"
            >
              Clear
            </button>
          )}
        </form>

        {/* Right Tools: Page size selector and refresh */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Show:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-navy-950 border border-gold-500/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold-400"
            >
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={100}>100</option>
            </select>
          </div>

          <button
            onClick={loadFakeUsers}
            disabled={loading}
            className="p-2 rounded-xl bg-navy-800 border border-gold-500/20 hover:border-gold-500/40 text-gold-400 hover:text-white transition-all disabled:opacity-50"
            title="Reload Profiles"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4. Simulated Profiles Grid */}
      <div className="bg-navy-900/90 border border-gold-500/20 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-serif">
              Simulated Profiles Catalog
            </h3>
            <p className="text-xs text-slate-400">
              Showing {fakeUsers.length > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, total)} of {total.toLocaleString()} profiles
            </p>
          </div>
          {activeSearch && (
            <span className="text-xs bg-amber-500/10 text-gold-400 px-2.5 py-1 rounded-full border border-gold-500/20 font-medium">
              Filtered: "{activeSearch}"
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-2 border-gold-500/20 border-t-gold-400 rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-mono">Loading simulated profiles...</p>
          </div>
        ) : fakeUsers.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-gold-500/20 rounded-xl space-y-3">
            <Bot className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400 font-semibold">No simulated profiles found.</p>
            {activeSearch ? (
              <button
                onClick={handleResetSearch}
                className="text-xs text-gold-400 hover:underline"
              >
                Clear search filter
              </button>
            ) : (
              <button
                onClick={() => setIsAddOpen(true)}
                className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
              >
                + Add First Simulated Profile
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {fakeUsers.map((u) => {
              const displayName = u.nickname || u.nick_name || u.full_name || u.username;
              const displayAvatar = u.avatar_url || u.avatar || PRESET_AVATARS[0].url;

              return (
                <div
                  key={u.id}
                  className="bg-navy-950/90 border border-gold-500/20 hover:border-gold-500/50 rounded-xl p-3 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 shadow-md group relative"
                >
                  <div className="flex items-start gap-2.5">
                    <img
                      src={displayAvatar}
                      alt={displayName}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = PRESET_AVATARS[8].url;
                      }}
                      className="w-10 h-10 rounded-full object-cover border-2 border-gold-500/30 flex-shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate" title={displayName}>
                        {displayName}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 truncate">
                        ID: #{u.id}
                      </p>
                      <span className="inline-block text-[9px] bg-amber-500/15 text-gold-300 font-semibold px-1.5 py-0.2 rounded mt-1 border border-gold-500/20">
                        BOT TICKER
                      </span>
                    </div>

                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                      title="Delete profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Sim. Balance:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {Number(u.balance || 50000).toLocaleString()} Ks
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 pt-4 border-t border-gold-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> (Total {total.toLocaleString()} Profiles)
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-navy-950 border border-gold-500/20 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-navy-950 border border-gold-500/20 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers window */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pNum;
                if (totalPages <= 5) {
                  pNum = i + 1;
                } else if (page <= 3) {
                  pNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pNum = totalPages - 4 + i;
                } else {
                  pNum = page - 2 + i;
                }
                return (
                  <button
                    key={pNum}
                    onClick={() => setPage(pNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all ${
                      page === pNum
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950'
                        : 'bg-navy-950 border border-gold-500/20 text-slate-300 hover:text-white hover:border-gold-500/40'
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-navy-950 border border-gold-500/20 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-navy-950 border border-gold-500/20 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-navy-900 border border-rose-500/40 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Delete Simulated Profile</h4>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete simulated bot profile <strong className="text-gold-400">"{deleteTarget.nickname || deleteTarget.nick_name}"</strong> (#{deleteTarget.id})?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-navy-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
