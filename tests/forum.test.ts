/**
 * forum.test.ts - 论坛系统测试
 */
import { describe, test, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import { initDb, closeDb, clearDb } from '../src/db/database';
import { createTestUser } from './test-helpers';
import { createPost, getPost, getPostList, addFloor, getPostLikes } from '../src/models/post';
import { addLike, removeLike, isLiked, getFloorLikes } from '../src/models/like';
import { addEvent, getUserEvents, getUnreadCount, markEventsRead } from '../src/models/event';
import { addFeed, getUserFeed } from '../src/models/feed';

describe('论坛系统', () => {
    beforeAll(() => {
        initDb(':memory:');
    });

    beforeEach(() => {
        clearDb();
    });

    afterAll(() => {
        closeDb();
    });

    test('创建和获取帖子', () => {
        createTestUser('alice');
        const postId = createPost('Test Post', 'alice', 'Hello World');
        expect(postId).toBeDefined();

        const post = getPost(postId);
        expect(post).toBeDefined();
        expect(post?.title).toBe('Test Post');
        expect(post?.author).toBe('alice');
        expect(post?.content).toBe('Hello World');
    });

    test('添加楼层', () => {
        createTestUser('alice');
        createTestUser('bob');
        const postId = createPost('Test Post', 'alice', 'Content');

        const floorNum = addFloor(postId, 'bob', 'Reply');
        expect(floorNum).toBe(2);

        const post = getPost(postId);
        expect(post?.floors.length).toBe(1);
        expect(post?.floors[0].content).toBe('Reply');
    });

    test('获取帖子列表', () => {
        createTestUser('alice');
        createPost('Post 1', 'alice', 'Content 1');
        createPost('Post 2', 'alice', 'Content 2');
        createPost('Post 3', 'alice', 'Content 3');

        const { posts, total } = getPostList(1, 10);
        expect(total).toBe(3);
        expect(posts.length).toBe(3);
    });

    test('帖子按更新时间倒序', () => {
        createTestUser('alice');
        createPost('Old Post', 'alice', 'Old');
        
        // Sleep 1 second to ensure different timestamps
        const start = Date.now();
        while (Date.now() - start < 1100) {} // 1.1 second delay
        
        createPost('New Post', 'alice', 'New');

        const { posts } = getPostList(1, 10);
        expect(posts[0].title).toBe('New Post');
    });

    test('点赞和取消点赞', () => {
        createTestUser('alice');
        createTestUser('bob');
        const postId = createPost('Test', 'alice', 'Content');

        expect(isLiked(postId, 1, 'bob')).toBe(false);
        
        addLike(postId, 1, 'bob');
        expect(isLiked(postId, 1, 'bob')).toBe(true);

        removeLike(postId, 1, 'bob');
        expect(isLiked(postId, 1, 'bob')).toBe(false);
    });

    test('获取楼层点赞列表', () => {
        createTestUser('alice');
        createTestUser('bob');
        createTestUser('charlie');
        const postId = createPost('Test', 'alice', 'Content');

        addLike(postId, 1, 'bob');
        addLike(postId, 1, 'charlie');

        const likes = getFloorLikes(postId, 1);
        expect(likes.length).toBe(2);
        expect(likes.includes('bob')).toBe(true);
        expect(likes.includes('charlie')).toBe(true);
    });

    test('事件系统', () => {
        createTestUser('alice');
        createTestUser('bob');

        addEvent('alice', 'reply', 'post1', 2, 'bob', 'Reply content');
        addEvent('alice', 'like', 'post1', 1, 'bob', 'Liked your post');

        const events = getUserEvents('alice');
        expect(events.length).toBe(2);
        expect(getUnreadCount('alice')).toBe(2);

        markEventsRead('alice');
        expect(getUnreadCount('alice')).toBe(0);
    });

    test('用户动态', () => {
        createTestUser('alice');

        addFeed('alice', 'post', 'New post created', '/post/1');
        addFeed('alice', 'reply', 'Replied to a post', '/post/1');

        const feed = getUserFeed('alice');
        expect(feed.length).toBe(2);
        expect(feed[0].type).toBe('reply');
        expect(feed[1].type).toBe('post');
    });

    test('帖子带引用回复', () => {
        createTestUser('alice');
        createTestUser('bob');
        const postId = createPost('Test', 'alice', 'Content');

        addFloor(postId, 'bob', 'Reply with quote', 1, 'alice');

        const post = getPost(postId);
        expect(post?.floors[0].quoted_floor).toBe(1);
        expect(post?.floors[0].quoted_user).toBe('alice');
    });

    test('帖子元数据包含统计信息', () => {
        createTestUser('alice');
        createTestUser('bob');
        const postId = createPost('Stats Post', 'alice', 'Content');

        addFloor(postId, 'bob', 'Reply 1');
        addFloor(postId, 'alice', 'Reply 2');
        addLike(postId, 1, 'bob');
        addLike(postId, 2, 'alice');

        const { posts } = getPostList(1, 10);
        const meta = posts.find(p => p.id === postId);
        expect(meta?.floor_count).toBe(3);
        expect(meta?.like_count).toBe(2);
    });
});