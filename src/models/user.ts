/**
 * user.ts - 用户数据模型
 */
import { getDb } from '../db/database';
import { now } from '../utils/helpers';

export interface User {
    username: string;
    password_hash: string;
    signature: string;
    created_at: number;
}

/** 查找用户 */
export function findUser(username: string): User | null {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User | null;
}

/** 通过密码哈希查找用户 */
export function findUserByPasswordHash(passwordHash: string): User | null {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users WHERE password_hash = ?');
    return stmt.get(passwordHash) as User | null;
}

/** 创建用户 */
export function createUser(username: string, passwordHash: string): boolean {
    const db = getDb();
    const stmt = db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)');
    try {
        stmt.run(username, passwordHash, now());
        return true;
    } catch {
        return false;
    }
}

/** 更新用户签名 */
export function updateSignature(username: string, signature: string): void {
    const db = getDb();
    const stmt = db.prepare('UPDATE users SET signature = ? WHERE username = ?');
    stmt.run(signature, username);
}

/** 更新用户名 */
export function updateUsername(oldUsername: string, newUsername: string): boolean {
    const db = getDb();
    const stmt = db.prepare('UPDATE users SET username = ? WHERE username = ?');
    try {
        stmt.run(newUsername, oldUsername);
        return true;
    } catch {
        return false;
    }
}

/** 更新密码 */
export function updatePassword(username: string, newPasswordHash: string): void {
    const db = getDb();
    const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?');
    stmt.run(newPasswordHash, username);
}

/** 获取所有用户（排除指定用户） */
export function getAllUsers(exclude?: string): User[] {
    const db = getDb();
    if (exclude) {
        const stmt = db.prepare('SELECT * FROM users WHERE username != ? ORDER BY created_at DESC');
        return stmt.all(exclude) as User[];
    }
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    return stmt.all() as User[];
}

/** 检查用户是否存在 */
export function userExists(username: string): boolean {
    const db = getDb();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?');
    const row = stmt.get(username) as { count: number };
    return row.count > 0;
}