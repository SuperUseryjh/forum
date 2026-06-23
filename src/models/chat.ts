/**
 * chat.ts - 私聊数据模型
 */
import { getDb } from '../db/database';
import { now } from '../utils/helpers';

export interface ChatMessage {
    id: number;
    user1: string;
    user2: string;
    from_user: string;
    to_user: string;
    text: string;
    time: number;
}

export interface ChatSession {
    other: string;
    signature: string;
    last_other_msg_ts: number | null;
}

/** 规范化用户顺序 */
function normalizeUsers(u1: string, u2: string): [string, string] {
    return u1 < u2 ? [u1, u2] : [u2, u1];
}

/** 保存消息 */
export function saveMessage(user1: string, user2: string, fromUser: string, toUser: string, text: string): void {
    const db = getDb();
    const [a, b] = normalizeUsers(user1, user2);
    const stmt = db.prepare(
        'INSERT INTO chat_messages (user1, user2, from_user, to_user, text, time) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(a, b, fromUser, toUser, text, now());
}

/** 加载私聊消息 */
export function loadChatMessages(user1: string, user2: string): ChatMessage[] {
    const db = getDb();
    const [a, b] = normalizeUsers(user1, user2);
    const stmt = db.prepare(
        'SELECT * FROM chat_messages WHERE user1 = ? AND user2 = ? ORDER BY time ASC, id ASC'
    );
    return stmt.all(a, b) as ChatMessage[];
}

/** 获取用户的私聊会话列表 */
export function getChatSessions(username: string, userSignatures: Record<string, string>): ChatSession[] {
    const db = getDb();
    const stmt = db.prepare(`
        SELECT DISTINCT
            CASE WHEN user1 = ? THEN user2 ELSE user1 END as other_user
        FROM chat_messages
        WHERE user1 = ? OR user2 = ?
        ORDER BY (
            SELECT MAX(time) FROM chat_messages cm2 
            WHERE cm2.user1 = chat_messages.user1 AND cm2.user2 = chat_messages.user2
        ) DESC
    `);
    const rows = stmt.all(username, username, username) as { other_user: string }[];

    const sessions: ChatSession[] = [];
    for (const row of rows) {
        const other = row.other_user;
        const lastMsg = getLastOtherMessageTime(username, other);
        sessions.push({
            other,
            signature: userSignatures[other] || '',
            last_other_msg_ts: lastMsg,
        });
    }
    return sessions;
}

/** 获取对方最后一次发消息的时间 */
export function getLastOtherMessageTime(currentUser: string, otherUser: string): number | null {
    const db = getDb();
    const [a, b] = normalizeUsers(currentUser, otherUser);
    const stmt = db.prepare(`
        SELECT time FROM chat_messages 
        WHERE user1 = ? AND user2 = ? AND from_user = ? 
        ORDER BY time DESC, id DESC 
        LIMIT 1
    `);
    const row = stmt.get(a, b, otherUser) as { time: number } | undefined;
    return row ? row.time : null;
}
