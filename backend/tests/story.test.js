import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Story } from '../models/story.model.js';
import { User } from '../models/user.model.js';
import { createUserAndLogin } from './helpers.js';

let viewer; // { cookie, user } — follows author
let author; // second user, posts stories
let stranger; // not followed by viewer

beforeAll(async () => {
  viewer = await createUserAndLogin({ username: 'storyviewer', email: 'storyviewer@example.com' });
  author = await createUserAndLogin({ username: 'storyauthor', email: 'storyauthor@example.com' });
  stranger = await createUserAndLogin({ username: 'storystranger', email: 'storystranger@example.com' });
  // viewer follows author
  await User.findByIdAndUpdate(viewer.user._id, { $addToSet: { following: author.user._id } });
});

// Create a story directly via the model (the HTTP path uploads to
// Cloudinary, which tests must not touch).
const makeStory = (authorId, extra = {}) =>
  Story.create({
    image: 'https://example.com/fake-story.jpg',
    author: authorId,
    ...extra,
  });

describe('GET /api/v1/story/feed', () => {
  it('returns own + followed groups (own first), excludes strangers and expired stories', async () => {
    await Story.deleteMany({});
    const mine = await makeStory(viewer.user._id);
    await makeStory(author.user._id);
    await makeStory(stranger.user._id);
    // Expired story from a followed user — must be filtered out defensively
    await makeStory(author.user._id, { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });

    const res = await request(app).get('/api/v1/story/feed').set('Cookie', viewer.cookie);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.groups).toHaveLength(2);
    // My own group first
    expect(res.body.groups[0].user.username).toBe('storyviewer');
    expect(res.body.groups[0].stories.map((s) => s._id)).toContain(mine._id.toString());
    // Followed author's group: only the fresh story, unseen
    const authorGroup = res.body.groups[1];
    expect(authorGroup.user.username).toBe('storyauthor');
    expect(authorGroup.stories).toHaveLength(1);
    expect(authorGroup.allSeen).toBe(false);
  });
});

describe('PATCH /api/v1/story/:id/seen', () => {
  it('marks a story seen and moves the all-seen group after unseen ones', async () => {
    await Story.deleteMany({});
    const story = await makeStory(author.user._id);

    const res = await request(app)
      .patch(`/api/v1/story/${story._id}/seen`)
      .set('Cookie', viewer.cookie);
    expect(res.status).toBe(200);
    const fresh = await Story.findById(story._id);
    expect(fresh.seenBy.map(String)).toContain(viewer.user._id);

    const feed = await request(app).get('/api/v1/story/feed').set('Cookie', viewer.cookie);
    const group = feed.body.groups.find((g) => g.user.username === 'storyauthor');
    expect(group.allSeen).toBe(true);
    expect(group.stories[0].seen).toBe(true);
  });
});
