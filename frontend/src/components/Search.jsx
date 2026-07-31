import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Search as SearchIcon, X } from 'lucide-react';
import { Input } from './ui/input';
import UserRow from './profile/UserRow';
import SuggestedUsers from './SuggestedUsers';

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
    <div className='h-11 w-11 animate-pulse rounded-full bg-gray-200' />
    <div className='flex flex-col gap-2'>
      <div className='h-3 w-28 animate-pulse rounded bg-gray-200' />
      <div className='h-3 w-40 animate-pulse rounded bg-gray-200' />
    </div>
  </div>
);

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState(loadRecent);

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

  const showResults = query.trim().length >= 1;

  return (
    <div className='mx-auto w-full max-w-[470px] px-4 py-6'>
      <h1 className='mb-4 text-xl font-bold text-gray-900'>Search</h1>

      {/* Search input */}
      <div className='relative mb-4'>
        <SearchIcon size={20} className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='Search'
          autoFocus
          className='rounded-lg border-gray-200 pl-10 pr-10 focus-visible:ring-transparent'
        />
        {query ? (
          <button
            onClick={() => setQuery('')}
            aria-label='Clear search'
            className='absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-500'
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      {showResults ? (
        <div className='rounded-lg border border-gray-200 bg-white p-2'>
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
                  <Loader2 size={16} className='animate-spin text-gray-400' />
                </div>
              ) : null}
              {results.map(u => (
                <UserRow key={u._id} user={u} onNavigate={() => addRecent(u)} />
              ))}
            </>
          ) : results ? (
            <p className='px-3 py-8 text-center text-sm text-gray-500'>
              No results found for "{query.trim()}"
            </p>
          ) : null}
        </div>
      ) : (
        <>
          {/* Recent searches */}
          <div className='mb-6'>
            <div className='mb-1 flex items-center justify-between px-1'>
              <h2 className='text-base font-semibold text-gray-900'>Recent</h2>
              {recent.length > 0 ? (
                <button
                  onClick={clearRecent}
                  className='cursor-pointer text-sm font-semibold text-blue-500 hover:text-blue-700'
                >
                  Clear all
                </button>
              ) : null}
            </div>
            {recent.length === 0 ? (
              <p className='px-1 py-6 text-center text-sm text-gray-500'>No recent searches.</p>
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
                      className='cursor-pointer p-1 text-gray-400 hover:text-gray-500'
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
      )}
    </div>
  );
};

export default Search;
