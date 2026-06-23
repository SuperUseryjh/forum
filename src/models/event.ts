/**
 * event.ts - 事件/通知数据模型
 */
import { getDb } from '../db/database';
import { now } from '../utils/helpers';

export interface Event {
    id: number;
    to_user: string;
    type: string;
    post_id: string;
    floor_num: number;
    from_user: string | null;
    content: string | null;
    time: number;
    is_read: number;
}

/** 添加事件 */
export function addEvent(
    toUser: string,
    type: string,
    postId: string,
    floorNum: number,
    fromUser: string | null,
    content: string | null = null
): void {
    const db = getDb();
    const stmt = db.prepare(
        'INSERT INTO events (to_user, type, post_id, floor_num, from_user, content, time, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
    );
    stmt.run(toUser, type, postId, floorNum, fromUser, content, now());
}

/** 获取用户的事件列表 */
export function getUserEvents(username: string): Event[] {
    const db = getDb();
    const stmt = db.prepare(
        'SELECT * FROM events WHERE to_user = ? ORDER BY time ASC, id ASC'
    );
    return stmt.all(username) as Event[];
}

/** 获取未读事件数 */
export function getUnreadCount(username: string): number {
    const db = getDb();
    const stmt = db.prepare(
        'SELECT COUNT(*) as count FROM events WHERE to_user = ? AND is_read = 0'
    );
    const row = stmt.get(username) as { count: number } | undefined;
    return row ? row.count : 0;
}

/** 标记所有事件为已读 */
export function markEventsRead(username: string): void {
    const db = getDb();
    const stmt = db.prepare(
        'UPDATE events SET is_read = 1 WHERE to_user = ?'
    );
    stmt.run(username);
}
