import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Post } from '../models/post.model.js';
import { User } from '../models/user.model.js';
import { Like } from '../models/like.model.js';
import { Follow } from '../models/follow.model.js';
import { createUserAndLogin } from './helpers.js';

let alice; // { cookie, user }
let bob;

beforeAll(async () => {
  alice = await createUserAndLogin({ username: 'sgalice', email: 'sgalice@example.com' });
  bob = await createUserAndLogin({ username: 'sgbob', email: 'sgbob@example.com' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Create posts directly via the model (the HTTP addpost path uploads to
// Cloudinary, which tests must not touch).
const makePost = () =>
  Post.create({
    caption: 'social graph post',
    image: 'https://example.com/fake-image.jpg',
    author: alice.user._id,
  });

describe('Like dual-writes', () => {
  it('liking a post creates a Like doc alongside the array entry', async () => {
    const post = await makePost();

    const res = await request(app)
      .get(`/api/v1/post/${post._id}/like`)
      .set('Cookie', bob.cookie);
    expect(res.status).toBe(200);

    const updated = await Post.findById(post._id);
    expect(updated.likes.map(String)).toContain(String(bob.user._id));
    expect(await Like.countDocuments({ user: bob.user._id, post: post._id })).toBe(1);
  });

  it('double-like keeps exactly one Like doc', async () => {
    const post = await makePost();

    for (let i = 0; i < 2; i++) {
      const res = await request(app)
        .get(`/api/v1/post/${post._id}/like`)
        .set('Cookie', bob.cookie);
      expect(res.status).toBe(200);
    }

    expect(await Like.countDocuments({ user: bob.user._id, post: post._id })).toBe(1);
  });

  it('unliking removes the Like doc', async () => {
    const post = await makePost();

    await request(app).get(`/api/v1/post/${post._id}/like`).set('Cookie', bob.cookie);
    const res = await request(app)
      .get(`/api/v1/post/${post._id}/dislike`)
      .set('Cookie', bob.cookie);
    expect(res.status).toBe(200);

    expect(await Like.countDocuments({ user: bob.user._id, post: post._id })).toBe(0);
  });

  it('a failing secondary Like write does not break the like request', async () => {
    const post = await makePost();
    vi.spyOn(Like, 'updateOne').mockRejectedValueOnce(new Error('secondary down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .get(`/api/v1/post/${post._id}/like`)
      .set('Cookie', bob.cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // The authoritative array write still happened
    const updated = await Post.findById(post._id);
    expect(updated.likes.map(String)).toContain(String(bob.user._id));
    expect(errSpy).toHaveBeenCalled();
  });
});

describe('Follow dual-writes', () => {
  it('follow creates a Follow doc, unfollow removes it', async () => {
    const follow = await request(app)
      .get(`/api/v1/user/followorunfollow/${alice.user._id}`)
      .set('Cookie', bob.cookie);
    expect(follow.status).toBe(200);
    expect(follow.body.type).toBe('follow');

    expect(
      await Follow.countDocuments({ follower: bob.user._id, following: alice.user._id })
    ).toBe(1);
    const aliceDoc = await User.findById(alice.user._id);
    expect(aliceDoc.followers.map(String)).toContain(String(bob.user._id));

    const unfollow = await request(app)
      .get(`/api/v1/user/followorunfollow/${alice.user._id}`)
      .set('Cookie', bob.cookie);
    expect(unfollow.status).toBe(200);
    expect(unfollow.body.type).toBe('unfollow');

    expect(
      await Follow.countDocuments({ follower: bob.user._id, following: alice.user._id })
    ).toBe(0);
    const aliceAfter = await User.findById(alice.user._id);
    expect(aliceAfter.followers.map(String)).not.toContain(String(bob.user._id));
  });

  it('a failing secondary Follow write does not break the follow request', async () => {
    vi.spyOn(Follow, 'updateOne').mockRejectedValueOnce(new Error('secondary down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .get(`/api/v1/user/followorunfollow/${alice.user._id}`)
      .set('Cookie', bob.cookie);

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('follow');
    // The authoritative array write still happened
    const aliceDoc = await User.findById(alice.user._id);
    expect(aliceDoc.followers.map(String)).toContain(String(bob.user._id));
    expect(errSpy).toHaveBeenCalled();

    // Clean up: unfollow (dual-delete is a no-op on the missing Follow doc)
    await request(app)
      .get(`/api/v1/user/followorunfollow/${alice.user._id}`)
      .set('Cookie', bob.cookie);
  });
});
