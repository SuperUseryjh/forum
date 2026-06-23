/**
 * auth.ts - JWT 认证中间件
 */
import type { RouteHandler, ExtendedRequest, ExtendedResponse } from '../lib/bun-http';
import { findUser } from '../models/user';
import { verifyToken, getToken } from '../utils/jwt';

/** 获取当前登录用户（通过 JWT token） */
export function getCurrentUser(req: ExtendedRequest) {
    const token = getToken(req);
    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload) return null;
    return findUser(payload.username);
}

/** 需要认证的中间件 */
export function requireAuth(): RouteHandler {
    return (req: ExtendedRequest, res: ExtendedResponse, next: () => Promise<void>) => {
        const user = getCurrentUser(req);
        if (!user) {
            res.redirect('/login?err=unauthorized');
            return;
        }
        (req as any).currentUser = user;
        return next();
    };
}

/** 可选认证中间件（不强制登录） */
export function optionalAuth(): RouteHandler {
    return (req: ExtendedRequest, res: ExtendedResponse, next: () => Promise<void>) => {
        (req as any).currentUser = getCurrentUser(req);
        return next();
    };
}