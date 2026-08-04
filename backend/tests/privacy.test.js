import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Post } from '../models/post.model.js';
import { User } from '../models/user.model.js';
import { Follow } from '../models/follow.model.js';
import { createUserAndLogin } from './helpers.js';

let priya; // will go private
let sam; // requester / blocked party
let outsider;

beforeAll(async () => {
  priya = await createUserAndLogin({ username: 'privpriya', email: 'privpriya@example.com' });
  sam = await createUserAndLogin({ username: 'privsam', email: 'privsam@example.com' });
  outsider = await createUserAndLogin({ username: 'privout', email: 'privout@example.com' });
});

describe('password change', () => {
  it('rejects a wrong current password and accepts the right one', async () => {
    const wrong = await request(app)
      .post('/api/v1/user/password/change')
      .set('Cookie', outsider.cookie)
      .send({ currentPassword: 'not-the-password', newPassword: 'newpassword123' });
    expect(wrong.status).toBe(401);

    const ok = await request(app)
      .post('/api/v1/user/password/change')
      .set('Cookie', outsider.cookie)
      .send({ currentPassword: 'password123', newPassword: 'newpassword123' });
    expect(ok.status).toBe(200);

    const login = await request(app)
      .post('/api/v1/user/login')
      .send({ email: 'privout@example.com', password: 'newpassword123' });
    expect(login.status).toBe(200);
  });
});

describe('private accounts', () => {
  it('turns follow into a request, hides posts, and accept creates the edge', async () => {
    await request(app)
      .patch('/api/v1/user/privacy')
      .set('Cookie', priya.cookie)
      .send({ isPrivate: true })
      .expect(200);
    const post = await Post.create({
      caption: 'private post',
      image: 'https://example.com/p.jpg',
      author: priya.user._id,
    });
    // Mirror addNewPost's bookkeeping so getProfile can populate it
    await User.updateOne({ _id: priya.user._id }, { $push: { posts: post._id } });

    // Follow becomes a request
    const follow = await request(app)
      .get(`/api/v1/user/followorunfollow/${priya.user._id}`)
      .set('Cookie', sam.cookie);
    expect(follow.body.type).toBe('requested');
    expect(await Follow.exists({ follower: sam.user._id, following: priya.user._id })).toBeNull();

    // Profile is restricted for the requester (not yet a follower)
    const profile = await request(app)
      .get(`/api/v1/user/${priya.user._id}/profile`)
      .set('Cookie', sam.cookie);
    expect(profile.body.user.restricted).toBe(true);
    expect(profile.body.user.posts).toHaveLength(0);

    // Feed hides the private post from non-followers
    const feed = await request(app).get('/api/v1/post/all').set('Cookie', sam.cookie);
    expect(feed.body.posts.every((p) => p.author._id !== priya.user._id.toString())).toBe(true);

    // Accept -> edge exists, profile opens up
    const requests = await request(app)
      .get('/api/v1/user/follow-requests')
      .set('Cookie', priya.cookie);
    expect(requests.body.requests).toHaveLength(1);
    await request(app)
      .post(`/api/v1/user/follow-requests/${requests.body.requests[0]._id}/accept`)
      .set('Cookie', priya.cookie)
      .expect(200);
    expect(
      await Follow.exists({ follower: sam.user._id, following: priya.user._id })
    ).not.toBeNull();
    const after = await request(app)
      .get(`/api/v1/user/${priya.user._id}/profile`)
      .set('Cookie', sam.cookie);
    expect(after.body.user.restricted).toBeUndefined();
    expect(after.body.user.posts.length).toBeGreaterThan(0);
  });
});

describe('blocking', () => {
  it('severs follows and prevents following, messaging, and profile access', async () => {
    await request(app)
      .post(`/api/v1/user/block/${sam.user._id}`)
      .set('Cookie', priya.cookie)
      .expect(200);
    // The accepted follow edge from the previous test is severed
    expect(await Follow.exists({ follower: sam.user._id, following: priya.user._id })).toBeNull();

    const follow = await request(app)
      .get(`/api/v1/user/followorunfollow/${priya.user._id}`)
      .set('Cookie', sam.cookie);
    expect(follow.status).toBe(403);

    const dm = await request(app)
      .post(`/api/v1/message/send/${priya.user._id}`)
      .set('Cookie', sam.cookie)
      .send({ message: 'hello?' });
    expect(dm.status).toBe(403);

    const profile = await request(app)
      .get(`/api/v1/user/${priya.user._id}/profile`)
      .set('Cookie', sam.cookie);
    expect(profile.status).toBe(404);

    // Unblock restores access
    await request(app)
      .post(`/api/v1/user/unblock/${sam.user._id}`)
      .set('Cookie', priya.cookie)
      .expect(200);
    const restored = await request(app)
      .get(`/api/v1/user/${priya.user._id}/profile`)
      .set('Cookie', sam.cookie);
    expect(restored.status).toBe(200);
  });
});

describe('account deletion', () => {
  it('requires the password and removes the user with their data', async () => {
    const victim = await createUserAndLogin({ username: 'privdel', email: 'privdel@example.com' });
    await Post.create({
      caption: 'doomed post',
      image: 'https://example.com/d.jpg',
      author: victim.user._id,
    });

    await request(app)
      .delete('/api/v1/user/account')
      .set('Cookie', victim.cookie)
      .send({ password: 'wrong' })
      .expect(401);

    await request(app)
      .delete('/api/v1/user/account')
      .set('Cookie', victim.cookie)
      .send({ password: 'password123' })
      .expect(200);

    expect(await User.findById(victim.user._id)).toBeNull();
    expect(await Post.countDocuments({ author: victim.user._id })).toBe(0);
  });
});
