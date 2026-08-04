import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Post } from '../models/post.model.js';
import { Like } from '../models/like.model.js';
import { Follow } from '../models/follow.model.js';
import { Notification } from '../models/notification.model.js';
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

// Stage 3 (MIGRATION.md): the Like/Follow collections are the ONLY store —
// the embedded arrays no longer exist.
describe('Like writes (Stage 3)', () => {
  it('liking a post creates exactly one Like doc, idempotently', async () => {
    const post = await makePost();

    for (let i = 0; i < 2; i++) {
      const res = await request(app)
        .get(`/api/v1/post/${post._id}/like`)
        .set('Cookie', bob.cookie);
      expect(res.status).toBe(200);
    }
    expect(await Like.countDocuments({ user: bob.user._id, post: post._id })).toBe(1);
    // Notified exactly once despite the double-tap
    expect(
      await Notification.countDocuments({
        recipient: alice.user._id,
        sender: bob.user._id,
        type: 'like',
        post: post._id,
      })
    ).toBe(1);
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

  it('a failing Like write fails the request (collection is primary now)', async () => {
    const post = await makePost();
    vi.spyOn(Like, 'updateOne').mockRejectedValueOnce(new Error('store down'));
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app)
      .get(`/api/v1/post/${post._id}/like`)
      .set('Cookie', bob.cookie);
    expect(res.status).toBe(500);
    expect(await Like.countDocuments({ user: bob.user._id, post: post._id })).toBe(0);
  });
});

describe('Follow writes (Stage 3)', () => {
  it('follow creates a Follow doc, unfollow removes it, and reads agree', async () => {
    const follow = await request(app)
      .get(`/api/v1/user/followorunfollow/${alice.user._id}`)
      .set('Cookie', bob.cookie);
    expect(follow.status).toBe(200);
    expect(follow.body.type).toBe('follow');
    expect(
      await Follow.countDocuments({ follower: bob.user._id, following: alice.user._id })
    ).toBe(1);

    // Profile counts read from the collection
    const profile = await request(app)
      .get(`/api/v1/user/${alice.user._id}/profile`)
      .set('Cookie', bob.cookie);
    expect(profile.body.user.followersCount).toBe(1);

    const unfollow = await request(app)
      .get(`/api/v1/user/followorunfollow/${alice.user._id}`)
      .set('Cookie', bob.cookie);
    expect(unfollow.status).toBe(200);
    expect(unfollow.body.type).toBe('unfollow');
    expect(
      await Follow.countDocuments({ follower: bob.user._id, following: alice.user._id })
    ).toBe(0);
  });

  it('a failing Follow write fails the request (collection is primary now)', async () => {
    vi.spyOn(Follow, 'updateOne').mockRejectedValueOnce(new Error('store down'));
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app)
      .get(`/api/v1/user/followorunfollow/${alice.user._id}`)
      .set('Cookie', bob.cookie);
    expect(res.status).toBe(500);
    expect(
      await Follow.countDocuments({ follower: bob.user._id, following: alice.user._id })
    ).toBe(0);
  });
});
