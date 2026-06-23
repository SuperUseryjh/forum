/**
 * chat.ts - 私聊路由
 */
import { Router, type ExtendedRequest, type ExtendedResponse } from '../lib/bun-http';
import { findUserByCredential, findUser, getAllUsers } from '../models/user';
import { saveMessage, loadChatMessages, getChatSessions, getLastOtherMessageTime } from '../models/chat';
import { getCredential } from '../middleware/auth';
import { q, minutesAgoText } from '../utils/helpers';

const router = new Router();

// GET /chat - 私聊页面
router.get('/', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.redirect('/login?err=unauthorized');
    }

    // 获取所有用户签名
    const allUsers = getAllUsers(user.username);
    const userSignatures: Record<string, string> = {};
    for (const u of allUsers) {
        userSignatures[u.username] = u.signature;
    }

    // 获取私聊会话列表
    const sessions = getChatSessions(user.username, userSignatures);

    // 当前选中的聊天对象
    const selectedChat = (req.query.chat as string) || '';

    // 加载消息（如果有选中的聊天）
    let messages: any[] = [];
    if (selectedChat && findUser(selectedChat)) {
        messages = loadChatMessages(user.username, selectedChat);
    }

    await res.render('chat', {
        user: user,
        credential: cred,
        sessions,
        selectedChat,
        messages,
        q,
        minutesAgoText,
        err: req.query.err as string,
    });
});

// POST /api/start_chat - 开启新私聊
router.post('/api/start_chat', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.json({ error: '凭证无效' });
    }

    const otherUsername: string = (req.body.other_username as string) || '';

    if (!otherUsername.trim()) {
        return res.redirect('/chat?err=no_user&credential=' + encodeURIComponent(cred));
    }

    if (!findUser(otherUsername)) {
        return res.redirect('/chat?err=user_not_found&credential=' + encodeURIComponent(cred));
    }

    if (otherUsername === user.username) {
        return res.redirect('/chat?err=self&credential=' + encodeURIComponent(cred));
    }

    res.redirect('/chat?credential=' + encodeURIComponent(cred) + '&chat=' + encodeURIComponent(otherUsername));
});

// POST /api/send_message - 发送消息
router.post('/api/send_message', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.json({ error: '凭证无效' });
    }

    const chat: string = (req.body.chat as string) || '';
    const text: string = (req.body.text as string) || '';

    if (!chat || !text) {
        return res.json({ error: '缺少聊天对象或消息内容' });
    }

    if (!findUser(chat)) {
        return res.json({ error: '用户不存在' });
    }

    saveMessage(user.username, chat, user.username, chat, text);

    if (req.body.ajax === '1') {
        return res.json({ ok: true });
    }

    res.redirect('/chat?credential=' + encodeURIComponent(cred) + '&chat=' + encodeURIComponent(chat) + '&autoscroll=1');
});

// GET /api/chat_list - 获取聊天列表（AJAX）
router.get('/api/chat_list', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.json({ error: '凭证无效', chats: [] });
    }

    const allUsers = getAllUsers(user.username);
    const userSignatures: Record<string, string> = {};
    for (const u of allUsers) {
        userSignatures[u.username] = u.signature;
    }

    const sessions = getChatSessions(user.username, userSignatures);
    res.json({ chats: sessions });
});

// GET /api/chat_messages - 获取聊天消息（AJAX）
router.get('/api/chat_messages', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.json({ error: '凭证无效', messages: [] });
    }

    const chat = (req.query.chat as string) || '';
    if (!chat) {
        return res.json({ messages: [] });
    }

    const messages = loadChatMessages(user.username, chat);
    res.json({ messages });
});

export const chatRouter = router;
