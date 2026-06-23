/**
 * helpers.ts - 工具函数
 */

/** HTML 转义 */
export function q(s: string): string {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/** 格式化消息时间 */
export function formatMessageTime(ts: number | null): string {
    if (ts == null || ts <= 0) return '未知时间';
    const d = new Date(ts * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 返回 X 分钟前的文字 */
export function minutesAgoText(ts: number | null): string {
    if (ts == null || ts <= 0) return '';
    const mins = Math.max(0, Math.floor((Date.now() / 1000 - ts) / 60));
    if (mins === 0) return '刚刚有对方消息';
    return `${mins}分钟前有对方消息`;
}

/** 格式化短日期时间 */
export function formatDateTime(ts: number | null): string {
    if (ts == null || ts <= 0) return '';
    const d = new Date(ts * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 构建 URL 查询参数 */
export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) {
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        }
    }
    return parts.join('&');
}

/** 生成帖子 ID */
export function generatePostId(): string {
    const time = Date.now();
    const rand = crypto.getRandomValues(new Uint8Array(4));
    const hex = Array.from(rand).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${time}_${hex}`;
}

/** 获取当前时间戳（秒） */
export function now(): number {
    return Math.floor(Date.now() / 1000);
}
