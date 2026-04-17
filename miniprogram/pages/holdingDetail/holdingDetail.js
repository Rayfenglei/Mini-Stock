const api = require('../../utils/api');
const format = require('../../utils/format');

Page({
  data: {
    holding: {},
    transactions: [],
    assetInfo: {},
    timeRanges: ['1日', '1周', '1月', '3月', '1年'],
    timeIndex: 2, // 默认选中1月
    // 价格数据
    currentPriceDisplay: '0.00',
    todayChangeDisplay: '0.00',
    todayChangeRateDisplay: '0.00',
    todayChange: 0,
    todayChangeRate: 0,
    openPriceDisplay: '0.00',
    highPriceDisplay: '0.00',
    lowPriceDisplay: '0.00',
    prevCloseDisplay: '0.00',
    openPrice: 0,
    highPrice: 0,
    lowPrice: 0,
    // 持仓数据
    marketValueDisplay: '0.00',
    totalProfitDisplay: '0.00',
    totalProfitRateDisplay: '0.00',
    totalProfit: 0,
    totalProfitRate: 0,
    costAmountDisplay: '0.00',
    costPriceDisplay: '0.00',
    sharesDisplay: '0',
    todayProfitDisplay: '0.00',
    todayProfit: 0,
    updateTime: '--',
    // 基金特有数据
    fundTypeDisplay: '',
    purchaseDateDisplay: '',
    expectedReturnDisplay: '',
    isFund: false
  },

  onLoad(options) {
    if (options.id) {
      this.holdingId = options.id;
      this.loadHoldingDetail(options.id);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  onShow() {
    // 页面显示时刷新数据，确保编辑或添加交易后数据更新
    const id = this.holdingId || this.data.holding._id;
    if (id) {
      this.loadHoldingDetail(id);
    }
  },

  async loadHoldingDetail(id) {
    try {
      wx.showLoading({ title: '加载中...' });
      const holdingResult = await api.getHoldingById(id);

      if (holdingResult.code !== 0) {
        wx.showToast({ title: holdingResult.message || '加载失败', icon: 'none' });
        return;
      }

      const transactionsResult = await api.getTransactionsByHolding(id);

      let holding = holdingResult.data;
      const transactions = transactionsResult.data || [];

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
          console.warn('获取股票行情失败', e);
        }
      } else if (holding.assetType === 'fund' && holding.assetCode) {
        try {
          const quoteResult = await api.getFundQuote(holding.assetCode);
          if (quoteResult.code === 0 && quoteResult.data) {
            const quoteData = quoteResult.data;
            const yesterdayNetValue = parseFloat(quoteData.netValue) || holding.costPrice || 0;
            const estimateValue = parseFloat(quoteData.estimateValue) || yesterdayNetValue;
            holding.currentPrice = estimateValue;
            // 今日收益 = (今日估算净值 - 昨日净值) × 份额
            holding.todayProfit = (estimateValue - yesterdayNetValue) * holding.shares;
            holding.todayRate = quoteData.estimateRate || 0;
            holding.netValueDate = quoteData.date;
            holding.estimateTime = quoteData.estimateTime;
          }
        } catch (e) {
          console.warn('获取基金行情失败', e);
        }
      }

      // 计算显示数据
      const currentPrice = holding.currentPrice || holding.costPrice || 0;
      const costPrice = holding.costPrice || 0;
      const shares = holding.shares || 0;
      const marketValue = shares * currentPrice;
      const costAmount = shares * costPrice;
      // 基金使用 purchaseAmount（实际购买金额）计算持有收益，其他使用 costAmount
      const costBasis = (holding.assetType === 'fund' && holding.purchaseAmount) ? holding.purchaseAmount : costAmount;
      const totalProfit = marketValue - costBasis;
      const totalProfitRate = costBasis > 0 ? (totalProfit / costBasis * 100) : 0;
      const todayProfit = holding.todayProfit || 0;
      const todayChange = currentPrice - (holding.preClose || costPrice);
      const todayChangeRate = holding.preClose ? ((currentPrice - holding.preClose) / holding.preClose * 100) : 0;

      const assetInfo = format.getAssetTypeInfo(holding.assetType);

      // 处理交易记录显示
      const transactionsDisplay = transactions.map(t => ({
        ...t,
        date: format.formatDate(t.tradeDate, 'MM-DD'),
        sharesDisplay: format.toThousands(t.shares),
        priceDisplay: Number(t.price).toFixed(3),
        amountDisplay: format.toThousands(t.amount)
      }));

      // 基金特有数据显示
      const isFund = holding.assetType === 'fund';
      const fundTypeDisplay = holding.fundType || '';
      const purchaseDateDisplay = holding.purchaseDate || '';
      const expectedReturnDisplay = holding.expectedReturn ? holding.expectedReturn.toFixed(3) : '';

      this.setData({
        holding,
        transactions: transactionsDisplay,
        assetInfo,
        // 价格数据
        currentPriceDisplay: Number(currentPrice).toFixed(4),
        todayChangeDisplay: Math.abs(todayChange).toFixed(4),
        todayChangeRateDisplay: Math.abs(todayChangeRate).toFixed(3),
        todayChange,
        todayChangeRate,
        openPriceDisplay: Number(holding.open || 0).toFixed(3),
        highPriceDisplay: Number(holding.high || 0).toFixed(3),
        lowPriceDisplay: Number(holding.low || 0).toFixed(3),
        prevCloseDisplay: Number(holding.preClose || costPrice).toFixed(3),
        openPrice: holding.open || 0,
        highPrice: holding.high || 0,
        lowPrice: holding.low || 0,
        // 持仓数据
        marketValueDisplay: format.toThousands(marketValue),
        totalProfitDisplay: format.toThousands(Math.abs(totalProfit)),
        totalProfitRateDisplay: Math.abs(totalProfitRate).toFixed(3),
        totalProfit,
        totalProfitRate,
        costAmountDisplay: format.toThousands(isFund && holding.purchaseAmount ? holding.purchaseAmount : costAmount),
        costPriceDisplay: Number(costPrice).toFixed(4),
        sharesDisplay: format.toThousands(shares),
        todayProfitDisplay: format.toThousands(Math.abs(todayProfit)),
        todayProfit,
        updateTime: format.formatDate(new Date(), 'HH:mm'),
        // 基金特有数据
        isFund,
        fundTypeDisplay,
        purchaseDateDisplay,
        expectedReturnDisplay
      });

      // 初始化图表
      this.initChart();
    } catch (error) {
      console.error('加载持仓详情失败', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 返回上一页
  onBackTap() {
    wx.navigateBack();
  },

  // 更多操作
  onMoreTap() {
    const itemList = ['编辑持仓', '删除持仓'];
    wx.showActionSheet({
      itemList,
      success: (res) => {
        if (res.tapIndex === 0) {
          this.onEditTap();
        } else if (res.tapIndex === 1) {
          this.onDeleteTap();
        }
      }
    });
  },

  // 编辑持仓
  onEditTap() {
    const { holding } = this.data;
    if (!holding || !holding._id) {
      wx.showToast({ title: '数据加载中，请稍后重试', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/editHolding/editHolding?id=${holding._id}`
    });
  },

  // 删除持仓
  onDeleteTap() {
    const { holding } = this.data;
    if (!holding || !holding._id) return;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除 ${holding.assetName} 的持仓记录吗？`,
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          this.deleteHolding(holding._id);
        }
      }
    });
  },

  async deleteHolding(id) {
    try {
      wx.showLoading({ title: '删除中...' });
      const result = await api.deleteHolding(id);
      if (result.code === 0) {
        wx.showToast({ title: '删除成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1500);
      } else {
        wx.showToast({ title: result.message || '删除失败', icon: 'none' });
      }
    } catch (error) {
      console.error('删除持仓失败', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 时间切换
  onTimeChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ timeIndex: index });
    // 这里可以根据时间范围重新加载图表数据
    this.loadChartData(index);
  },

  // 加载图表数据
  async loadChartData(timeIndex) {
    // TODO: 根据时间范围加载历史数据
    console.log('加载时间范围:', this.data.timeRanges[timeIndex]);
  },

  // 初始化图表
  initChart() {
    // TODO: 使用 canvas 绘制价格走势图
    console.log('初始化图表');
  },

  // 查看全部交易
  onViewAllTransactions() {
    const { holding } = this.data;
    if (!holding || !holding._id) return;
    wx.navigateTo({
      url: `/pages/transaction/transaction?holdingId=${holding._id}`
    });
  },

  // 交易按钮点击
  onTradeTap() {
    // 直接跳转到交易页面，默认买入类型
    this.addTransaction('buy');
  },

  // 添加交易
  addTransaction(type = 'buy') {
    const { holding } = this.data;
    if (!holding || !holding._id) {
      wx.showToast({ title: '数据加载中，请稍后重试', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/addTransaction/addTransaction?holdingId=${holding._id}&accountId=${holding.accountId || ''}&type=${type}`
    });
  }
});
