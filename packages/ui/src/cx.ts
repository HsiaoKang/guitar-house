/**
 * 类名合并工具
 *
 * @param parts 类名片段（假值被过滤）
 * @returns 合并后的 className
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
