/**
 * feed.ts - 用户动态数据模型
 */
import { getDb } from '../db/database';
import { now } from '../utils/helpers';

export interface FeedItem {
    id: number;
    username: string;
    type: string;
    text: string;
    link: string | null;
    time: number;
}

/** 添加动态 */
export function addFeed(username: string, type: string, text: string, link: string | null = null): void {
    const db = getDb();
    const stmt = db.prepare(
        'INSERT INTO feeds (username, type, text, link, time) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(username, type, text, link, now());
}

/** 获取用户动态 */
export function getUserFeed(username: string): FeedItem[] {
    const db = getDb();
    const stmt = db.prepare(
        'SELECT * FROM feeds WHERE username = ? ORDER BY time DESC, id DESC'
    );
    return stmt.all(username) as FeedItem[];
}
