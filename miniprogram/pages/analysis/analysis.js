const api = require('../../utils/api');
const format = require('../../utils/format');

Page({
  data: {
    timeRanges: ['7天', '1月', '3月', '半年', '1年'],
    timeIndex: 1,
    trendType: 'value', // 'value' | 'profit'
    rankType: 'value',  // 'value' | 'profit'
    trendData: [],
    distributionData: [],
    rankingList: [],
    processedHoldings: [],
    dateRange: '',
    totalProfit: 0,
    totalProfitRate: 0,
    todayProfit: 0,
    todayProfitRate: 0,
    totalProfitDisplay: '0.00',
    totalProfitRateDisplay: '0.00',
    todayProfitDisplay: '0.00',
    todayProfitRateDisplay: '0.00',
    bestHolding: { name: '--', rate: 0 },
    worstHolding: { name: '--', rate: 0 },
    holdingCount: 0,
    profitableCount: 0,
    riskWarning: ''
  },

  onLoad() {
    this.updateDateRange();
    this.loadAnalysisData();
  },

  onTimeChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ timeIndex: index });
    this.updateDateRange();
    this.loadAnalysisData();
  },

  // 趋势类型切换
  onTrendTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ trendType: type });
    // 重新生成趋势数据
    this.generateTrendData();
  },

  // 排行类型切换
  onRankTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ rankType: type });
    // 重新排序
    this.sortRankingList();
  },

  // 更新日期范围显示
  updateDateRange() {
    const { timeIndex, timeRanges } = this.data;
    const endDate = new Date();
    const startDate = new Date();
    const range = timeRanges[timeIndex];

    switch (range) {
      case '7天':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '1月':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3月':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '半年':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1年':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const dateRange = `${format.formatDate(startDate, 'MM-DD')} 至 ${format.formatDate(endDate, 'MM-DD')}`;
    this.setData({ dateRange });
  },

  async loadAnalysisData() {
    try {
      wx.showLoading({ title: '加载中...' });

      // 直接获取所有持仓数据（不通过账户）
      const holdingsResult = await api.getHoldings();

      // 兼容两种返回格式
      let holdings = [];
      if (Array.isArray(holdingsResult)) {
        holdings = holdingsResult;
      } else if (holdingsResult && holdingsResult.code === 0) {
        holdings = Array.isArray(holdingsResult.data) ? holdingsResult.data : [];
      } else {
        const errorMsg = holdingsResult && holdingsResult.message ? holdingsResult.message : '获取持仓数据失败';
        wx.showToast({ title: errorMsg, icon: 'none' });
        return;
      }

      // 获取股票实时行情
      const stockCodes = holdings
        .filter(h => h.assetType === 'stock' && h.assetCode)
        .map(h => h.assetCode);

      let quotesData = {};
      if (stockCodes.length > 0) {
        try {
          const quotesResult = await api.getBatchQuotes(stockCodes);
          if (quotesResult.code === 0 && quotesResult.data) {
            quotesData = quotesResult.data;
          }
        } catch (e) {
          console.warn('获取行情失败', e);
        }
      }

      // 处理持仓数据，计算 profit、marketValue 等字段
      const processedHoldings = this.processHoldings(holdings, quotesData);

      this.calculateAnalysis(processedHoldings);
    } catch (error) {
      console.error('加载分析数据失败', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 处理持仓数据，计算相关字段
  processHoldings(holdings, quotesData = {}) {
    return holdings.map(item => {
      if (!item) return null;

      const shares = item.shares || 0;
      const costPrice = item.costPrice || 0;

      // 获取实时价格（股票类型且有行情数据）
      let currentPrice = item.currentPrice || costPrice;
      let preClose = costPrice; // 默认使用成本价作为昨收
      let todayProfit = 0;

      if (item.assetType === 'stock' && item.assetCode && quotesData[item.assetCode]) {
        const quote = quotesData[item.assetCode];
        currentPrice = quote.currentPrice || currentPrice;
        preClose = quote.preClose || preClose;
        // 计算今日收益 = (现价 - 昨收) * 股数
        todayProfit = (currentPrice - preClose) * shares;
      } else {
        // 非股票类型或没有行情数据，使用数据库中的 todayProfit
        todayProfit = item.todayProfit || 0;
      }

      const costAmount = shares * costPrice;
      const marketValue = shares * currentPrice;
      const profit = marketValue - costAmount;
      const profitRate = costAmount > 0 ? (profit / costAmount * 100) : 0;

      return {
        ...item,
        shares,
        costPrice,
        currentPrice,
        costAmount,
        marketValue,
        profit,
        profitRate,
        todayProfit
      };
    }).filter(item => item !== null);
  },

  calculateAnalysis(holdings) {
    let totalProfit = 0;
    let totalCost = 0;
    let todayProfit = 0;
    let totalMarketValue = 0;
    let bestHolding = { name: '--', rate: 0 };
    let worstHolding = { name: '--', rate: 0 };
    let profitableCount = 0;

    const distributionData = [];
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

    holdings.forEach((h, index) => {
      const profit = h.profit || 0;
      const costAmount = h.costAmount || 0;
      const marketValue = h.marketValue || 0;
      const profitRate = h.profitRate || 0;

      totalProfit += profit;
      totalCost += costAmount;
      todayProfit += (h.todayProfit || 0);
      totalMarketValue += marketValue;

      if (profit > 0) {
        profitableCount++;
      }

      // 最佳持仓
      if (profitRate > bestHolding.rate) {
        bestHolding = { name: h.assetName, rate: profitRate };
      }
      // 最差持仓
      if (profitRate < worstHolding.rate) {
        worstHolding = { name: h.assetName, rate: profitRate };
      }

      // 资产分布数据
      distributionData.push({
        name: h.assetName,
        label: h.assetName,
        value: marketValue,
        color: colors[index % colors.length]
      });
    });

    const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    const todayProfitRate = totalMarketValue > 0 ? (todayProfit / totalMarketValue) * 100 : 0;
    const holdingCount = holdings.length;

    // 生成排行列表数据
    let rankingList = holdings.map(h => ({
      ...h,
      marketValueDisplay: format.toThousands(h.marketValue || 0),
      profitDisplay: format.toThousands(Math.abs(h.profit || 0)),
      profitRateDisplay: (h.profitRate || 0).toFixed(2)
    }));

    // 默认按市值排序
    rankingList.sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));

    this.setData({
      rankingList,
      distributionData,
      processedHoldings: holdings,
      totalProfit,
      totalProfitRate,
      todayProfit,
      todayProfitRate,
      totalProfitDisplay: format.toFixed(totalProfit),
      totalProfitRateDisplay: format.toFixed(totalProfitRate),
      todayProfitDisplay: format.toFixed(todayProfit),
      todayProfitRateDisplay: format.toFixed(todayProfitRate),
      bestHolding: {
        name: bestHolding.name,
        rate: bestHolding.rate.toFixed(2)
      },
      worstHolding: {
        name: worstHolding.name,
        rate: worstHolding.rate.toFixed(2)
      },
      holdingCount,
      profitableCount
    });

    // 生成趋势数据
    this.generateTrendData();

    // 计算风险提示
    this.calculateRiskWarning(holdings, totalMarketValue);
  },

  // 排序排行列表
  sortRankingList() {
    const { rankingList, rankType } = this.data;
    const sorted = [...rankingList].sort((a, b) => {
      if (rankType === 'value') {
        return (b.marketValue || 0) - (a.marketValue || 0);
      } else {
        return (b.profit || 0) - (a.profit || 0);
      }
    });
    this.setData({ rankingList: sorted });
  },

  // 生成趋势数据
  generateTrendData() {
    const { trendType } = this.data;
    const data = [];
    const now = new Date();
    const days = 30;

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // 模拟数据，实际应该从历史记录计算
      const baseValue = trendType === 'value' ? 200000 : 0;
      const randomChange = (Math.random() - 0.5) * 10000;
      const value = baseValue + randomChange + (days - i) * 500;

      data.push({
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        value: Math.max(0, value)
      });
    }

    this.setData({ trendData: data });
  },

  // 计算风险提示
  calculateRiskWarning(holdings, totalValue) {
    let riskWarning = '';

    if (holdings.length > 0 && totalValue > 0) {
      // 检查持仓集中度
      const maxHolding = holdings.reduce((max, h) =>
        (h.marketValue || 0) > (max.marketValue || 0) ? h : max
      , holdings[0]);

      if (maxHolding && (maxHolding.marketValue / totalValue) > 0.7) {
        riskWarning = `持仓集中度较高，${maxHolding.assetName}占比超过70%`;
      }

      // 检查亏损持仓比例
      const lossHoldings = holdings.filter(h => (h.profit || 0) < 0);
      if (lossHoldings.length / holdings.length > 0.5) {
        riskWarning = riskWarning
          ? `${riskWarning}；超过50%持仓处于亏损状态`
          : '超过50%持仓处于亏损状态';
      }
    }

    this.setData({ riskWarning });
  },

  // 资产分布图表点击事件
  onDistributionSegmentTap(e) {
    const { index, data } = e.detail;
  }
});
