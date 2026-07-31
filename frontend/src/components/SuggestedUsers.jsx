import React from 'react';
import { useSelector } from 'react-redux';
import UserRow from './profile/UserRow';

const SuggestedUsers = () => {
  const { suggestedUsers } = useSelector(store => store.auth);

  if (!suggestedUsers || suggestedUsers.length === 0) return null;

  return (
    <div>
      <h2 className='mb-1 px-1 text-sm font-semibold text-gray-500'>Suggested for you</h2>
      {suggestedUsers.map(suggestedUser => (
        <UserRow key={suggestedUser._id} user={suggestedUser} avatarClass='h-8 w-8' />
      ))}
    </div>
  );
};

export default SuggestedUsers;
