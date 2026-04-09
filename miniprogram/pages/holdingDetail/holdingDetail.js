const api = require('../../utils/api');
const format = require('../../utils/format');

Page({
  data: {
    holding: {},
    transactions: [],
    assetInfo: {}
  },

  onLoad(options) {
    if (options.id) {
      this.loadHoldingDetail(options.id);
    }
  },

  onShow() {
    // 页面显示时刷新数据，确保编辑或添加交易后数据更新
    if (this.data.holding._id) {
      this.loadHoldingDetail(this.data.holding._id);
    }
  },

  async loadHoldingDetail(id) {
    try {
      wx.showLoading({ title: '加载中...' });
      const holdingResult = await api.getHoldingById(id);
      const transactionsResult = await api.getTransactionsByHolding(id);
      
      let holding = holdingResult.data;
      const transactions = transactionsResult.data;
      
      // 获取实时行情数据
      if (holding.assetType === 'stock' && holding.assetCode) {
        try {
          const quoteResult = await api.getStockQuote(holding.assetCode);
          if (quoteResult.code === 0 && quoteResult.data) {
            const quoteData = quoteResult.data;
            holding.currentPrice = quoteData.currentPrice;
            holding.todayProfit = (quoteData.currentPrice - quoteData.preClose) * holding.shares;
            holding.todayRate = quoteData.changePercent;
            holding.preClose = quoteData.preClose;
            holding.open = quoteData.open;
            holding.high = quoteData.high;
            holding.low = quoteData.low;
          }
        } catch (e) {
          console.warn('获取行情失败', e);
        }
      }
      
      const assetInfo = format.getAssetTypeInfo(holding.assetType);

      const transactionsDisplay = transactions.map(t => ({
        ...t,
        tradeDateDisplay: format.formatDate(t.tradeDate, 'MM月DD日')
      }));

      this.setData({
        holding,
        transactions: transactionsDisplay,
        assetInfo
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
    if (!holding || !holding._id) {
      wx.showToast({ title: '数据加载中，请稍后重试', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/editHolding/editHolding?id=${holding._id}`
    });
  },

  addTransaction() {
    const { holding } = this.data;
    if (!holding || !holding._id) {
      wx.showToast({ title: '数据加载中，请稍后重试', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/addTransaction/addTransaction?holdingId=${holding._id}&accountId=${holding.accountId || ''}`
    });
  }
});
