const api = require('../../utils/api');
const format = require('../../utils/format');

Page({
  data: {
    holding: {},
    transactions: [],
    assetInfo: {},
    sharesLabel: '持有份额',
    sharesDisplay: '0',
    costPriceLabel: '成本价',
    costAmountDisplay: '0.00',
    marketValueDisplay: '0.00',
    profitDisplay: '0.00',
    profitPercent: 0
  },

  onLoad(options) {
    if (options.id) {
      this.loadHoldingDetail(options.id);
    }
  },

  async loadHoldingDetail(id) {
    try {
      wx.showLoading({ title: '加载中...' });
      const holding = await api.getHoldingById(id);
      const transactions = await api.getTransactionsByHolding(id);
      
      const assetInfo = format.getAssetTypeInfo(holding.assetType);
      const costAmount = holding.costAmount || 0;
      const profit = holding.profit || 0;
      const maxLoss = costAmount > 0 ? costAmount : 1;
      const percent = Math.abs(profit) / maxLoss * 100;

      const transactionsDisplay = transactions.map(t => ({
        ...t,
        tradeDateDisplay: format.formatDate(t.tradeDate, 'MM月DD日')
      }));

      this.setData({
        holding,
        transactions: transactionsDisplay,
        assetInfo,
        sharesLabel: holding.assetType === 'gold' ? '持有克数' : '持有份额',
        sharesDisplay: holding.assetType === 'gold' ? holding.shares + 'g' : format.toFixed(holding.shares, 1),
        costPriceLabel: holding.assetType === 'fund' ? '单位净值' : '成本价',
        costAmountDisplay: format.toThousands(costAmount),
        marketValueDisplay: format.toThousands(holding.marketValue),
        profitDisplay: format.toFixed(profit),
        profitPercent: Math.min(percent, 100)
      });
    } catch (error) {
      console.error('加载持仓详情失败', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  editHolding() {
    const { holding } = this.data;
    wx.navigateTo({
      url: `/pages/editHolding/editHolding?id=${holding._id}`
    });
  },

  addTransaction() {
    const { holding } = this.data;
    wx.navigateTo({
      url: `/pages/addTransaction/addTransaction?holdingId=${holding._id}&accountId=${holding.accountId}`
    });
  }
});
