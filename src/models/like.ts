/**
 * like.ts - 点赞数据模型
 */
import { getDb } from '../db/database';
import { now } from '../utils/helpers';

/** 点赞 */
export function addLike(postId: string, floorNum: number, username: string): boolean {
    const db = getDb();
    try {
        const stmt = db.prepare(
            'INSERT OR IGNORE INTO likes (post_id, floor_num, username, time) VALUES (?, ?, ?, ?)'
        );
        const result = stmt.run(postId, floorNum, username, now());
        return result.changes > 0;
    } catch {
        return false;
    }
}

/** 取消点赞 */
export function removeLike(postId: string, floorNum: number, username: string): void {
    const db = getDb();
    const stmt = db.prepare(
        'DELETE FROM likes WHERE post_id = ? AND floor_num = ? AND username = ?'
    );
    stmt.run(postId, floorNum, username);
}

/** 检查是否已点赞 */
export function isLiked(postId: string, floorNum: number, username: string): boolean {
    const db = getDb();
    const stmt = db.prepare(
        'SELECT 1 as has_liked FROM likes WHERE post_id = ? AND floor_num = ? AND username = ?'
    );
    const result = stmt.get(postId, floorNum, username);
    return result !== undefined && result !== null;
}

/** 获取楼层的点赞用户列表 */
export function getFloorLikes(postId: string, floorNum: number): string[] {
    const db = getDb();
    const stmt = db.prepare(
        'SELECT username FROM likes WHERE post_id = ? AND floor_num = ? ORDER BY time ASC'
    );
    const rows = stmt.all(postId, floorNum) as { username: string }[];
    return rows.map(r => r.username);
}
