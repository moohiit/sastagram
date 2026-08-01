import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Search as SearchIcon, Sparkles, X } from 'lucide-react';
import { Input } from './ui/input';
import { cdn } from '@/lib/cdn';
import UserRow from './profile/UserRow';
import SuggestedUsers from './SuggestedUsers';
import CommentDialog from './CommentDialog';

const RECENT_KEY = 'sastagram-recent-searches';
const MAX_RECENT = 10;

const loadRecent = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const RowSkeleton = () => (
  <div className='flex items-center gap-3 px-3 py-2'>
    <div className='h-11 w-11 animate-pulse rounded-full bg-zinc-800' />
    <div className='flex flex-col gap-2'>
      <div className='h-3 w-28 animate-pulse rounded bg-zinc-800' />
      <div className='h-3 w-40 animate-pulse rounded bg-zinc-800' />
    </div>
  </div>
);

const GridSkeleton = () => (
  <div className='grid grid-cols-3 gap-1'>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className='aspect-square animate-pulse rounded bg-zinc-800' />
    ))}
  </div>
);

const TABS = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'posts', label: 'Posts' },
];

const Search = () => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('accounts');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState(loadRecent);
  // Posts tab state
  const [postResults, setPostResults] = useState(null);
  const [postMode, setPostMode] = useState('semantic');
  const [postSearching, setPostSearching] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const persistRecent = list => {
    setRecent(list);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
      // localStorage unavailable — recents just won't persist
    }
  };

  const addRecent = u => {
    const entry = {
      _id: u._id,
      username: u.username,
      profilePicture: u.profilePicture,
      bio: u.bio,
    };
    persistRecent([entry, ...recent.filter(r => r._id !== u._id)].slice(0, MAX_RECENT));
  };

  const removeRecent = id => persistRecent(recent.filter(r => r._id !== id));
  const clearRecent = () => persistRecent([]);

  // Debounced search (300ms) against GET /api/v1/user/search?q=, cancelling
  // stale in-flight requests with an AbortController.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await axios.get('/api/v1/user/search', {
          params: { q },
          withCredentials: true,
          signal: controller.signal,
        });
        if (response.data.success) {
          setResults(response.data.users || []);
        }
        setSearching(false);
      } catch (error) {
        if (axios.isCancel(error) || controller.signal.aborted) return;
        console.error(error);
        setSearching(false);
        toast.error(error.response?.data?.message || 'Search failed');
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Same debounced pattern for the Posts tab against GET /api/v1/post/search?q=
  // (semantic when the server has AI configured, caption text search otherwise).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1 || tab !== 'posts') {
      setPostResults(null);
      setPostSearching(false);
      return;
    }
    const controller = new AbortController();
    setPostSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await axios.get('/api/v1/post/search', {
          params: { q },
          withCredentials: true,
          signal: controller.signal,
        });
        if (response.data.success) {
          setPostResults(response.data.posts || []);
          setPostMode(response.data.mode || 'text');
        }
        setPostSearching(false);
      } catch (error) {
        if (axios.isCancel(error) || controller.signal.aborted) return;
        console.error(error);
        setPostSearching(false);
        toast.error(error.response?.data?.message || 'Search failed');
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, tab]);

  const openPost = post => {
    // Search results carry unpopulated comment ids — CommentDialog expects
    // populated comment objects, so start empty (redux feedPost wins if cached).
    setSelectedPost({ ...post, comments: [] });
    setDialogOpen(true);
  };

  const showResults = query.trim().length >= 1;

  return (
    <div className='mx-auto w-full max-w-[470px] px-4 py-6'>
      <h1 className='mb-4 text-xl font-bold text-gray-100'>Search</h1>

      {/* Search input */}
      <div className='relative mb-4'>
        <SearchIcon size={20} className='absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500' />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='Search'
          autoFocus
          className='rounded-lg border-zinc-800 pl-10 pr-10 focus-visible:ring-transparent'
        />
        {query ? (
          <button
            onClick={() => setQuery('')}
            aria-label='Clear search'
            className='absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-zinc-500 hover:text-zinc-400'
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      {/* Accounts | Posts tabs */}
      <div className='mb-4 flex border-b border-zinc-800'>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 cursor-pointer border-b-2 pb-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'border-gray-100 text-gray-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounts' ? (
        showResults ? (
          <div className='rounded-lg border border-zinc-800 bg-black p-2'>
            {searching && results === null ? (
              <>
                <RowSkeleton />
                <RowSkeleton />
                <RowSkeleton />
              </>
            ) : results && results.length > 0 ? (
              <>
                {searching ? (
                  <div className='flex justify-center py-1'>
                    <Loader2 size={16} className='animate-spin text-zinc-500' />
                  </div>
                ) : null}
                {results.map(u => (
                  <UserRow key={u._id} user={u} onNavigate={() => addRecent(u)} />
                ))}
              </>
            ) : results ? (
              <p className='px-3 py-8 text-center text-sm text-zinc-400'>
                No results found for "{query.trim()}"
              </p>
            ) : null}
          </div>
        ) : (
          <>
            {/* Recent searches */}
            <div className='mb-6'>
              <div className='mb-1 flex items-center justify-between px-1'>
                <h2 className='text-base font-semibold text-gray-100'>Recent</h2>
                {recent.length > 0 ? (
                  <button
                    onClick={clearRecent}
                    className='cursor-pointer text-sm font-semibold text-blue-400 hover:text-blue-300'
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
              {recent.length === 0 ? (
                <p className='px-1 py-6 text-center text-sm text-zinc-400'>No recent searches.</p>
              ) : (
                recent.map(u => (
                  <UserRow
                    key={u._id}
                    user={u}
                    onNavigate={() => addRecent(u)}
                    action={
                      <button
                        onClick={() => removeRecent(u._id)}
                        aria-label={`Remove ${u.username} from recent searches`}
                        className='cursor-pointer p-1 text-zinc-500 hover:text-zinc-400'
                      >
                        <X size={18} />
                      </button>
                    }
                  />
                ))
              )}
            </div>

            <SuggestedUsers />
          </>
        )
      ) : (
        /* Posts tab */
        <div>
          {!showResults ? (
            <p className='px-1 py-8 text-center text-sm text-zinc-400'>
              Search posts by what's in them — try "sunset at the beach".
            </p>
          ) : postSearching && postResults === null ? (
            <GridSkeleton />
          ) : postResults && postResults.length > 0 ? (
            <>
              <div className='mb-2 flex items-center justify-between px-1'>
                {postMode === 'semantic' ? (
                  <span className='flex items-center gap-1 text-xs text-zinc-500'>
                    <Sparkles size={12} />
                    Semantic search
                  </span>
                ) : (
                  <span className='rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500'>
                    basic search
                  </span>
                )}
                {postSearching ? (
                  <Loader2 size={14} className='animate-spin text-zinc-500' />
                ) : null}
              </div>
              <div className='grid grid-cols-3 gap-1'>
                {postResults.map(post => (
                  <button
                    key={post._id}
                    onClick={() => openPost(post)}
                    className='group relative aspect-square cursor-pointer overflow-hidden bg-zinc-900 focus:outline-none'
                  >
                    <img
                      src={cdn(post.image, 500)}
                      alt={post.altText || (post.caption ? post.caption.slice(0, 60) : 'Post')}
                      loading='lazy'
                      className='h-full w-full object-cover'
                    />
                  </button>
                ))}
              </div>
            </>
          ) : postResults ? (
            <p className='px-3 py-8 text-center text-sm text-zinc-400'>
              No posts found for "{query.trim()}"
            </p>
          ) : null}

          {selectedPost && (
            <CommentDialog open={dialogOpen} setOpen={setDialogOpen} post={selectedPost} />
          )}
        </div>
      )}
    </div>
  );
};

export default Search;
