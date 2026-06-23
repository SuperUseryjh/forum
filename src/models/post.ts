/**
 * post.ts - 帖子数据模型
 */
import { getDb } from '../db/database';
import { now, generatePostId } from '../utils/helpers';

export interface Post {
    id: string;
    title: string;
    author: string;
    content: string;
    created_at: number;
    updated_at: number;
}

export interface PostFloor {
    id: number;
    post_id: string;
    floor_num: number;
    author: string;
    content: string;
    time: number;
    quoted_floor: number | null;
    quoted_user: string | null;
}

export interface PostMeta {
    id: string;
    title: string;
    author: string;
    time: number;
    create_time: number;
    last_time: number;
    last_author: string;
    floor_count: number;
    like_count: number;
}

export interface PostWithFloors extends Post {
    floors: PostFloor[];
}

/** 创建帖子 */
export function createPost(title: string, author: string, content: string): string {
    const db = getDb();
    const id = generatePostId();
    const t = Math.floor(Date.now() / 1000);
    const stmt = db.prepare(
        'INSERT INTO posts (id, title, author, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(id, title, author, content, t, t);
    return id;
}

/** 获取帖子详情 */
export function getPost(id: string): PostWithFloors | null {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM posts WHERE id = ?');
    const post = stmt.get(id) as Post | undefined;
    if (!post) return null;

    const floorsStmt = db.prepare(
        'SELECT * FROM post_floors WHERE post_id = ? ORDER BY floor_num ASC'
    );
    const floors = floorsStmt.all(id) as PostFloor[];

    return { ...post, floors };
}

/** 添加楼层 */
export function addFloor(postId: string, author: string, content: string, quotedFloor?: number, quotedUser?: string): number {
    const db = getDb();
    const post = getPost(postId);
    if (!post) throw new Error('帖子不存在');

    const floorNum = post.floors.length + 2;
    const t = Math.floor(Date.now() / 1000);

    const stmt = db.prepare(
        'INSERT INTO post_floors (post_id, floor_num, author, content, time, quoted_floor, quoted_user) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(postId, floorNum, author, content, t, quotedFloor || null, quotedUser || null);

    // 更新帖子更新时间
    const updateStmt = db.prepare('UPDATE posts SET updated_at = ? WHERE id = ?');
    updateStmt.run(t, postId);

    return floorNum;
}

/** 获取帖子列表（分页） */
export function getPostList(page: number, pageSize: number): { posts: PostMeta[]; total: number } {
    const db = getDb();
    const offset = (page - 1) * pageSize;

    // 获取总数
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM posts');
    const total = (countStmt.get() as { count: number }).count;

    // 获取帖子列表（按更新时间倒序）
    const stmt = db.prepare(`
        SELECT id, title, author, created_at, updated_at FROM posts
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
    `);
    const posts = stmt.all(pageSize, offset) as Post[];

    // 补充元数据
    const metaList: PostMeta[] = posts.map(post => {
        const floorCount = 1 + getFloorCount(post.id);
        const likeCount = getTotalLikeCount(post.id);
        const lastFloor = getLastFloor(post.id);

        return {
            id: post.id,
            title: post.title,
            author: post.author,
            time: post.updated_at,
            create_time: post.created_at,
            last_time: lastFloor ? lastFloor.time : post.updated_at,
            last_author: lastFloor ? lastFloor.author : post.author,
            floor_count: floorCount,
            like_count: likeCount,
        };
    });

    return { posts: metaList, total };
}

/** 获取楼层数 */
function getFloorCount(postId: string): number {
    const db = getDb();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM post_floors WHERE post_id = ?');
    return (stmt.get(postId) as { count: number }).count;
}

/** 获取最后一个楼层 */
function getLastFloor(postId: string): PostFloor | null {
    const db = getDb();
    const stmt = db.prepare(
        'SELECT * FROM post_floors WHERE post_id = ? ORDER BY floor_num DESC LIMIT 1'
    );
    return stmt.get(postId) as PostFloor | null;
}

/** 获取某个楼层的点赞总数 */
function getFloorLikeCount(postId: string, floorNum: number): number {
    const db = getDb();
    const stmt = db.prepare(
        'SELECT COUNT(*) as count FROM likes WHERE post_id = ? AND floor_num = ?'
    );
    return (stmt.get(postId, floorNum) as { count: number }).count;
}

/** 获取帖子总点赞数 */
function getTotalLikeCount(postId: string): number {
    const db = getDb();
    const stmt = db.prepare(
        'SELECT COUNT(*) as count FROM likes WHERE post_id = ?'
    );
    return (stmt.get(postId) as { count: number }).count;
}

/** 获取帖子的点赞信息 */
export function getPostLikes(postId: string, floorCount: number): Record<number, string[]> {
    const db = getDb();
    const result: Record<number, string[]> = {};

    for (let f = 1; f <= floorCount; f++) {
        const stmt = db.prepare(
            'SELECT username FROM likes WHERE post_id = ? AND floor_num = ?'
        );
        const rows = stmt.all(postId, f) as { username: string }[];
        result[f] = rows.map(r => r.username);
    }

    return result;
}
