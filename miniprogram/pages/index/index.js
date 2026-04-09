const api = require('../../utils/api');
const format = require('../../utils/format');

Page({
  data: {
    recentHoldings: [],
    totalInvestmentDisplay: '0.00',
    totalProfitDisplay: '0.00',
    totalProfit: 0
  },

  onLoad() {
    this.loadRecentHoldings();
  },

  onPullDownRefresh() {
    this.loadRecentHoldings().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadRecentHoldings() {
    try {
      const result = await api.getHoldings('', false);
      const holdings = result.data || result || [];
      
      let totalInvestment = 0;
      let totalMarketValue = 0;
      
      const recentHoldings = holdings.slice(0, 10).map(item => {
        const costAmount = (item.shares || 0) * (item.costPrice || 0);
        const marketValue = (item.shares || 0) * (item.currentPrice || item.costPrice || 0);
        const assetTypeText = item.assetType === 'stock' ? '股票' : 
                              item.assetType === 'fund' ? '基金' : '黄金';
        
        totalInvestment += costAmount;
        totalMarketValue += marketValue;
        
        return {
          ...item,
          assetTypeText,
          sharesDisplay: item.shares ? format.toThousands(item.shares) : '0',
          costPriceDisplay: item.costPrice ? Number(item.costPrice).toFixed(2) : '0.00',
          costAmountDisplay: format.toThousands(costAmount)
        };
      });
      
      const totalProfit = totalMarketValue - totalInvestment;
      
      this.setData({ 
        recentHoldings,
        totalInvestmentDisplay: format.toThousands(totalInvestment),
        totalProfitDisplay: format.toThousands(Math.abs(totalProfit)),
        totalProfit
      });
    } catch (error) {
      console.error('加载持仓失败', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onAddAssetTap() {
    wx.navigateTo({ url: '/pages/addAsset/addAsset' });
  },

  onHoldingTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/holdingDetail/holdingDetail?id=${id}` });
  }
});
