/**
 * app.ts - 应用入口
 */
import { App, Router } from './lib/bun-http';
import { initDb, closeDb } from './db/database';
import { findUser, getAllUsers, userExists, createUser, updateSignature, updateUsername } from './models/user';
import { saveMessage, loadChatMessages, getChatSessions, getLastOtherMessageTime } from './models/chat';
import { createPost, getPost, getPostList, addFloor, getPostLikes } from './models/post';
import { addLike, removeLike, isLiked, getFloorLikes } from './models/like';
import { addEvent, getUserEvents, getUnreadCount, markEventsRead } from './models/event';
import { addFeed, getUserFeed } from './models/feed';
import { q, formatMessageTime, now } from './utils/helpers';
import { getCurrentUser } from './middleware/auth';
import { createToken } from './utils/jwt';
import { hashPassword } from './utils/password';

// 初始化数据库
initDb();

// 创建应用
const app = new App();
const router = new Router();

const FORUM_PAGE_SIZE = 30;

// ============================================================
// 辅助函数
// ============================================================

function requireAuth(req: any, res: any): { username: string } | null {
    const user = getCurrentUser(req);
    if (!user) {
        res.redirect('/login?err=unauthorized');
        return null;
    }
    return { username: user.username };
}

function getNavData(req: any) {
    const user = getCurrentUser(req);
    const unreadCount = user ? getUnreadCount(user.username) : 0;
    return { user, unreadCount, q, formatMessageTime };
}

function buildUrl(path: string, extra: Record<string, string> = {}): string {
    const qs = new URLSearchParams(extra).toString();
    return qs ? `${path}?${qs}` : path;
}

// ============================================================
// 页面路由
// ============================================================

// 首页
router.get('/', async (req, res) => {
    const user = getCurrentUser(req);
    await res.render('home', { user });
});

// 注册页
router.get('/register', async (req, res) => {
    await res.render('register', { err: req.query.err as string });
});

// 登录页
router.get('/login', async (req, res) => {
    await res.render('login', { err: req.query.err as string });
});

// 发帖页
router.get('/forum/post', async (req, res) => {
    const navData = getNavData(req);
    if (!navData.user) return res.redirect('/login?err=unauthorized');
    await res.render('forum-post', { ...navData, err: req.query.err as string });
});

// 查看帖子
router.get('/forum/post/:id', async (req, res) => {
    const navData = getNavData(req);
    if (!navData.user) return res.redirect('/login?err=unauthorized');

    const post = getPost(req.params.id);
    if (!post) return res.redirect('/forum');

    const floorCount = 1 + post.floors.length;
    const likes = getPostLikes(post.id, floorCount);

    await res.render('forum-post-view', { ...navData, post, likes, floorCount });
});

// 事件通知页
router.get('/forum/events', async (req, res) => {
    const navData = getNavData(req);
    if (!navData.user) return res.redirect('/login?err=unauthorized');

    const events = getUserEvents(navData.user.username).reverse();
    await res.render('forum-events', { ...navData, events });
});

// 论坛列表
router.get('/forum', async (req, res) => {
    const navData = getNavData(req);
    if (!navData.user) return res.redirect('/login?err=unauthorized');

    const page = Math.max(1, parseInt((req.query.p as string) || '1', 10));
    const { posts, total } = getPostList(page, FORUM_PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(total / FORUM_PAGE_SIZE));

    await res.render('forum-list', { ...navData, posts, page, totalPages, total });
});

// 用户中心
router.get('/profile', async (req, res) => {
    const user = getCurrentUser(req);
    if (!user) return res.redirect('/login?err=unauthorized');
    await res.render('profile', { user, q, err: req.query.err as string });
});

// 用户主页
router.get('/user/:username', async (req, res) => {
    const currentUser = getCurrentUser(req);
    if (!currentUser) return res.redirect('/login?err=unauthorized');

    const viewUser = findUser(req.params.username);
    if (!viewUser) return res.redirect('/forum');

    const feed = getUserFeed(viewUser.username);
    await res.render('user-page', { currentUser, viewUser, feed, q, formatMessageTime });
});

// 私聊页
router.get('/chat', async (req, res) => {
    const user = getCurrentUser(req);
    if (!user) return res.redirect('/login?err=unauthorized');

    const allUsers = getAllUsers(user.username);
    const userSignatures: Record<string, string> = {};
    for (const u of allUsers) {
        userSignatures[u.username] = u.signature;
    }

    const sessions = getChatSessions(user.username, userSignatures);
    const selectedChat = (req.query.chat as string) || '';
    const messages = selectedChat && findUser(selectedChat) ? loadChatMessages(user.username, selectedChat) : [];

    await res.render('chat', {
        user, sessions, selectedChat, messages, q,
        err: req.query.err as string,
    });
});

