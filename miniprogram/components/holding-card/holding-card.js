const format = require('../../utils/format');

Component({
  properties: {
    data: {
      type: Object,
      value: {},
      observer: 'onDataChange'
    }
  },

  data: {
    profitPercent: 0,
    updateTime: '',
    assetInfo: {},
    marketValueDisplay: '0.00',
    todayProfitDisplay: '0.00',
    todayRateDisplay: '0.00',
    costAmountDisplay: '0.00',
    costPriceDisplay: '0.00',
    costPriceLabel: '成本价',
    sharesDisplay: '0',
    sharesLabel: '持有份额',
    profitDisplay: '0.00',
    profitRateDisplay: '0.00',
    fundUpdateTime: '',
    fundEstimateRate: '0.00',
    goldTypeDisplay: ''
  },

  methods: {
    onDataChange(newData) {
      const assetInfo = format.getAssetTypeInfo(newData.assetType);
      
      const costAmount = newData.costAmount || 0;
      const profit = newData.profit || 0;
      const maxLoss = costAmount > 0 ? costAmount : 1;
      const percent = Math.abs(profit) / maxLoss * 100;

      let fundUpdateTime = '';
      if (newData.fundUpdateTime) {
        const d = new Date(newData.fundUpdateTime);
        fundUpdateTime = `${d.getMonth() + 1}月${d.getDate()}日`;
      }

      let goldTypeDisplay = '';
      if (newData.assetType === 'gold') {
        const typeMap = {
          au9999: 'AU99.99',
          au100g: 'AU100g',
          etf518880: '黄金ETF'
        };
        goldTypeDisplay = typeMap[newData.goldType] || newData.goldType || '现货黄金';
      }

      this.setData({
        profitPercent: Math.min(percent, 100),
        updateTime: this.formatDate(newData.updateTime),
        assetInfo,
        marketValueDisplay: format.toThousands(newData.marketValue),
        todayProfitDisplay: format.toFixed(newData.todayProfit),
        todayRateDisplay: format.toFixed(newData.todayRate),
        costAmountDisplay: format.toFixed(costAmount),
        costPriceDisplay: format.toFixed(newData.costPrice, 3),
        costPriceLabel: newData.assetType === 'fund' ? '单位净值' : '成本价',
        sharesDisplay: this.formatShares(newData.shares, newData.assetType),
        sharesLabel: newData.assetType === 'gold' ? '克数' : '份额',
        profitDisplay: format.toFixed(profit),
        profitRateDisplay: format.toFixed(newData.profitRate),
        fundUpdateTime,
        fundEstimateRate: format.toFixed(newData.fundEstimate ? ((newData.fundEstimate - (newData.fundNetValue || newData.costPrice)) / (newData.fundNetValue || newData.costPrice) * 100) : 0),
        goldTypeDisplay
      });
    },

    formatShares(shares, assetType) {
      if (assetType === 'gold') {
        return shares + 'g';
      }
      return format.toFixed(shares, 1);
    },

    formatDate(date) {
      if (!date) return '';
      const d = new Date(date);
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    },

    onCardTap() {
      this.triggerEvent('tap', { id: this.data.data._id });
    }
  }
});
