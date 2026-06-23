/**
 * jwt.ts - JWT 认证工具（基于 jsonwebtoken）
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'forum-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

/** 生成 JWT token */
export function createToken(username: string): string {
    return jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/** 验证 JWT token */
export function verifyToken(token: string): { username: string } | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { username: string };
        return { username: decoded.username };
    } catch {
        return null;
    }
}

/** 从请求中获取 token */
export function getToken(req: any): string | null {
    // 从 Cookie 获取
    const cookieHeader = req.headers?.get?.('cookie');
    if (cookieHeader && typeof cookieHeader === 'string') {
        const cookies = cookieHeader.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'token') {
                return decodeURIComponent(value);
            }
        }
    }
    if (req.cookies?.token) {
        return req.cookies.token;
    }

    // 从 query 参数获取
    if (req.query?.token) {
        return req.query.token;
    }

    return null;
}