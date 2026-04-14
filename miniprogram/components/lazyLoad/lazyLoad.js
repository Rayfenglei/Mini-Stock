/**
 * 懒加载组件
 * 实现内容按需渲染和滚动触发加载
 */

Component({
  options: {
    multipleSlots: true
  },

  properties: {
    // 是否启用懒加载
    enabled: {
      type: Boolean,
      value: true
    },
    // 预加载距离（像素）
    preloadDistance: {
      type: Number,
      value: 200
    },
    // 占位符高度
    placeholderHeight: {
      type: String,
      value: '200rpx'
    },
    // 是否显示骨架屏
    showSkeleton: {
      type: Boolean,
      value: true
    },
    // 唯一标识
    id: {
      type: String,
      value: ''
    }
  },

  data: {
    isLoaded: false,
    isInViewport: false,
    isLoading: false
  },

  lifetimes: {
    attached() {
      if (!this.properties.enabled) {
        this.setData({ isLoaded: true });
        return;
      }
      this.observeIntersection();
    },

    detached() {
      this.disconnectObserver();
    }
  },

  methods: {
    // 创建交叉观察器
    observeIntersection() {
      const systemInfo = wx.getSystemInfoSync();
      const windowHeight = systemInfo.windowHeight;

      this.createIntersectionObserver({
        thresholds: [0],
        initialRatio: 0,
        observeAll: false
      })
      .relativeToViewport({
        top: this.properties.preloadDistance,
        bottom: this.properties.preloadDistance
      })
      .observe('.lazy-load-wrapper', (res) => {
        const isInViewport = res.intersectionRatio > 0;

        if (isInViewport && !this.data.isLoaded) {
          this.loadContent();
        }

        this.setData({ isInViewport });
      });
    },

    // 断开观察器
    disconnectObserver() {
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
      }
    },

    // 加载内容
    loadContent() {
      if (this.data.isLoading || this.data.isLoaded) return;

      this.setData({ isLoading: true });

      // 模拟加载延迟，实际使用时可以移除
      setTimeout(() => {
        this.setData({
          isLoaded: true,
          isLoading: false
        });

        // 触发加载完成事件
        this.triggerEvent('load', {
          id: this.properties.id,
          timestamp: Date.now()
        });
      }, 100);
    },

    // 强制加载（用于手动触发）
    forceLoad() {
      this.loadContent();
    },

    // 重置加载状态
    reset() {
      this.setData({
        isLoaded: false,
        isInViewport: false,
        isLoading: false
      });
    }
  }
});
