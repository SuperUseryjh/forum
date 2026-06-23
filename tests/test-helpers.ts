/**
 * test-helpers.ts - 测试辅助函数
 */
import { hashPassword } from '../src/utils/password';
import { createUser } from '../src/models/user';

/** 快速创建测试用户（使用默认密码） */
export function createTestUser(username: string): void {
    const passwordHash = hashPassword('testpass123');
    createUser(username, passwordHash);
}