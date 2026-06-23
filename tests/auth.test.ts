/**
 * auth.test.ts - 用户认证测试
 */
import { describe, test, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import { initDb, closeDb, clearDb } from '../src/db/database';
import { createUser, findUser, userExists, updateSignature, updateUsername, getAllUsers } from '../src/models/user';
import { hashPassword, verifyPassword } from '../src/utils/password';
import { createToken, verifyToken } from '../src/utils/jwt';

describe('用户认证系统', () => {
    beforeAll(() => {
        initDb(':memory:');
    });

    beforeEach(() => {
        clearDb();
    });

    afterAll(() => {
        closeDb();
    });

    test('创建用户', () => {
        const passwordHash = hashPassword('password123');
        const success = createUser('testuser', passwordHash);
        expect(success).toBe(true);
    });

    test('查找用户', () => {
        const passwordHash = hashPassword('password123');
        createUser('testuser', passwordHash);
        const user = findUser('testuser');
        expect(user).toBeDefined();
        expect(user?.username).toBe('testuser');
        expect(user?.password_hash).toBeDefined();
    });

    test('密码哈希和验证', () => {
        const hash = hashPassword('mySecretPassword');
        expect(hash).toContain(':');
        expect(verifyPassword('mySecretPassword', hash)).toBe(true);
        expect(verifyPassword('wrongPassword', hash)).toBe(false);
    });

    test('检查用户是否存在', () => {
        const passwordHash = hashPassword('password123');
        createUser('testuser', passwordHash);
        expect(userExists('testuser')).toBe(true);
        expect(userExists('nonexistent')).toBe(false);
    });

    test('更新用户签名', () => {
        const passwordHash = hashPassword('password123');
        createUser('testuser', passwordHash);
        updateSignature('testuser', 'Hello World');
        const user = findUser('testuser');
        expect(user?.signature).toBe('Hello World');
    });

    test('获取所有用户', () => {
        const hash = hashPassword('password123');
        createUser('user1', hash);
        createUser('user2', hash);
        createUser('user3', hash);

        const all = getAllUsers();
        expect(all.length).toBe(3);

        const excluding = getAllUsers('user1');
        expect(excluding.length).toBe(2);
        expect(excluding.find(u => u.username === 'user1')).toBeUndefined();
    });

    test('重复创建用户会失败', () => {
        const hash = hashPassword('password123');
        expect(createUser('testuser', hash)).toBe(true);
        expect(createUser('testuser', hash)).toBe(false);
    });

    test('JWT token 创建和验证', () => {
        const token = createToken('testuser');
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');

        const decoded = verifyToken(token);
        expect(decoded).not.toBeNull();
        expect(decoded?.username).toBe('testuser');
    });

    test('无效 JWT token 验证失败', () => {
        const decoded = verifyToken('invalid.token.here');
        expect(decoded).toBeNull();
    });

    test('修改用户名', () => {
        const hash = hashPassword('password123');
        createUser('oldname', hash);
        updateUsername('oldname', 'newname');

        expect(userExists('oldname')).toBe(false);
        expect(userExists('newname')).toBe(true);

        const user = findUser('newname');
        expect(user?.username).toBe('newname');
    });
});