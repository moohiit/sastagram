import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import UserRow from './UserRow';

const RowSkeleton = () => (
  <div className='flex items-center gap-3 px-3 py-2'>
    <div className='h-11 w-11 animate-pulse rounded-full bg-gray-200' />
    <div className='flex flex-col gap-2'>
      <div className='h-3 w-28 animate-pulse rounded bg-gray-200' />
      <div className='h-3 w-40 animate-pulse rounded bg-gray-200' />
    </div>
  </div>
);

// Shared Instagram-style list page for /:id/followers and /:id/following.
// `type` is 'followers' | 'following' and doubles as the endpoint suffix and
// the key of the array in the API response.
const UserListPage = ({ type, title }) => {
  const { id: userId } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchUsers = async () => {
      setUsers(null);
      setError(false);
      try {
        const response = await axios.get(`/api/v1/user/${userId}/${type}`, {
          withCredentials: true,
        });
        if (!active) return;
        if (response.data.success) {
          setUsers(response.data[type] || []);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setError(true);
          toast.error(err.response?.data?.message || 'Something went wrong!');
        }
      }
    };
    fetchUsers();
    return () => {
      active = false;
    };
  }, [userId, type]);

  return (
    <div className='mx-auto w-full max-w-[470px] px-4 py-6'>
      <div className='rounded-lg border border-gray-200 bg-white'>
        <div className='flex items-center gap-3 border-b border-gray-200 p-3'>
          <button
            onClick={() => navigate(-1)}
            aria-label='Go back'
            className='cursor-pointer rounded-lg p-1 transition-colors hover:bg-gray-100'
          >
            <ArrowLeft size={20} className='text-gray-900' />
          </button>
          <h1 className='text-base font-semibold text-gray-900'>{title}</h1>
        </div>
        <div className='p-2'>
          {users === null && !error ? (
            <>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </>
          ) : error ? (
            <p className='px-3 py-8 text-center text-sm text-gray-500'>
              Couldn't load {title.toLowerCase()}. Please try again.
            </p>
          ) : users.length === 0 ? (
            <p className='px-3 py-8 text-center text-sm text-gray-500'>
              No {title.toLowerCase()} yet.
            </p>
          ) : (
            users.map(u => <UserRow key={u._id} user={u} />)
          )}
        </div>
      </div>
    </div>
  );
};

export default UserListPage;