// ============================================================
// API 路由
// ============================================================

// 注册
router.post('/api/register', async (req, res) => {
    const username: string = (req.body.username as string) || '';
    const password: string = (req.body.password as string) || '';
    if (!username.trim()) return res.redirect('/register?err=empty_username');
    if (username.includes('_') || username.includes('/') || username.includes('*')) return res.redirect('/register?err=invalid_chars');
    if (userExists(username)) return res.redirect('/register?err=username_exists');
    if (!password || password.length < 4) return res.redirect('/register?err=password_too_short');

    const passwordHash = hashPassword(password);
    const success = createUser(username, passwordHash);
    if (!success) return res.redirect('/register?err=username_exists');

    // Auto login after registration
    const token = createToken(username);
    res.cookie('token', token, { maxAge: 7 * 24 * 60 * 60, httpOnly: true, path: '/' });
    res.redirect('/chat');
});

// 登录
router.post('/api/login', async (req, res) => {
    const username: string = (req.body.username as string) || '';
    const password: string = (req.body.password as string) || '';

    const user = findUser(username);
    const { verifyPassword } = await import('./utils/password');
    if (!user || !verifyPassword(password, user.password_hash)) {
        return res.redirect('/login?err=invalid_credentials');
    }

    const { createToken } = await import('./utils/jwt');
    const token = createToken(user.username);
    res.cookie('token', token, { maxAge: 7 * 24 * 60 * 60, httpOnly: true, path: '/' });
    res.redirect('/chat');
});

// 开启私聊
router.post('/api/start_chat', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const other: string = (req.body.other_username as string) || '';
    if (!other.trim()) return res.redirect(buildUrl('/chat', { err: 'no_user' }));
    if (!findUser(other)) return res.redirect(buildUrl('/chat', { err: 'user_not_found' }));
    if (other === auth.username) return res.redirect(buildUrl('/chat', { err: 'self' }));

    res.redirect(buildUrl('/chat', { chat: other }));
});

// 发送消息
router.post('/api/send_message', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const chat: string = (req.body.chat as string) || '';
    const text: string = (req.body.text as string) || '';
    if (!chat || !text) {
        if (req.body.ajax === '1') return res.json({ error: '缺少聊天对象或消息内容' });
        return res.redirect(buildUrl('/chat'));
    }
    if (!findUser(chat)) {
        if (req.body.ajax === '1') return res.json({ error: '用户不存在' });
        return res.redirect(buildUrl('/chat'));
    }

    saveMessage(auth.username, chat, auth.username, chat, text);
    if (req.body.ajax === '1') return res.json({ ok: true });
    res.redirect(buildUrl('/chat', { chat, autoscroll: '1' }));
});

// 获取聊天列表（AJAX）
router.get('/api/chat_list', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return res.json({ error: '凭证无效', chats: [] });

    const allUsers = getAllUsers(auth.username);
    const userSignatures: Record<string, string> = {};
    for (const u of allUsers) userSignatures[u.username] = u.signature;

    const sessions = getChatSessions(auth.username, userSignatures);
    res.json({ chats: sessions });
});

// 获取聊天消息（AJAX）
router.get('/api/chat_messages', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return res.json({ error: '凭证无效', messages: [] });

    const chat = (req.query.chat as string) || '';
    if (!chat) return res.json({ messages: [] });

    const messages = loadChatMessages(auth.username, chat);
    res.json({ messages });
});

// 创建帖子
router.post('/api/create_post', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const title: string = (req.body.title as string) || '';
    const content: string = (req.body.content as string) || '';
    if (!title.trim() || !content.trim()) return res.redirect(buildUrl('/forum/post', { err: 'empty' }));

    const postId = createPost(title, auth.username, content);
    addFeed(auth.username, 'post', `发帖：${title}\n${content}`, buildUrl(`/forum/post/${postId}`));

    const goto = (req.body.goto as string) || 'list';
    if (goto === 'post') return res.redirect(buildUrl(`/forum/post/${postId}`));
    res.redirect(buildUrl('/forum'));
});

