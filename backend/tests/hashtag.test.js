import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Post } from '../models/post.model.js';
import { Notification } from '../models/notification.model.js';
import { extractHashtags, extractMentions } from '../utils/textEntities.js';
import { createUserAndLogin } from './helpers.js';

let author; // { cookie, user }
let mentioned; // gets @mentioned in a comment

beforeAll(async () => {
  author = await createUserAndLogin({ username: 'tagauthor', email: 'tagauthor@example.com' });
  mentioned = await createUserAndLogin({ username: 'tagfriend', email: 'tagfriend@example.com' });
});

describe('textEntities', () => {
  it('extracts lowercased unique hashtags and mention usernames', () => {
    expect(extractHashtags('Sunset #Beach #beach vibes #summer_24')).toEqual(['beach', 'summer_24']);
    expect(extractMentions('shot with @tagfriend and @no')).toEqual(['tagfriend']); // @no too short
  });
});

describe('GET /api/v1/post/tags/:tag', () => {
  it('returns posts carrying the tag with stage-2 like fields', async () => {
    await Post.deleteMany({});
    const post = await Post.create({
      caption: 'golden hour #sunset',
      image: 'https://example.com/x.jpg',
      author: author.user._id,
      hashtags: ['sunset'],
    });
    await Post.create({
      caption: 'no tags here',
      image: 'https://example.com/y.jpg',
      author: author.user._id,
    });

    const res = await request(app).get('/api/v1/post/tags/sunset');
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0]._id).toBe(post._id.toString());
    expect(res.body.posts[0].likesCount).toBe(0);
    expect(res.body.posts[0].likes).toBeUndefined();
  });

  it('rejects malformed tags', async () => {
    const res = await request(app).get('/api/v1/post/tags/not%20a%20tag');
    expect(res.status).toBe(400);
  });
});

describe('@mentions in comments', () => {
  it('notifies the mentioned user', async () => {
    const post = await Post.create({
      caption: 'mention target',
      image: 'https://example.com/z.jpg',
      author: author.user._id,
    });
    const res = await request(app)
      .post(`/api/v1/post/${post._id}/comment`)
      .set('Cookie', author.cookie)
      .send({ text: 'ping @tagfriend' });
    expect(res.status).toBe(201);

    // notifyMentions is fire-and-forget — give it a beat to land
    await new Promise((r) => setTimeout(r, 200));
    const notif = await Notification.findOne({
      recipient: mentioned.user._id,
      type: 'mention',
      post: post._id,
    });
    expect(notif).not.toBeNull();
    expect(notif.sender.toString()).toBe(author.user._id.toString());
  });
});
