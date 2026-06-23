/**
 * password.ts - 密码哈希工具（基于 Bun 原生 crypto API）
 */
import crypto from 'crypto';

const SALT_ROUNDS = 10;

/** 对密码进行哈希 */
export function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 2 ** SALT_ROUNDS, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

/** 验证密码 */
export function verifyPassword(password: string, hashStr: string): boolean {
    const [salt, hash] = hashStr.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 2 ** SALT_ROUNDS, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}