// 添加回复
router.post('/api/add_floor', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return res.json({ error: '凭证无效' });

    const postId: string = (req.body.post_id as string) || '';
    const content: string = (req.body.content as string) || '';
    const quotedFloor = parseInt((req.body.quoted_floor as string) || '0', 10);
    const quotedUser: string = (req.body.quoted_user as string) || '';

    if (!postId || !content.trim()) return res.json({ error: '内容不能为空' });

    const post = getPost(postId);
    if (!post) return res.json({ error: '帖子不存在' });

    const floorNum = addFloor(postId, auth.username, content, quotedFloor || undefined, quotedUser || undefined);

    addEvent(post.author, 'reply', postId, floorNum, auth.username, content);
    if (quotedUser && quotedUser !== auth.username) {
        addEvent(quotedUser, 'reply', postId, quotedFloor, auth.username, content);
    }
    addFeed(auth.username, 'reply', `回复了《${post.title}》：${content}`, buildUrl(`/forum/post/${postId}`));

    if (req.body.ajax === '1') return res.json({ ok: true, floor: floorNum });
    res.redirect(buildUrl(`/forum/post/${postId}`));
});

// 点赞
router.post('/api/like', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return res.json({ error: '凭证无效' });

    const postId: string = (req.body.post_id as string) || '';
    const floor = parseInt((req.body.floor as string) || '0', 10);
    if (!postId) return res.json({ error: '缺少帖子' });
    if (isLiked(postId, floor, auth.username)) return res.json({ ok: true, liked: true });

    addLike(postId, floor, auth.username);

    const post = getPost(postId);
    if (post) {
        if (floor === 1) {
            addEvent(post.author, 'like', postId, floor, auth.username, `赞了你的帖子《${post.title}》`);
        } else {
            const floorInfo = post.floors.find(f => f.floor_num === floor);
            if (floorInfo && floorInfo.author !== post.author) {
                addEvent(floorInfo.author, 'like', postId, floor, auth.username, `赞了你在《${post.title}》第${floor}楼的回复`);
            }
            addEvent(post.author, 'like', postId, floor, auth.username, `赞了你的帖子《${post.title}》第${floor}楼`);
        }
    }

    res.json({ ok: true, liked: true });
});

// 取消点赞
router.post('/api/unlike', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return res.json({ error: '凭证无效' });

    const postId: string = (req.body.post_id as string) || '';
    const floor = parseInt((req.body.floor as string) || '0', 10);
    removeLike(postId, floor, auth.username);

    const post = getPost(postId);
    if (post && floor > 1) {
        const floorInfo = post.floors.find(f => f.floor_num === floor);
        if (floorInfo) {
            addEvent(floorInfo.author, 'unlike', postId, floor, auth.username, `取消赞了你在《${post.title}》第${floor}楼的回复`);
        }
    }

    res.json({ ok: true, liked: false });
});

// 标记事件已读
router.post('/api/mark_events_read', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return res.redirect('/forum/events');
    markEventsRead(auth.username);
    res.redirect(buildUrl('/forum/events'));
});

// 设置签名
router.post('/api/set_signature', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const signature: string = (req.body.signature as string) || '';
    updateSignature(auth.username, signature);
    addFeed(auth.username, 'signature', `修改了个性签名：\n${signature}`);
    res.redirect(buildUrl('/profile'));
});

// 修改用户名
router.post('/api/change_username', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return res.redirect('/login?err=unauthorized');

    const newUsername: string = (req.body.new_username as string) || '';
    if (!newUsername.trim()) return res.redirect('/profile?err=empty_username');
    if (newUsername.includes('_') || newUsername.includes('/') || newUsername.includes('*')) return res.redirect('/profile?err=invalid_chars');
    if (newUsername.length < 2 || newUsername.length > 20) return res.redirect('/profile?err=username_length');
    if (userExists(newUsername)) return res.redirect('/profile?err=username_exists');

    updateUsername(auth.username, newUsername);
    const token = createToken(newUsername);
    res.cookie('token', token, { maxAge: 7 * 24 * 60 * 60, httpOnly: true, path: '/' });
    res.redirect(buildUrl(`/user/${newUsername}`));
});

// 手动添加动态
router.post('/api/add_feed', async (req, res) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const feedText: string = (req.body.feed_text as string) || '';
    if (!feedText.trim()) return res.redirect(buildUrl('/profile', { feed_err: 'empty' }));

    addFeed(auth.username, 'manual', feedText);
    const goto = (req.body.goto as string) || 'profile';
    if (goto === 'home') return res.redirect(buildUrl(`/user/${auth.username}`));
    res.redirect(buildUrl('/profile'));
});

// 静态文件服务
app.use(app.static('public'));

// 注册路由
app.setRoutes(router);

// 启动服务器
const PORT = parseInt(process.env.PORT || '3000', 10);
const server = app.listen(PORT, () => {
    console.log(`🚀 服务器已启动: http://localhost:${PORT}`);
    console.log(`📦 环境: ${process.env.NODE_ENV || 'development'}`);
});

// 优雅关闭
process.on('SIGINT', () => { console.log('\n正在关闭服务器...'); closeDb(); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n正在关闭服务器...'); closeDb(); process.exit(0); });

export { app, server };