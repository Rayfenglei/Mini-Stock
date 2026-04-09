const api = require('../../utils/api');
const format = require('../../utils/format');

Page({
  data: {
    recentHoldings: [],
    totalInvestmentDisplay: '0.00',
    totalProfitDisplay: '0.00',
    totalProfit: 0,
    touchStartX: 0,
    touchStartY: 0,
    currentSwipeIndex: -1,
    deleteBtnWidth: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const rpxRatio = systemInfo.windowWidth / 750;
    this.setData({
      deleteBtnWidth: 160 * rpxRatio
    });
    this.loadRecentHoldings();
  },

  onShow() {
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
      const holdings = (result && result.data) || result || [];
      
      if (!Array.isArray(holdings)) {
        this.setData({ 
          recentHoldings: [],
          totalInvestmentDisplay: '0.00',
          totalProfitDisplay: '0.00',
          totalProfit: 0
        });
        return;
      }
      
      let totalInvestment = 0;
      let totalMarketValue = 0;
      
      const stockCodes = holdings
        .filter(item => item && item.assetType === 'stock' && item.assetCode)
        .map(item => item.assetCode);
      
      let quotesData = {};
      if (stockCodes.length > 0) {
        try {
          const quotesResult = await api.getBatchQuotes(stockCodes);
          quotesData = (quotesResult && quotesResult.data) || {};
        } catch (e) {
          console.warn('获取行情失败', e);
        }
      }
      
      const recentHoldings = holdings.slice(0, 10).map(item => {
        if (!item) return null;
        const costAmount = (item.shares || 0) * (item.costPrice || 0);
        
        let currentPrice = item.currentPrice || item.costPrice || 0;
        if (item.assetType === 'stock' && item.assetCode && quotesData[item.assetCode]) {
          currentPrice = quotesData[item.assetCode].currentPrice || currentPrice;
        }
        
        const marketValue = (item.shares || 0) * currentPrice;
        const profit = marketValue - costAmount;
        const profitRate = costAmount > 0 ? (profit / costAmount * 100) : 0;
        const todayProfit = item.todayProfit || 0;
        const todayProfitRate = marketValue > 0 ? (todayProfit / marketValue * 100) : 0;
        const assetTypeText = item.assetType === 'stock' ? '股票' : 
                              item.assetType === 'fund' ? '基金' : '黄金';
        
        totalInvestment += costAmount;
        totalMarketValue += marketValue;
        
        return {
          ...item,
          assetTypeText,
          sharesDisplay: item.shares ? format.toThousands(item.shares) : '0',
          costPriceDisplay: item.costPrice ? Number(item.costPrice).toFixed(2) : '0.00',
          costAmountDisplay: format.toThousands(costAmount),
          marketValueDisplay: format.toThousands(marketValue),
          currentPriceDisplay: currentPrice ? Number(currentPrice).toFixed(2) : '0.00',
          profitDisplay: format.toThousands(profit),
          profitRateDisplay: profitRate.toFixed(2),
          profit,
          profitRate,
          todayProfitDisplay: format.toThousands(todayProfit),
          todayProfitRateDisplay: todayProfitRate.toFixed(2),
          todayProfit,
          todayProfitRate,
          profitBarWidth: Math.min(Math.abs(profitRate), 100)
        };
      }).filter(item => item !== null);
      
      const totalProfit = totalMarketValue - totalInvestment;
      
      this.setData({ 
        recentHoldings,
        totalInvestmentDisplay: format.toThousands(totalInvestment),
        totalProfitDisplay: format.toThousands(totalProfit),
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
  },

  onTouchStart(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY,
      currentSwipeIndex: index,
      isSwiping: false
    });
  },

  onTouchMove(e) {
    const { index } = e.currentTarget.dataset;
    const moveX = e.touches[0].clientX - this.data.touchStartX;
    const moveY = e.touches[0].clientY - this.data.touchStartY;
    
    if (Math.abs(moveX) > Math.abs(moveY) && Math.abs(moveX) > 10) {
      this.setData({ isSwiping: true });
      const maxSwipe = -this.data.deleteBtnWidth;
      const translateX = Math.max(maxSwipe, Math.min(0, moveX));
      
      const holdings = this.data.recentHoldings.map((item, i) => {
        if (i === index) {
          return { ...item, translateX, animating: false };
        }
        return { ...item, translateX: 0, animating: false };
      });
      
      this.setData({ recentHoldings: holdings });
    }
  },

  onTouchEnd(e) {
    const { index } = e.currentTarget.dataset;
    const holdings = this.data.recentHoldings.map((item, i) => {
      if (i === index) {
        const shouldOpen = (item.translateX || 0) < -(this.data.deleteBtnWidth / 2);
        return { 
          ...item, 
          translateX: shouldOpen ? -this.data.deleteBtnWidth : 0,
          animating: true
        };
      }
      return { ...item, translateX: 0, animating: true };
    });
    
    this.setData({ 
      recentHoldings: holdings,
      isSwiping: false
    });
  },

  onCardTap(e) {
    const { id } = e.currentTarget.dataset;
    if (!this.data.isSwiping) {
      wx.navigateTo({ url: `/pages/holdingDetail/holdingDetail?id=${id}` });
    }
  },

  onWrapperTap(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.recentHoldings[index];
    if (item && (item.translateX || 0) < 0) {
      this.closeSwipe(index);
    }
  },

  onDeleteTap(e) {
    const { id, index } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此项目吗？',
      confirmText: '确认',
      cancelText: '取消',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.confirmDelete(id, index);
        } else {
          this.closeSwipe(index);
        }
      }
    });
  },

  async confirmDelete(id, index) {
    try {
      wx.showLoading({ title: '删除中...' });
      
      await api.deleteHolding(id);
      
      wx.hideLoading();
      wx.showToast({ title: '删除成功', icon: 'success' });
      
      const holdings = this.data.recentHoldings.filter((_, i) => i !== index);
      this.setData({ recentHoldings: holdings });
      
      this.loadRecentHoldings();
    } catch (error) {
      wx.hideLoading();
      console.error('删除持仓失败', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
      this.closeSwipe(index);
    }
  },

  closeSwipe(index) {
    const holdings = this.data.recentHoldings.map((item, i) => {
      if (i === index) {
        return { ...item, translateX: 0, animating: true };
      }
      return item;
    });
    this.setData({ recentHoldings: holdings });
  }
});
