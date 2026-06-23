/**
 * database.ts - SQLite 数据库连接和表结构初始化
 */
import { Database } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

export function getDb(): Database {
    if (!db) {
        throw new Error('Database not initialized. Call initDb() first.');
    }
    return db;
}

export function initDb(overridePath?: string): Database {
    const targetPath = overridePath || process.env.DB_PATH || './data/forum.db';

    // Close existing connection
    if (db) {
        db.close();
        db = null;
    }

    if (targetPath === ':memory:' || process.env.NODE_ENV === 'test') {
        db = new Database(':memory:');
    } else {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        db = new Database(targetPath);
        db.exec('PRAGMA journal_mode = WAL;');
    }

    db.exec('PRAGMA foreign_keys = ON;');

    // Drop all tables first to ensure clean state
    db.exec(`
        DROP TABLE IF EXISTS feeds;
        DROP TABLE IF EXISTS events;
        DROP TABLE IF EXISTS likes;
        DROP TABLE IF EXISTS post_floors;
        DROP TABLE IF EXISTS posts;
        DROP TABLE IF EXISTS chat_messages;
        DROP TABLE IF EXISTS users;
    `);

    // 创建用户表
    db.exec(`
        CREATE TABLE users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            signature TEXT DEFAULT '',
            created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
    `);

    // 创建私聊消息表
    db.exec(`
        CREATE TABLE chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user1 TEXT NOT NULL,
            user2 TEXT NOT NULL,
            from_user TEXT NOT NULL,
            to_user TEXT NOT NULL,
            text TEXT NOT NULL,
            time INTEGER NOT NULL DEFAULT (unixepoch())
        )
    `);
    db.exec('CREATE INDEX idx_chat_users ON chat_messages(user1, user2, time)');

    // 创建帖子表
    db.exec(`
        CREATE TABLE posts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
    `);

    // 创建帖子回复表
    db.exec(`
        CREATE TABLE post_floors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id TEXT NOT NULL,
            floor_num INTEGER NOT NULL,
            author TEXT NOT NULL,
            content TEXT NOT NULL,
            time INTEGER NOT NULL DEFAULT (unixepoch()),
            quoted_floor INTEGER,
            quoted_user TEXT,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        )
    `);
    db.exec('CREATE INDEX idx_floors_post ON post_floors(post_id, floor_num)');

    // 创建点赞表
    db.exec(`
        CREATE TABLE likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id TEXT NOT NULL,
            floor_num INTEGER NOT NULL,
            username TEXT NOT NULL,
            time INTEGER NOT NULL DEFAULT (unixepoch()),
            UNIQUE(post_id, floor_num, username)
        )
    `);
    db.exec('CREATE INDEX idx_likes_post_floor ON likes(post_id, floor_num)');

    // 创建事件/通知表
    db.exec(`
        CREATE TABLE events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            to_user TEXT NOT NULL,
            type TEXT NOT NULL,
            post_id TEXT NOT NULL DEFAULT '',
            floor_num INTEGER NOT NULL DEFAULT 0,
            from_user TEXT,
            content TEXT,
            time INTEGER NOT NULL DEFAULT (unixepoch()),
            is_read INTEGER NOT NULL DEFAULT 0
        )
    `);
    db.exec('CREATE INDEX idx_events_user ON events(to_user, is_read, time)');

    // 创建用户动态表
    db.exec(`
        CREATE TABLE feeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            type TEXT NOT NULL,
            text TEXT NOT NULL,
            link TEXT,
            time INTEGER NOT NULL DEFAULT (unixepoch())
        )
    `);
    db.exec('CREATE INDEX idx_feeds_user ON feeds(username, time)');

    return db;
}

export function closeDb(): void {
    if (db) {
        db.close();
        db = null;
    }
}

/** 清空所有表数据（用于测试重置） */
export function clearDb(): void {
    if (!db) return;
    db.exec(`
        DELETE FROM feeds;
        DELETE FROM events;
        DELETE FROM likes;
        DELETE FROM post_floors;
        DELETE FROM posts;
        DELETE FROM chat_messages;
        DELETE FROM users;
    `);
}
