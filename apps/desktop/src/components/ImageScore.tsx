/**
 * 图片谱渲染器
 *
 * 直接用 img 展示图片谱（截图/照片），宽度随缩放系数变化，
 * 超出部分由外层滚动容器承载。
 */
import { scoreImage, scoreScroll } from "./docviewer.css";

interface ImageScoreProps {
  /** asset 协议图片 URL */
  src: string;
  /** 缩放系数，1 表示适配容器宽度 */
  zoom: number;
}

/**
 * 图片谱组件
 *
 * @param props src 图片地址；zoom 缩放系数
 */
export function ImageScore({ src, zoom }: ImageScoreProps) {
  return (
    <div className={scoreScroll}>
      <img className={scoreImage} src={src} style={{ width: `${zoom * 100}%` }} alt="乐谱" />
    </div>
  );
}
