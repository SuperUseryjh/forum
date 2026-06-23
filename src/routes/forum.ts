/**
 * forum.ts - 论坛路由
 */
import { Router } from '../lib/bun-http';
import { findUserByCredential } from '../models/user';
import { createPost, getPost, getPostList, addFloor, getPostLikes } from '../models/post';
import { addLike, removeLike, isLiked, getFloorLikes } from '../models/like';
import { addEvent, getUserEvents, getUnreadCount, markEventsRead } from '../models/event';
import { addFeed, getUserFeed } from '../models/feed';
import { getCredential } from '../middleware/auth';
import { q, formatMessageTime, now } from '../utils/helpers';

const FORUM_PAGE_SIZE = 30;

const router = new Router();

// 获取导航栏通用数据
async function getNavData(cred: string) {
    const user = findUserByCredential(cred);
    const unreadCount = user ? getUnreadCount(user.username) : 0;
    return { user, credential: cred, unreadCount };
}

// GET /forum - 论坛帖子列表
router.get('/', async (req, res) => {
    const cred = getCredential(req);
    const navData = await getNavData(cred);

    if (!navData.user) {
        return res.redirect('/login?err=unauthorized');
    }

    const page = Math.max(1, parseInt((req.query.p as string) || '1', 10));
    const { posts, total } = getPostList(page, FORUM_PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(total / FORUM_PAGE_SIZE));

    await res.render('forum-list', {
        ...navData,
        posts,
        page,
        totalPages,
        total,
        q,
        formatMessageTime,
    });
});

// GET /forum/post - 发帖页面
router.get('/post', async (req, res) => {
    const cred = getCredential(req);
    const navData = await getNavData(cred);

    if (!navData.user) {
        return res.redirect('/login?err=unauthorized');
    }

    await res.render('forum-post', {
        ...navData,
        err: req.query.err as string,
        q,
    });
});

// POST /forum/api/create_post - 创建帖子
router.post('/api/create_post', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.redirect('/forum');
    }

    const title: string = (req.body.title as string) || '';
    const content: string = (req.body.content as string) || '';

    if (!title.trim() || !content.trim()) {
        return res.redirect('/forum/post?err=empty&credential=' + encodeURIComponent(cred));
    }

    const postId = createPost(title, user.username, content);
    addFeed(user.username, 'post', '发帖：' + title + '\n' + content, `/forum/post/${postId}?credential=${encodeURIComponent(cred)}`);

    const goto = (req.body.goto as string) || 'list';
    if (goto === 'post') {
        return res.redirect(`/forum/post/${postId}?credential=${encodeURIComponent(cred)}`);
    }
    res.redirect('/forum?credential=' + encodeURIComponent(cred));
});

// GET /forum/post/:id - 查看帖子
router.get('/post/:id', async (req, res) => {
    const cred = getCredential(req);
    const navData = await getNavData(cred);

    if (!navData.user) {
        return res.redirect('/login?err=unauthorized');
    }

    const postId = req.params.id;
    const post = getPost(postId);

    if (!post) {
        return res.redirect('/forum');
    }

    const floorCount = 1 + post.floors.length;
    const likes = getPostLikes(postId, floorCount);

    await res.render('forum-post-view', {
        ...navData,
        post,
        likes,
        floorCount,
        q,
        formatMessageTime,
    });
});

// POST /forum/api/add_floor - 添加回复
router.post('/api/add_floor', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.json({ error: '凭证无效' });
    }

    const postId: string = (req.body.post_id as string) || '';
    const content: string = (req.body.content as string) || '';
    const quotedFloor = parseInt((req.body.quoted_floor as string) || '0', 10);
    const quotedUser: string = (req.body.quoted_user as string) || '';

    if (!postId || !content.trim()) {
        return res.json({ error: '内容不能为空' });
    }

    const post = getPost(postId);
    if (!post) {
        return res.json({ error: '帖子不存在' });
    }

    const floorNum = addFloor(postId, user.username, content, quotedFloor || undefined, quotedUser || undefined);

    // 添加事件通知
    addEvent(post.author, 'reply', postId, floorNum, user.username, content);
    if (quotedUser && quotedUser !== user.username) {
        addEvent(quotedUser, 'reply', postId, quotedFloor, user.username, content);
    }

    // 添加动态
    addFeed(user.username, 'reply', '回复了《' + post.title + '》：' + content, `/forum/post/${postId}?credential=${encodeURIComponent(cred)}`);

    if (req.body.ajax === '1') {
        return res.json({ ok: true, floor: floorNum });
    }

    res.redirect(`/forum/post/${postId}?credential=${encodeURIComponent(cred)}`);
});

// POST /forum/api/like - 点赞
router.post('/api/like', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.json({ error: '凭证无效' });
    }

    const postId: string = (req.body.post_id as string) || '';
    const floor = parseInt((req.body.floor as string) || '0', 10);

    if (!postId) {
        return res.json({ error: '缺少帖子' });
    }

    if (isLiked(postId, floor, user.username)) {
        return res.json({ ok: true, liked: true });
    }

    addLike(postId, floor, user.username);

    // 添加事件通知
    const post = getPost(postId);
    if (post) {
        const title = post.title;
        if (floor === 1) {
            addEvent(post.author, 'like', postId, floor, user.username, `赞了你的帖子《${title}》`);
        } else {
            // 查找该楼层作者
            const floorInfo = post.floors.find(f => f.floor_num === floor);
            if (floorInfo && floorInfo.author !== post.author) {
                addEvent(floorInfo.author, 'like', postId, floor, user.username, `赞了你在《${title}》第${floor}楼的回复`);
            }
            addEvent(post.author, 'like', postId, floor, user.username, `赞了你的帖子《${title}》第${floor}楼`);
        }
    }

    res.json({ ok: true, liked: true });
});

// POST /forum/api/unlike - 取消点赞
router.post('/api/unlike', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.json({ error: '凭证无效' });
    }

    const postId: string = (req.body.post_id as string) || '';
    const floor = parseInt((req.body.floor as string) || '0', 10);

    removeLike(postId, floor, user.username);

    const post = getPost(postId);
    if (post && floor > 1) {
        const floorInfo = post.floors.find(f => f.floor_num === floor);
        if (floorInfo) {
            addEvent(floorInfo.author, 'unlike', postId, floor, user.username, `取消赞了你在《${post.title}》第${floor}楼的回复`);
        }
    }

    res.json({ ok: true, liked: false });
});

// GET /forum/events - 事件通知页面
router.get('/events', async (req, res) => {
    const cred = getCredential(req);
    const navData = await getNavData(cred);

    if (!navData.user) {
        return res.redirect('/login?err=unauthorized');
    }

    const events = getUserEvents(navData.user.username);
    events.reverse();

    await res.render('forum-events', {
        ...navData,
        events,
        q,
        formatMessageTime,
    });
});

// POST /forum/api/mark_events_read - 标记事件已读
router.post('/api/mark_events_read', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.redirect('/forum/events');
    }

    markEventsRead(user.username);
    res.redirect('/forum/events?credential=' + encodeURIComponent(cred));
});

export const forumRouter = router;
