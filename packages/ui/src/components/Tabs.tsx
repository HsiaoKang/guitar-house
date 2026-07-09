/**
 * 资源 Tab 切换器
 *
 * 用于课节内同类资源（视频/文档）的横向切换。
 */
import { tabItem, tabList } from "./tabs.css";

export interface TabItem {
  /** 唯一键 */
  key: string;
  /** 展示文案 */
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  /** 切换回调 */
  onChange: (key: string) => void;
}

/**
 * Tab 切换组件
 *
 * @param props items 项列表；activeKey 当前项；onChange 切换回调
 */
export function Tabs({ items, activeKey, onChange }: TabsProps) {
  return (
    <div className={tabList} role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          role="tab"
          aria-selected={item.key === activeKey}
          data-active={item.key === activeKey ? "true" : undefined}
          className={tabItem}
          title={item.label}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
