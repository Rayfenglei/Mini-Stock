const api = require('../../utils/api');
const format = require('../../utils/format');

Page({
  data: {
    timeRanges: ['7天', '1月', '3月', '半年', '1年'],
    timeIndex: 1,
    trendData: [],
    distributionData: [],
    totalProfit: 0,
    totalProfitRate: 0,
    todayProfit: 0,
    totalProfitDisplay: '0.00',
    totalProfitRateDisplay: '0.00',
    todayProfitDisplay: '0.00',
    bestHolding: '-',
    worstHolding: '-',
    riskWarning: ''
  },

  onLoad() {
    this.loadAnalysisData();
  },

  onTimeChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ timeIndex: index });
    this.loadAnalysisData();
  },

  async loadAnalysisData() {
    try {
      wx.showLoading({ title: '加载中...' });
      const accounts = await api.getAccounts();
      
      let allHoldings = [];
      for (const account of accounts) {
        const holdings = await api.getHoldings(account._id);
        allHoldings = allHoldings.concat(holdings);
      }

      this.calculateAnalysis(allHoldings);
    } catch (error) {
      console.error('加载分析数据失败', error);
    } finally {
      wx.hideLoading();
    }
  },

  calculateAnalysis(holdings) {
    let totalProfit = 0;
    let totalCost = 0;
    let todayProfit = 0;
    let bestHolding = { name: '-', profitRate: -Infinity };
    let worstHolding = { name: '-', profitRate: Infinity };

    const distributionData = [];

    holdings.forEach(h => {
      totalProfit += h.profit || 0;
      totalCost += h.costAmount || 0;
      todayProfit += h.todayProfit || 0;

      if (h.profitRate > bestHolding.profitRate) {
        bestHolding = { name: h.assetName, profitRate: h.profitRate };
      }
      if (h.profitRate < worstHolding.profitRate) {
        worstHolding = { name: h.assetName, profitRate: h.profitRate };
      }

      distributionData.push({
        label: h.assetName,
        value: h.marketValue || 0
      });
    });

    const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    const trendData = this.generateTrendData();

    let riskWarning = '';
    if (holdings.length > 0) {
      const totalValue = holdings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
      const maxHolding = holdings.reduce((max, h) => 
        (h.marketValue || 0) > (max.marketValue || 0) ? h : max
      , holdings[0]);
      
      if (maxHolding && totalValue > 0 && (maxHolding.marketValue / totalValue) > 0.7) {
        riskWarning = `持仓集中度较高，${maxHolding.assetName}占比超过70%`;
      }
    }

    this.setData({
      trendData,
      distributionData,
      totalProfit,
      totalProfitRate,
      todayProfit,
      totalProfitDisplay: format.toFixed(totalProfit),
      totalProfitRateDisplay: format.toFixed(totalProfitRate),
      todayProfitDisplay: format.toFixed(todayProfit),
      bestHolding: bestHolding.name,
      worstHolding: worstHolding.name,
      riskWarning
    });
  },

  generateTrendData() {
    const data = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      data.push({
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        value: Math.random() * 100000 + 200000
      });
    }
    return data;
  }
});
