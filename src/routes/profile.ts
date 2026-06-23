/**
 * profile.ts - 用户中心和用户主页路由
 */
import { Router } from '../lib/bun-http';
import { findUserByCredential, findUser, updateSignature } from '../models/user';
import { getUserFeed, addFeed } from '../models/feed';
import { getCredential } from '../middleware/auth';
import { q, formatMessageTime } from '../utils/helpers';

const router = new Router();

// GET /profile - 用户中心
router.get('/', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.redirect('/login?err=unauthorized');
    }

    await res.render('profile', {
        user,
        credential: cred,
        q,
    });
});

// POST /profile/api/set_signature - 设置签名
router.post('/api/set_signature', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.redirect('/profile');
    }

    const signature: string = (req.body.signature as string) || '';
    updateSignature(user.username, signature);
    addFeed(user.username, 'signature', '修改了个性签名：\n' + signature);

    res.redirect('/profile?credential=' + encodeURIComponent(cred));
});

// POST /profile/api/add_feed - 手动添加动态
router.post('/api/add_feed', async (req, res) => {
    const cred = getCredential(req);
    const user = findUserByCredential(cred);

    if (!user) {
        return res.redirect('/profile');
    }

    const feedText: string = (req.body.feed_text as string) || '';
    if (!feedText.trim()) {
        return res.redirect('/profile?feed_err=empty&credential=' + encodeURIComponent(cred));
    }

    addFeed(user.username, 'manual', feedText);

    const goto = (req.body.goto as string) || 'profile';
    if (goto === 'home') {
        return res.redirect(`/user/${user.username}?credential=${encodeURIComponent(cred)}`);
    }
    res.redirect('/profile?credential=' + encodeURIComponent(cred));
});

// GET /user/:username - 用户主页
router.get('/:username', async (req, res) => {
    const cred = getCredential(req);
    const currentUser = findUserByCredential(cred);

    if (!currentUser) {
        return res.redirect('/login?err=unauthorized');
    }

    const viewUsername = req.params.username;
    const viewUser = findUser(viewUsername);

    if (!viewUser) {
        return res.redirect('/forum');
    }

    const feed = getUserFeed(viewUsername);

    await res.render('user-page', {
        currentUser,
        viewUser,
        credential: cred,
        feed,
        q,
        formatMessageTime,
    });
});

export const profileRouter = router;
