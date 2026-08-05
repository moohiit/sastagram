import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { Conversation } from '../models/conversation.model.js';
import { createUserAndLogin } from './helpers.js';

let ada; // creator/admin
let bo;
let cy;
let dex; // outsider

beforeAll(async () => {
  ada = await createUserAndLogin({ username: 'groupada', email: 'groupada@example.com' });
  bo = await createUserAndLogin({ username: 'groupbo', email: 'groupbo@example.com' });
  cy = await createUserAndLogin({ username: 'groupcy', email: 'groupcy@example.com' });
  dex = await createUserAndLogin({ username: 'groupdex', email: 'groupdex@example.com' });
});

const createGroup = () =>
  request(app)
    .post('/api/v1/message/group')
    .set('Cookie', ada.cookie)
    .send({ name: 'weekend crew', participantIds: [bo.user._id, cy.user._id] });

describe('group chats', () => {
  it('creates a group, members can message, outsiders cannot', async () => {
    const created = await createGroup();
    expect(created.status).toBe(201);
    const groupId = created.body.group._id;
    expect(created.body.group.participants).toHaveLength(3);
    expect(created.body.group.admin).toBe(ada.user._id.toString());

    const sent = await request(app)
      .post(`/api/v1/message/group/${groupId}/send`)
      .set('Cookie', bo.cookie)
      .send({ message: 'hello crew' });
    expect(sent.status).toBe(201);
    expect(sent.body.newMessage.conversation).toBe(groupId);

    const history = await request(app)
      .get(`/api/v1/message/group/${groupId}`)
      .set('Cookie', cy.cookie);
    expect(history.status).toBe(200);
    expect(history.body.messages).toHaveLength(1);
    expect(history.body.messages[0].senderId.username).toBe('groupbo');

    const outsiderSend = await request(app)
      .post(`/api/v1/message/group/${groupId}/send`)
      .set('Cookie', dex.cookie)
      .send({ message: 'let me in' });
    expect(outsiderSend.status).toBe(403);

    // Group messages never leak into the DM conversation list
    const dms = await request(app)
      .get('/api/v1/message/conversations')
      .set('Cookie', bo.cookie);
    expect(dms.body.conversations).toHaveLength(0);

    // Members see the group in their list with the last-message preview
    const groups = await request(app)
      .get('/api/v1/message/group')
      .set('Cookie', cy.cookie);
    const row = groups.body.groups.find((g) => g._id === groupId);
    expect(row.lastMessage).toBe('hello crew');
  });

  it('requires at least 2 other members', async () => {
    const res = await request(app)
      .post('/api/v1/message/group')
      .set('Cookie', ada.cookie)
      .send({ name: 'too small', participantIds: [bo.user._id] });
    expect(res.status).toBe(400);
  });

  it('admin can add members; leaving transfers admin and empty groups are deleted', async () => {
    const created = await createGroup();
    const groupId = created.body.group._id;

    // Non-admin cannot add
    const denied = await request(app)
      .post(`/api/v1/message/group/${groupId}/members`)
      .set('Cookie', bo.cookie)
      .send({ userId: dex.user._id });
    expect(denied.status).toBe(403);

    // Admin adds dex
    await request(app)
      .post(`/api/v1/message/group/${groupId}/members`)
      .set('Cookie', ada.cookie)
      .send({ userId: dex.user._id })
      .expect(200);

    // Admin leaves → role passes to the next member
    await request(app)
      .delete(`/api/v1/message/group/${groupId}/members/me`)
      .set('Cookie', ada.cookie)
      .expect(200);
    let group = await Conversation.findById(groupId);
    expect(group.admin.toString()).toBe(bo.user._id.toString());
    expect(group.participants).toHaveLength(3);

    // Everyone leaves → group is deleted
    for (const member of [bo, cy, dex]) {
      await request(app)
        .delete(`/api/v1/message/group/${groupId}/members/me`)
        .set('Cookie', member.cookie)
        .expect(200);
    }
    expect(await Conversation.findById(groupId)).toBeNull();
  });
});

describe('group unread counts and shared posts', () => {
  it('tracks unread per member and resets on open; posts can be shared', async () => {
    const created = await createGroup();
    const groupId = created.body.group._id;

    await request(app)
      .post(`/api/v1/message/group/${groupId}/send`)
      .set('Cookie', ada.cookie)
      .send({ message: 'one' })
      .expect(201);
    await request(app)
      .post(`/api/v1/message/group/${groupId}/send`)
      .set('Cookie', ada.cookie)
      .send({ message: 'two' })
      .expect(201);

    // bo has 2 unread; ada (the sender) has 0
    let groups = await request(app).get('/api/v1/message/group').set('Cookie', bo.cookie);
    expect(groups.body.groups.find((g) => g._id === groupId).unread).toBe(2);
    groups = await request(app).get('/api/v1/message/group').set('Cookie', ada.cookie);
    expect(groups.body.groups.find((g) => g._id === groupId).unread).toBe(0);

    // Opening the thread stamps bo's read marker
    await request(app).get(`/api/v1/message/group/${groupId}`).set('Cookie', bo.cookie).expect(200);
    groups = await request(app).get('/api/v1/message/group').set('Cookie', bo.cookie);
    expect(groups.body.groups.find((g) => g._id === groupId).unread).toBe(0);

    // Share a post into the group
    const { Post } = await import('../models/post.model.js');
    const post = await Post.create({
      caption: 'group share',
      image: 'https://example.com/g.jpg',
      author: ada.user._id,
    });
    const shared = await request(app)
      .post(`/api/v1/message/group/${groupId}/send`)
      .set('Cookie', cy.cookie)
      .send({ postId: post._id.toString() });
    expect(shared.status).toBe(201);
    expect(shared.body.newMessage.post._id).toBe(post._id.toString());

    groups = await request(app).get('/api/v1/message/group').set('Cookie', bo.cookie);
    const row = groups.body.groups.find((g) => g._id === groupId);
    expect(row.lastMessage).toBe('Shared a post');
    expect(row.unread).toBe(1);
  });
});
