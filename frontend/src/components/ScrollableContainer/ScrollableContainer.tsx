/**
 * 可滚动容器组件
 * 提供统一的滚动样式和固定高度
 */
import React from 'react';
import './ScrollableContainer.css';

interface ScrollableContainerProps {
  children: React.ReactNode;
  maxHeight?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  autoScroll?: boolean;
}

const ScrollableContainer: React.FC<ScrollableContainerProps> = ({
  children,
  maxHeight = 400,
  height,
  className = '',
  style = {},
  autoScroll = true
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  React.useEffect(() => {
    if (autoScroll && containerRef.current) {
      const container = containerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [children, autoScroll]);

  const containerStyle: React.CSSProperties = {
    maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollBehavior: 'smooth',
    ...style
  };

  return (
    <div
      ref={containerRef}
      className={`scrollable-container ${className}`}
      style={containerStyle}
    >
      {children}
    </div>
  );
};

export default ScrollableContainer;
