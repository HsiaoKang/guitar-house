/**
 * 品牌 Logo（自绘 SVG）
 *
 * 房子轮廓 + 内嵌翻开的书页，呼应 "Learning House"。
 * 描边继承 currentColor，随主题自动适配。
 */

interface BrandLogoProps {
  /** 尺寸（像素），默认 22 */
  size?: number;
}

/**
 * 品牌 Logo 组件
 *
 * @param props size 渲染尺寸
 */
export function BrandLogo({ size = 22 }: BrandLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* 房子轮廓 */}
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      {/* 翻开的书 */}
      <path d="M12 12.5c-1.2-.9-2.6-1-4-1v6c1.4 0 2.8.1 4 1 1.2-.9 2.6-1 4-1v-6c-1.4 0-2.8.1-4 1Z" />
      <path d="M12 12.5v6" />
    </svg>
  );
}
