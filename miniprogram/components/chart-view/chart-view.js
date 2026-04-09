Component({
  properties: {
    type: { type: String, value: 'line' },
    data: { type: Array, value: [] },
    height: { type: Number, value: 300 }
  },

  data: {
    canvasContext: null
  },

  observers: {
    'data, type': function() {
      this.drawChart();
    }
  },

  methods: {
    drawChart() {
      const { type, data, height } = this.data;
      if (!data || data.length === 0) return;

      const query = this.createSelectorQuery();
      query.select('.chart-canvas').fields({ node: true, size: true }).exec((res) => {
        if (!res[0]) return;
        
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        
        canvas.width = res[0].width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        const width = res[0].width;
        const padding = { top: 20, right: 20, bottom: 30, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        if (type === 'line') {
          this.drawLineChart(ctx, data, padding, chartWidth, chartHeight);
        } else if (type === 'pie') {
          this.drawPieChart(ctx, data, width / 2, height / 2, Math.min(width, height) / 2 - 40);
        } else if (type === 'bar') {
          this.drawBarChart(ctx, data, padding, chartWidth, chartHeight);
        }
      });
    },

    drawLineChart(ctx, data, padding, chartWidth, chartHeight) {
      const values = data.map(d => d.value);
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values);
      const range = maxVal - minVal || 1;

      ctx.strokeStyle = '#1A73E8';
      ctx.lineWidth = 2;
      ctx.beginPath();

      data.forEach((item, index) => {
        const x = padding.left + (index / (data.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - ((item.value - minVal) / range) * chartHeight;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      ctx.fillStyle = '#999';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      data.forEach((item, index) => {
        if (index % Math.ceil(data.length / 5) === 0 || index === data.length - 1) {
          const x = padding.left + (index / (data.length - 1)) * chartWidth;
          ctx.fillText(item.label, x, padding.top + chartHeight + 20);
        }
      });

      ctx.textAlign = 'right';
      ctx.fillText(maxVal.toFixed(2), padding.left - 5, padding.top + 5);
      ctx.fillText(minVal.toFixed(2), padding.left - 5, padding.top + chartHeight);
    },

    drawPieChart(ctx, data, centerX, centerY, radius) {
      const total = data.reduce((sum, d) => sum + d.value, 0);
      let startAngle = -Math.PI / 2;

      const colors = ['#1A73E8', '#FF9800', '#FFD700', '#E64340', '#00A650', '#81C784'];

      data.forEach((item, index) => {
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        ctx.fillStyle = colors[index % colors.length];
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();
        startAngle += sliceAngle;
      });

      ctx.fillStyle = '#333';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      data.forEach((item, index) => {
        const percent = ((item.value / total) * 100).toFixed(1);
        ctx.fillText(`${item.label} ${percent}%`, centerX, centerY + radius + 20 + index * 18);
      });
    },

    drawBarChart(ctx, data, padding, chartWidth, chartHeight) {
      const values = data.map(d => d.value);
      const maxVal = Math.max(...values);
      const barWidth = chartWidth / data.length * 0.6;
      const gap = chartWidth / data.length * 0.4;

      const colors = ['#1A73E8', '#FF9800', '#FFD700', '#E64340', '#00A650', '#81C784'];

      data.forEach((item, index) => {
        const x = padding.left + index * (barWidth + gap) + gap / 2;
        const barHeight = (item.value / maxVal) * chartHeight;
        const y = padding.top + chartHeight - barHeight;

        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = '#999';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, x + barWidth / 2, padding.top + chartHeight + 20);
      });
    },

    onTouchStart(e) {
      this.triggerEvent('touchstart', e);
    },

    onTouchMove(e) {
      this.triggerEvent('touchmove', e);
    },

    onTouchEnd(e) {
      this.triggerEvent('touchend', e);
    }
  }
});
