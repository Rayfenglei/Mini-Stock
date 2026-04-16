const format = require('../../utils/format');

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 资产数据
    holdings: {
      type: Array,
      value: [],
      observer: function(newVal) {
        if (newVal && newVal.length > 0) {
          this.processData();
        }
      }
    },
    // 是否显示总资产
    showTotal: {
      type: Boolean,
      value: true
    },
    // 是否显示中心信息
    showCenterInfo: {
      type: Boolean,
      value: true
    },
    // 中心标签文字
    centerLabel: {
      type: String,
      value: '总资产'
    },
    // 底部提示文字
    footerText: {
      type: String,
      value: ''
    },
    // 图表类型：'donut' | 'pie'
    chartType: {
      type: String,
      value: 'donut'
    },
    //  donut 图表内圆半径比例 (0-1)
    innerRadius: {
      type: Number,
      value: 0.55
    },
    // 动画时长 (ms)
    animationDuration: {
      type: Number,
      value: 800
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    distributionData: [],
    totalValue: 0,
    totalValueDisplay: '0.00',
    centerValue: '0.00',
    activeIndex: -1,
    canvasContext: null,
    canvasSize: { width: 0, height: 0 },
    dpr: 1
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    ready() {
      // 延迟一点初始化，确保 DOM 完全准备好
      setTimeout(() => {
        this.initCanvas();
      }, 100);
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 初始化 Canvas
    initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#distributionCanvas').fields({ node: true, size: true }).exec((res) => {
        if (!res[0]) return;

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;

        // 设置 canvas 尺寸
        const width = res[0].width;
        const height = res[0].height;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        this.setData({
          canvasContext: { canvas, ctx, width, height },
          canvasSize: { width, height },
          dpr
        });

        // 如果有数据，立即绘制
        if (this.properties.holdings && this.properties.holdings.length > 0) {
          this.processData();
        }
      });
    },

    // 处理数据
    processData() {
      const { holdings } = this.properties;
      if (!holdings || holdings.length === 0) return;

      // 定义资产类型配置
      const assetConfig = {
        stock: { name: '股票', color: '#3B82F6', icon: '📈' },
        fund: { name: '基金', color: '#10B981', icon: '📊' },
        gold: { name: '黄金', color: '#F59E0B', icon: '🥇' }
      };

      // 按资产类型分组统计
      const typeStats = {};
      let totalValue = 0;

      holdings.forEach(item => {
        const type = item.assetType || 'stock';
        const marketValue = item.marketValue || 0;

        if (!typeStats[type]) {
          typeStats[type] = {
            type,
            name: assetConfig[type]?.name || '其他',
            color: assetConfig[type]?.color || '#6B7280',
            value: 0,
            count: 0
          };
        }

        typeStats[type].value += marketValue;
        typeStats[type].count += 1;
        totalValue += marketValue;
      });

      // 转换为数组并计算百分比
      const distributionData = Object.values(typeStats)
        .map(item => {
          const percent = totalValue > 0 ? (item.value / totalValue * 100) : 0;
          return {
            ...item,
            percent: Math.round(percent * 10) / 10, // 保留一位小数
            valueDisplay: format.toFixed(item.value),
            rawPercent: percent
          };
        })
        .sort((a, b) => b.value - a.value); // 按金额降序

      this.setData({
        distributionData,
        totalValue,
        totalValueDisplay: format.toFixed(totalValue),
        centerValue: this.formatCompactNumber(totalValue)
      });

      // 绘制图表
      this.drawChart(distributionData);
    },

    // 格式化数字为紧凑形式
    formatCompactNumber(num) {
      if (num >= 100000000) {
        return (num / 100000000).toFixed(3) + '亿';
      } else if (num >= 10000) {
        return (num / 10000).toFixed(3) + '万';
      } else {
        return format.toFixed(num);
      }
    },

    // 绘制图表
    drawChart(data) {
      const { canvasContext } = this.data;
      if (!canvasContext) return;

      const { ctx, width, height } = canvasContext;
      const { chartType, innerRadius } = this.properties;

      // 清空画布
      ctx.clearRect(0, 0, width, height);

      if (data.length === 0) return;

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 10;
      const innerR = chartType === 'donut' ? radius * innerRadius : 0;

      // 过滤掉值为0的数据
      const validData = data.filter(item => item.value > 0);
      const totalValue = validData.reduce((sum, item) => sum + item.value, 0);

      if (totalValue === 0) return;

      // 直接绘制（不使用动画，避免渲染问题）
      let currentAngle = -Math.PI / 2; // 从顶部开始

      validData.forEach((item) => {
        const sliceAngle = (item.value / totalValue) * Math.PI * 2;
        const endAngle = currentAngle + sliceAngle;

        // 绘制扇形
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();

        // 绘制边框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        currentAngle = endAngle;
      });

      // 如果是 donut 类型，绘制内圆（在所有扇形绘制完成后）
      if (chartType === 'donut') {
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerR, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    },

    // 图例点击
    onLegendTap(e) {
      const index = e.currentTarget.dataset.index;
      const { distributionData, activeIndex } = this.data;

      // 切换激活状态
      const newIndex = activeIndex === index ? -1 : index;
      this.setData({ activeIndex: newIndex });

      // 高亮对应的扇形
      this.highlightSegment(newIndex);

      // 触发事件
      this.triggerEvent('segmentTap', {
        index: newIndex,
        data: newIndex >= 0 ? distributionData[newIndex] : null
      });
    },

    // 图例悬停（PC端）
    onLegendHover(e) {
      const index = e.currentTarget.dataset.index;
      this.setData({ activeIndex: index });
      this.highlightSegment(index);
    },

    // 图例离开（PC端）
    onLegendLeave() {
      this.setData({ activeIndex: -1 });
      this.highlightSegment(-1);
    },

    // 高亮扇形
    highlightSegment(activeIndex) {
      const { canvasContext, distributionData } = this.data;
      if (!canvasContext) return;

      const { ctx, width, height } = canvasContext;
      const { chartType, innerRadius } = this.properties;

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 10;
      const innerR = chartType === 'donut' ? radius * innerRadius : 0;

      const validData = distributionData.filter(item => item.value > 0);
      const totalValue = validData.reduce((sum, item) => sum + item.value, 0);

      if (totalValue === 0) return;

      let currentAngle = -Math.PI / 2;

      validData.forEach((item, index) => {
        const sliceAngle = (item.value / totalValue) * Math.PI * 2;
        const endAngle = currentAngle + sliceAngle;

        const isActive = activeIndex === index;
        const drawRadius = isActive ? radius + 5 : radius;

        // 绘制扇形
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, drawRadius, currentAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();

        // 绘制边框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        currentAngle = endAngle;
      });

      // 绘制内圆（donut 类型）
      if (chartType === 'donut') {
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerR, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    },

    // 刷新数据（外部调用）
    refreshData() {
      this.processData();
    },

    // 切换图表类型（外部调用）
    setChartType(type) {
      this.setData({ chartType: type });
      this.drawChart(this.data.distributionData);
    }
  }
});
