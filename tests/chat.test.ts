/**
 * chat.test.ts - 私聊系统测试
 */
import { describe, test, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import { initDb, closeDb, clearDb } from '../src/db/database';
import { createTestUser } from './test-helpers';
import { saveMessage, loadChatMessages, getChatSessions, getLastOtherMessageTime } from '../src/models/chat';

describe('私聊系统', () => {
    beforeAll(() => {
        initDb(':memory:');
    });

    beforeEach(() => {
        clearDb();
    });

    afterAll(() => {
        closeDb();
    });

    test('保存和加载消息', () => {
        createTestUser('alice');
        createTestUser('bob');

        saveMessage('alice', 'bob', 'alice', 'bob', 'Hello!');
        saveMessage('bob', 'alice', 'bob', 'alice', 'Hi there!');

        const messages = loadChatMessages('alice', 'bob');
        expect(messages.length).toBe(2);
        expect(messages[0].text).toBe('Hello!');
        expect(messages[1].text).toBe('Hi there!');
    });

    test('消息按时间排序', () => {
        createTestUser('alice');
        createTestUser('bob');

        saveMessage('alice', 'bob', 'alice', 'bob', 'First');
        saveMessage('alice', 'bob', 'alice', 'bob', 'Second');
        saveMessage('alice', 'bob', 'bob', 'alice', 'Third');

        const messages = loadChatMessages('alice', 'bob');
        expect(messages[0].text).toBe('First');
        expect(messages[1].text).toBe('Second');
        expect(messages[2].text).toBe('Third');
    });

    test('获取私聊会话列表', () => {
        createTestUser('alice');
        createTestUser('bob');
        createTestUser('charlie');

        saveMessage('alice', 'bob', 'alice', 'bob', 'Hello Bob');
        saveMessage('alice', 'charlie', 'charlie', 'alice', 'Hello Alice');

        const sessions = getChatSessions('alice', { bob: 'Bob sig', charlie: 'Charlie sig' });
        expect(sessions.length).toBe(2);
        expect(sessions.find(s => s.other === 'bob')).toBeDefined();
        expect(sessions.find(s => s.other === 'charlie')).toBeDefined();
    });

    test('获取对方最后消息时间', () => {
        createTestUser('alice');
        createTestUser('bob');

        const before = Math.floor(Date.now() / 1000);
        saveMessage('alice', 'bob', 'bob', 'alice', 'Last message');
        const after = Math.floor(Date.now() / 1000);

        const lastTime = getLastOtherMessageTime('alice', 'bob');
        expect(lastTime).toBeDefined();
        expect(lastTime).toBeGreaterThanOrEqual(before);
        expect(lastTime).toBeLessThanOrEqual(after);
    });

    test('无对方消息时返回 null', () => {
        createTestUser('alice');
        createTestUser('bob');

        const lastTime = getLastOtherMessageTime('alice', 'bob');
        expect(lastTime).toBeNull();
    });

    test('私聊消息双向对称', () => {
        createTestUser('alice');
        createTestUser('bob');

        saveMessage('alice', 'bob', 'alice', 'bob', 'Test');
        const msgs1 = loadChatMessages('alice', 'bob');
        const msgs2 = loadChatMessages('bob', 'alice');

        expect(msgs1.length).toBe(msgs2.length);
    });
});