const api = require('../../utils/api');
const format = require('../../utils/format');
const cache = require('../../utils/cache');
const marketTime = require('../../utils/marketTime');

// 刷新防抖动配置
const REFRESH_DEBOUNCE = 30 * 1000; // 30秒最短刷新间隔
let lastRefreshTime = 0;

// 全局状态管理 - 总资产数据只加载一次
const globalState = {
  totalAssetsData: null,
  isTotalAssetsLoaded: false,
  allHoldings: []
};

Page({
  data: {
    holdings: [],
    recentHoldings: [],
    totalAssetsDisplay: '0.00',
    totalInvestmentDisplay: '0.00',
    totalProfitDisplay: '0.00',
    totalProfitRateDisplay: '0.00',
    totalProfit: 0,
    // 各类资产统计数据
    stockTotalDisplay: '0.00',
    stockProfitRate: 0,
    stockProfitRateDisplay: '0.00',
    fundTotalDisplay: '0.00',
    fundProfitRate: 0,
    fundProfitRateDisplay: '0.00',
    goldTotalDisplay: '0.00',
    goldProfitRate: 0,
    goldProfitRateDisplay: '0.00',
    timeRange: '本周',
    userName: '',
    userInfo: {},
    hasNotification: false,
    touchStartX: 0,
    touchStartY: 0,
    currentSwipeIndex: -1,
    deleteBtnWidth: 0,
    sortType: 'value',
    sortAsc: false,
    activeTab: 'stock',
    // 刷新状态
    isRefreshing: false,
    lastRefreshTime: 0,
    // 缓存统计
    cacheStats: { hitRate: 0, hits: 0, misses: 0 },
    // 总资产数据是否已加载
    isTotalAssetsLoaded: false,
    // 市场状态
    marketStatus: {
      isTrading: false,
      isTradingDay: false,
      statusText: '未开盘'
    }
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const rpxRatio = systemInfo.windowWidth / 750;
    this.setData({
      deleteBtnWidth: 160 * rpxRatio
    });
    // 更新市场状态
    this.updateMarketStatus();
    // 首次进入页面，加载所有数据
    this.loadAllData();
  },

  onShow() {
    // 更新市场状态
    const marketStatus = this.updateMarketStatus();
    const now = Date.now();

    // 检查是否需要刷新（交易完成后返回）
    const app = getApp();
    if (app && app.globalData.needRefreshHoldings) {
      console.log('检测到交易完成标记，执行数据刷新');
      // 清除标记
      app.globalData.needRefreshHoldings = false;
      // 强制刷新所有数据
      this.forceRefreshAfterTransaction();
      return;
    }

    // 如果当前是交易时段，且距离上次刷新已经超过30秒，则刷新数据
    if (marketStatus.isTrading) {
      const lastRefresh = this.data.lastRefreshTime || 0;
      const timeSinceLastRefresh = now - lastRefresh;

      if (timeSinceLastRefresh > cache.TRADING_CACHE_EXPIRY) {
        console.log('交易时段：数据已过期，执行刷新');
        this.loadListDataOnly();
        return;
      }
    }

    // 只加载当前类型的列表数据，不重新加载总资产
    this.loadListDataOnly();
  },

  // 交易完成后快速刷新数据（无提示）
  async forceRefreshAfterTransaction() {
    if (this.data.isRefreshing) return;

    // 使用静默刷新，不显示加载状态
    try {
      // 清除缓存
      const cacheKey = cache.generateCacheKey('holdings', { type: this.data.activeTab });
      const allTypesCacheKey = cache.generateCacheKey('holdings', { type: 'all' });
      cache.removeCache(cacheKey);
      cache.removeCache(allTypesCacheKey);

      // 获取当前类型的数据（用于列表显示）
      const result = await api.getHoldings('', this.data.activeTab, false);
      let holdings = [];
      if (result && result.code === 0 && Array.isArray(result.data)) {
        holdings = result.data;
      } else if (Array.isArray(result)) {
        holdings = result;
      } else if (result && result.data) {
        holdings = result.data;
      }

      // 获取所有类型的数据（用于计算总资产）
      const allResult = await api.getHoldings('', '', false);
      let allHoldings = [];
      if (allResult && allResult.code === 0 && Array.isArray(allResult.data)) {
        allHoldings = allResult.data;
      } else if (Array.isArray(allResult)) {
        allHoldings = allResult;
      } else if (allResult && allResult.data) {
        allHoldings = allResult.data;
      }

      // 获取股票实时行情
      const stockCodes = allHoldings
        .filter(item => item && item.assetType === 'stock' && item.assetCode)
        .map(item => item.assetCode);

      let stockQuotesData = {};
      if (stockCodes.length > 0) {
        try {
          const quotesResult = await api.getBatchQuotes(stockCodes);
          if (quotesResult && quotesResult.code === 0 && quotesResult.data) {
            stockQuotesData = quotesResult.data;
          }
        } catch (e) {
          console.warn('获取股票行情失败', e);
        }
      }

      // 更新全局状态
      globalState.allHoldings = allHoldings;
      globalState.stockQuotesData = stockQuotesData;

      // 使用行情数据快速处理列表
      const fundQuotesData = globalState.fundQuotesData || null;
      const goldQuotesData = globalState.goldQuotesData || null;
      const processedHoldings = this.processHoldingsDataSync(holdings, stockQuotesData, fundQuotesData, goldQuotesData);
      const sortedHoldings = this.processHoldingsWithSort(processedHoldings);

      // 快速计算总资产（使用行情数据）
      const totalAssetsData = this.calculateTotalAssetsSync(allHoldings, stockQuotesData, fundQuotesData, goldQuotesData);

      // 更新全局状态
      globalState.totalAssetsData = totalAssetsData;

      // 更新页面数据（列表 + 总资产）
      this.setData({
        holdings: sortedHoldings,
        recentHoldings: sortedHoldings.slice(0, 10),
        ...totalAssetsData,
        lastRefreshTime: Date.now()
      });

      console.log('交易后刷新完成，总资产:', totalAssetsData.totalAssetsDisplay);
    } catch (error) {
      console.error('交易后刷新失败:', error);
      // 静默失败，不显示错误提示
    }
  },

  // 同步计算总资产（使用传入的行情数据）
  calculateTotalAssetsSync(allHoldings, stockQuotesData, fundQuotesData, goldQuotesData) {
    let totalInvestment = 0;
    let totalMarketValue = 0;

    // 各类资产统计
    let stockTotal = 0;
    let stockCost = 0;
    let fundTotal = 0;
    let fundCost = 0;
    let goldTotal = 0;
    let goldCost = 0;

    allHoldings.forEach(item => {
      if (!item) return;
      const costAmount = (item.shares || 0) * (item.costPrice || 0);

      // 获取实时价格（使用传入的行情数据）
      let currentPrice = item.currentPrice || item.costPrice || 0;
      if (item.assetType === 'stock' && item.assetCode && stockQuotesData && stockQuotesData[item.assetCode]) {
        currentPrice = stockQuotesData[item.assetCode].currentPrice || currentPrice;
      } else if (item.assetType === 'fund' && item.assetCode && fundQuotesData && fundQuotesData[item.assetCode]) {
        const fundData = fundQuotesData[item.assetCode];
        currentPrice = parseFloat(fundData.estimateValue) || parseFloat(fundData.netValue) || currentPrice;
      } else if (item.assetType === 'gold' && item.assetCode && goldQuotesData && goldQuotesData[item.assetCode]) {
        currentPrice = goldQuotesData[item.assetCode].currentPrice || currentPrice;
      }

      const marketValue = (item.shares || 0) * currentPrice;

      totalInvestment += costAmount;
      totalMarketValue += marketValue;

      // 按资产类型统计
      if (item.assetType === 'stock') {
        stockTotal += marketValue;
        stockCost += costAmount;
      } else if (item.assetType === 'fund') {
        fundTotal += marketValue;
        fundCost += costAmount;
      } else if (item.assetType === 'gold') {
        goldTotal += marketValue;
        goldCost += costAmount;
      }
    });

    const totalProfit = totalMarketValue - totalInvestment;
    const totalProfitRate = totalInvestment > 0 ? (totalProfit / totalInvestment * 100) : 0;

    // 计算各类资产收益率
    const stockProfitRate = stockCost > 0 ? ((stockTotal - stockCost) / stockCost * 100) : 0;
    const fundProfitRate = fundCost > 0 ? ((fundTotal - fundCost) / fundCost * 100) : 0;
    const goldProfitRate = goldCost > 0 ? ((goldTotal - goldCost) / goldCost * 100) : 0;

    return {
      totalAssetsDisplay: format.toThousands(totalMarketValue),
      totalInvestmentDisplay: format.toThousands(totalInvestment),
      totalProfitDisplay: format.toThousands(totalProfit),
      totalProfitRateDisplay: totalProfitRate.toFixed(3),
      totalProfit,
      // 各类资产数据
      stockTotalDisplay: format.toThousands(stockTotal),
      stockProfitRate,
      stockProfitRateDisplay: stockProfitRate.toFixed(3),
      fundTotalDisplay: format.toThousands(fundTotal),
      fundProfitRate,
      fundProfitRateDisplay: fundProfitRate.toFixed(3),
      goldTotalDisplay: format.toThousands(goldTotal),
      goldProfitRate,
      goldProfitRateDisplay: goldProfitRate.toFixed(3)
    };
  },

  onPullDownRefresh() {
    this.forceRefresh().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 检查是否可以刷新（防抖动）
  canRefresh() {
    const now = Date.now();
    return now - lastRefreshTime >= REFRESH_DEBOUNCE;
  },

  // 获取剩余冷却时间
  getRefreshCooldown() {
    const now = Date.now();
    const elapsed = now - lastRefreshTime;
    return Math.max(0, Math.ceil((REFRESH_DEBOUNCE - elapsed) / 1000));
  },

  // 手动刷新按钮点击
  onRefreshTap() {
    if (!this.canRefresh()) {
      const cooldown = this.getRefreshCooldown();
      wx.showToast({
        title: `请${cooldown}秒后再刷新`,
        icon: 'none'
      });
      return;
    }

    this.forceRefresh();
  },

  // 强制刷新（绕过缓存）
  async forceRefresh() {
    if (this.data.isRefreshing) return;

    this.setData({ isRefreshing: true });
    lastRefreshTime = Date.now();

    try {
      // 清除所有相关缓存
      const cacheKey = cache.generateCacheKey('holdings', { type: this.data.activeTab });
      const allTypesCacheKey = cache.generateCacheKey('holdings', { type: 'all' });
      cache.removeCache(cacheKey);
      cache.removeCache(allTypesCacheKey);

      // 重置全局状态
      globalState.totalAssetsData = null;
      globalState.isTotalAssetsLoaded = false;
      globalState.allHoldings = [];

      // 重新加载所有数据
      await this.loadAllData(true);

      this.setData({ lastRefreshTime: Date.now() });

      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1500
      });
    } catch (error) {
      console.error('刷新失败:', error);
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isRefreshing: false });
    }
  },

  // 更新缓存统计
  updateCacheStats() {
    const stats = cache.getCacheStats();
    this.setData({ cacheStats: stats });
  },

  // 更新市场状态显示
  updateMarketStatus() {
    const status = marketTime.getMarketStatus();
    let statusText = '未开盘';

    if (status.isTrading) {
      statusText = '交易中';
    } else if (status.isTradingDay) {
      statusText = '休市中';
    } else {
      statusText = '非交易日';
    }

    this.setData({
      marketStatus: {
        isTrading: status.isTrading,
        isTradingDay: status.isTradingDay,
        statusText
      }
    });

    return status;
  },

  // 首次进入页面时加载所有数据（包括总资产）
  async loadAllData(forceRefresh = false) {
    try {
      const app = getApp();
      const userInfo = app.globalData.userInfo || {};
      const { activeTab } = this.data;

      // 获取当前类型的数据（用于列表显示）
      const cacheKey = cache.generateCacheKey('holdings', { type: activeTab });
      const fetchData = async () => {
        // 传入 refresh: true 获取实时行情价格
        const result = await api.getHoldings('', activeTab, true);
        return result;
      };

      const result = await cache.fetchWithCache(
        cacheKey,
        fetchData,
        { forceRefresh }
      );

      // 获取所有类型的数据（用于计算总资产）- 只加载一次
      let allHoldings = [];
      let totalAssetsData = null;

      if (!globalState.isTotalAssetsLoaded || forceRefresh) {
        // 首次加载或强制刷新时，获取所有类型数据
        const allTypesCacheKey = cache.generateCacheKey('holdings', { type: 'all' });
        const fetchAllData = async () => {
          // 传入 refresh: true 获取实时行情价格
          const result = await api.getHoldings('', '', true);
          return result;
        };

        const allResult = await cache.fetchWithCache(
          allTypesCacheKey,
          fetchAllData,
          { forceRefresh }
        );

        if (allResult && allResult.code === 0 && Array.isArray(allResult.data)) {
          allHoldings = allResult.data;
        } else if (Array.isArray(allResult)) {
          allHoldings = allResult;
        } else if (allResult && allResult.data) {
          allHoldings = allResult.data;
        }

        // 获取实时行情数据并计算总资产
        totalAssetsData = await this.calculateTotalAssetsWithQuotes(allHoldings);

        // 保存到全局状态
        globalState.totalAssetsData = totalAssetsData;
        globalState.allHoldings = allHoldings;
        globalState.fundQuotesData = totalAssetsData.fundQuotesData;
        globalState.goldQuotesData = totalAssetsData.goldQuotesData;
        globalState.isTotalAssetsLoaded = true;
      } else {
        // 使用已加载的总资产数据
        totalAssetsData = globalState.totalAssetsData;
        allHoldings = globalState.allHoldings;
        console.log('使用已缓存的总资产数据');
      }

      // 处理当前类型的数据（用于列表显示）
      let holdings = [];
      if (result && result.code === 0 && Array.isArray(result.data)) {
        holdings = result.data;
      } else if (Array.isArray(result)) {
        holdings = result;
      } else if (result && result.data) {
        holdings = result.data;
      }

      // 处理列表数据（传入基金和黄金行情数据）
      const fundQuotesData = globalState.fundQuotesData || null;
      const goldQuotesData = globalState.goldQuotesData || null;
      const processedHoldings = await this.processHoldingsData(holdings, allHoldings, fundQuotesData, goldQuotesData);

      // 应用排序
      const sortedHoldings = this.processHoldingsWithSort(processedHoldings);

      // 更新页面数据
      this.setData({
        holdings: sortedHoldings,
        recentHoldings: sortedHoldings.slice(0, 10),
        ...totalAssetsData,
        isTotalAssetsLoaded: true,
        userName: userInfo.nickName || ''
      });

      console.log('数据加载完成:', sortedHoldings.length, '条, 总资产:', totalAssetsData.totalAssetsDisplay);
    } catch (error) {
      console.error('加载数据失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 仅加载列表数据（切换标签或交易后使用，不重新计算总资产）
  async loadListDataOnly(forceRefresh = false) {
    try {
      const { activeTab, isTotalAssetsLoaded } = this.data;

      // 如果总资产数据还未加载，则加载全部数据
      if (!isTotalAssetsLoaded || !globalState.isTotalAssetsLoaded) {
        console.log('总资产数据未加载，执行完整加载');
        await this.loadAllData();
        return;
      }

      // 获取当前类型的数据（仅用于列表显示）
      const cacheKey = cache.generateCacheKey('holdings', { type: activeTab });

      // 如果是强制刷新，直接获取数据不走缓存
      let holdings = [];
      if (forceRefresh) {
        const result = await api.getHoldings('', activeTab, false);
        if (result && result.code === 0 && Array.isArray(result.data)) {
          holdings = result.data;
        } else if (Array.isArray(result)) {
          holdings = result;
        } else if (result && result.data) {
          holdings = result.data;
        }
        // 更新缓存
        cache.setCache(cacheKey, holdings);
      } else {
        const fetchData = async () => {
          const result = await api.getHoldings('', activeTab, false);
          return result;
        };

        const result = await cache.fetchWithCache(
          cacheKey,
          fetchData,
          { forceRefresh: false }
        );

        // 处理当前类型的数据
        if (result && result.code === 0 && Array.isArray(result.data)) {
          holdings = result.data;
        } else if (Array.isArray(result)) {
          holdings = result;
        } else if (result && result.data) {
          holdings = result.data;
        }
      }

      // 使用已缓存的行情数据快速处理列表
      const stockQuotesData = globalState.stockQuotesData || null;
      const fundQuotesData = globalState.fundQuotesData || null;
      const goldQuotesData = globalState.goldQuotesData || null;
      const processedHoldings = this.processHoldingsDataSync(holdings, stockQuotesData, fundQuotesData, goldQuotesData);

      // 应用排序
      const sortedHoldings = this.processHoldingsWithSort(processedHoldings);

      // 只更新列表数据，保持总资产数据不变
      this.setData({
        holdings: sortedHoldings,
        recentHoldings: sortedHoldings.slice(0, 10)
      });

      console.log('列表数据更新完成:', sortedHoldings.length, '条, 类型:', activeTab);
    } catch (error) {
      console.error('加载列表数据失败:', error);
    }
  },

  // 同步处理持仓数据（用于快速刷新，使用传入的行情数据）
  processHoldingsDataSync(holdings, stockQuotesData, fundQuotesData, goldQuotesData) {
    return holdings.map(item => {
      if (!item) return null;
      const costAmount = (item.shares || 0) * (item.costPrice || 0);

      let currentPrice = item.currentPrice || item.costPrice || 0;
      let todayProfit = item.todayProfit || 0;

      // 使用传入的行情数据
      if (item.assetType === 'stock' && item.assetCode && stockQuotesData && stockQuotesData[item.assetCode]) {
        const quoteData = stockQuotesData[item.assetCode];
        currentPrice = quoteData.currentPrice || currentPrice;
        todayProfit = quoteData.todayProfit || todayProfit;
      } else if (item.assetType === 'fund' && item.assetCode && fundQuotesData && fundQuotesData[item.assetCode]) {
        const fundData = fundQuotesData[item.assetCode];
        const yesterdayNetValue = parseFloat(fundData.netValue) || currentPrice;
        currentPrice = parseFloat(fundData.estimateValue) || yesterdayNetValue || currentPrice;
        todayProfit = (currentPrice - yesterdayNetValue) * (item.shares || 0);
      } else if (item.assetType === 'gold' && item.assetCode && goldQuotesData && goldQuotesData[item.assetCode]) {
        currentPrice = goldQuotesData[item.assetCode].currentPrice || currentPrice;
      }

      const marketValue = (item.shares || 0) * currentPrice;
      // 基金使用 purchaseAmount（实际购买金额）计算持有收益，其他使用 costAmount
      const costBasis = (item.assetType === 'fund' && item.purchaseAmount) ? item.purchaseAmount : costAmount;
      const profit = marketValue - costBasis;
      const profitRate = costBasis > 0 ? (profit / costBasis * 100) : 0;
      const todayProfitRate = marketValue > 0 ? (todayProfit / marketValue * 100) : 0;
      const assetTypeText = item.assetType === 'stock' ? '股票' :
                            item.assetType === 'fund' ? '基金' :
                            item.assetType === 'gold' ? '黄金' : '债券';

      return {
        ...item,
        assetTypeText,
        sharesDisplay: item.shares ? format.toThousands(item.shares) : '0',
        costPriceDisplay: item.costPrice ? Number(item.costPrice).toFixed(3) : '0.000',
        costAmountDisplay: format.toThousands(costAmount),
        marketValueDisplay: format.toThousands(marketValue),
        currentPriceDisplay: currentPrice ? Number(currentPrice).toFixed(3) : '0.000',
        profitDisplay: format.toThousands(profit),
        profitRateDisplay: profitRate.toFixed(3),
        profit,
        profitRate,
        todayProfitDisplay: format.toThousands(todayProfit),
        todayProfitRateDisplay: todayProfitRate.toFixed(3),
        todayProfit,
        todayProfitRate,
        todayChange: item.todayChange || 0,
        profitBarWidth: Math.min(Math.abs(profitRate), 100),
        isTodayUpdated: item.isTodayUpdated || false
      };
    }).filter(item => item !== null);
  },

  // 计算总资产数据（带实时行情）
  async calculateTotalAssetsWithQuotes(allHoldings) {
    let totalInvestment = 0;
    let totalMarketValue = 0;

    // 各类资产统计
    let stockTotal = 0;
    let stockCost = 0;
    let fundTotal = 0;
    let fundCost = 0;
    let goldTotal = 0;
    let goldCost = 0;

    // 获取股票代码列表
    const stockCodes = allHoldings
      .filter(item => item && item.assetType === 'stock' && item.assetCode)
      .map(item => item.assetCode);

    // 获取基金代码列表
    const fundCodes = allHoldings
      .filter(item => item && item.assetType === 'fund' && item.assetCode)
      .map(item => item.assetCode);

    // 获取黄金代码列表
    const goldCodes = allHoldings
      .filter(item => item && item.assetType === 'gold' && item.assetCode)
      .map(item => item.assetCode);

    // 获取实时行情数据
    let quotesData = {};
    let fundQuotesData = {};
    let goldQuotesData = {};

    // 检查当前是否处于交易时段
    const isTrading = marketTime.isTradingTime();
    const marketStatus = marketTime.getMarketStatus();
    console.log('当前市场状态:', marketStatus);

    if (stockCodes.length > 0) {
      try {
        // 使用行情专用缓存策略
        const quotesCacheKey = cache.generateCacheKey('quotes', { codes: stockCodes.sort().join(',') });
        const fetchQuotes = async () => {
          const result = await api.getBatchQuotes(stockCodes);
          return (result && result.data) || {};
        };

        quotesData = await cache.fetchQuoteWithCache(quotesCacheKey, fetchQuotes);
        console.log(isTrading ? '交易时段：获取股票行情' : '非交易时段：使用缓存股票行情', Object.keys(quotesData).length, '条');
      } catch (e) {
        console.warn('获取股票行情失败', e);
      }
    }

    // 获取基金行情
    if (fundCodes.length > 0) {
      for (const fundCode of fundCodes) {
        try {
          // 使用行情专用缓存策略
          const fundCacheKey = cache.generateCacheKey('fundQuote', { code: fundCode });
          const fetchFundQuote = async () => {
            const result = await api.getFundQuote(fundCode);
            return (result && result.code === 0) ? result.data : null;
          };

          const fundData = await cache.fetchQuoteWithCache(fundCacheKey, fetchFundQuote);
          console.log('基金行情数据:', fundCode, fundData);
          if (fundData) {
            fundQuotesData[fundCode] = fundData;
          }
        } catch (e) {
          console.warn(`获取基金 ${fundCode} 行情失败`, e);
        }
      }
      console.log(isTrading ? '交易时段：获取基金行情' : '非交易时段：使用缓存基金行情', Object.keys(fundQuotesData).length, '条');
    }

    // 获取黄金行情
    if (goldCodes.length > 0) {
      for (const goldCode of goldCodes) {
        try {
          // 使用行情专用缓存策略
          const goldCacheKey = cache.generateCacheKey('goldQuote', { code: goldCode });
          const fetchGoldQuote = async () => {
            const result = await api.getGoldQuote(goldCode);
            return (result && result.code === 0) ? result.data : null;
          };

          const goldData = await cache.fetchQuoteWithCache(goldCacheKey, fetchGoldQuote);
          console.log('calculateTotalAssetsWithQuotes 黄金行情:', goldCode, goldData);
          if (goldData) {
            goldQuotesData[goldCode] = goldData;
          }
        } catch (e) {
          console.warn(`获取黄金 ${goldCode} 行情失败`, e);
        }
      }
      console.log(isTrading ? '交易时段：获取黄金行情' : '非交易时段：使用缓存黄金行情', Object.keys(goldQuotesData).length, '条');
    }

    // 计算总资产（使用实时价格）
    allHoldings.forEach(item => {
      if (!item) return;
      const costAmount = (item.shares || 0) * (item.costPrice || 0);

      // 获取实时价格
      let currentPrice = item.currentPrice || item.costPrice || 0;
      if (item.assetType === 'stock' && item.assetCode && quotesData[item.assetCode]) {
        currentPrice = quotesData[item.assetCode].currentPrice || currentPrice;
      } else if (item.assetType === 'fund' && item.assetCode && fundQuotesData[item.assetCode]) {
        // 基金接口字段：netValue=昨日净值, estimateValue=今日估算净值
        const fundData = fundQuotesData[item.assetCode];
        currentPrice = parseFloat(fundData.estimateValue) || parseFloat(fundData.netValue) || currentPrice;
      } else if (item.assetType === 'gold' && item.assetCode && goldQuotesData[item.assetCode]) {
        const goldData = goldQuotesData[item.assetCode];
        console.log('黄金计算:', item.assetCode, 'goldData:', goldData);
        currentPrice = goldData.currentPrice || currentPrice;
        console.log('黄金当前价格:', currentPrice);
      }

      const marketValue = (item.shares || 0) * currentPrice;

      totalInvestment += costAmount;
      totalMarketValue += marketValue;

      // 按资产类型统计
      if (item.assetType === 'stock') {
        stockTotal += marketValue;
        stockCost += costAmount;
      } else if (item.assetType === 'fund') {
        fundTotal += marketValue;
        fundCost += costAmount;
      } else if (item.assetType === 'gold') {
        goldTotal += marketValue;
        goldCost += costAmount;
      }
    });

    const totalProfit = totalMarketValue - totalInvestment;
    const totalProfitRate = totalInvestment > 0 ? (totalProfit / totalInvestment * 100) : 0;

    // 计算各类资产收益率
    const stockProfitRate = stockCost > 0 ? ((stockTotal - stockCost) / stockCost * 100) : 0;
    const fundProfitRate = fundCost > 0 ? ((fundTotal - fundCost) / fundCost * 100) : 0;
    const goldProfitRate = goldCost > 0 ? ((goldTotal - goldCost) / goldCost * 100) : 0;

    console.log('总资产计算:', {
      totalMarketValue,
      totalInvestment,
      totalProfit,
      stockCodes: stockCodes.length,
      fundCodes: fundCodes.length,
      stockTotal,
      fundTotal,
      goldTotal
    });

    return {
      totalAssetsDisplay: format.toThousands(totalMarketValue),
      totalInvestmentDisplay: format.toThousands(totalInvestment),
      totalProfitDisplay: format.toThousands(totalProfit),
      totalProfitRateDisplay: totalProfitRate.toFixed(3),
      totalProfit,
      // 各类资产数据
      stockTotalDisplay: format.toThousands(stockTotal),
      stockProfitRate,
      stockProfitRateDisplay: stockProfitRate.toFixed(3),
      fundTotalDisplay: format.toThousands(fundTotal),
      fundProfitRate,
      fundProfitRateDisplay: fundProfitRate.toFixed(3),
      goldTotalDisplay: format.toThousands(goldTotal),
      goldProfitRate,
      goldProfitRateDisplay: goldProfitRate.toFixed(3),
      fundQuotesData,
      goldQuotesData
    };
  },

  // 处理持仓数据
  async processHoldingsData(holdings, allHoldings, externalFundQuotesData = null, externalGoldQuotesData = null) {
    // 获取基金代码列表
    const fundCodes = holdings
      .filter(item => item && item.assetType === 'fund' && item.assetCode)
      .map(item => item.assetCode);

    // 获取黄金代码列表
    const goldCodes = holdings
      .filter(item => item && item.assetType === 'gold' && item.assetCode)
      .map(item => item.assetCode);

    // 获取基金行情数据（如果外部没有传入）
    let fundQuotesData = externalFundQuotesData || {};
    if (!externalFundQuotesData && fundCodes.length > 0) {
      for (const fundCode of fundCodes) {
        try {
          const fundCacheKey = cache.generateCacheKey('fundQuote', { code: fundCode });
          const fetchFundQuote = async () => {
            const result = await api.getFundQuote(fundCode);
            return (result && result.code === 0) ? result.data : null;
          };
          const fundData = await cache.fetchQuoteWithCache(fundCacheKey, fetchFundQuote);
          console.log('processHoldingsData 基金行情:', fundCode, fundData);
          if (fundData) {
            fundQuotesData[fundCode] = fundData;
          }
        } catch (e) {
          console.warn(`获取基金 ${fundCode} 行情失败`, e);
        }
      }
    }

    // 获取黄金行情数据（如果外部没有传入）
    let goldQuotesData = externalGoldQuotesData || {};
    if (!externalGoldQuotesData && goldCodes.length > 0) {
      for (const goldCode of goldCodes) {
        try {
          const goldCacheKey = cache.generateCacheKey('goldQuote', { code: goldCode });
          const fetchGoldQuote = async () => {
            const result = await api.getGoldQuote(goldCode);
            return (result && result.code === 0) ? result.data : null;
          };
          const goldData = await cache.fetchQuoteWithCache(goldCacheKey, fetchGoldQuote);
          console.log('processHoldingsData 黄金行情:', goldCode, goldData);
          if (goldData) {
            goldQuotesData[goldCode] = goldData;
          }
        } catch (e) {
          console.warn(`获取黄金 ${goldCode} 行情失败`, e);
        }
      }
    }

    // 构建行情数据映射
    const quotesData = {};

    allHoldings.forEach(item => {
      if (!item || !item.assetCode) return;
      if (item.assetType === 'stock') {
        quotesData[item.assetCode] = { currentPrice: item.currentPrice };
      }
    });

    return holdings.map(item => {
      if (!item) return null;
      const costAmount = (item.shares || 0) * (item.costPrice || 0);

      let currentPrice = item.currentPrice || item.costPrice || 0;
      let todayProfit = item.todayProfit || 0;

      if (item.assetType === 'stock' && item.assetCode && quotesData[item.assetCode]) {
        currentPrice = quotesData[item.assetCode].currentPrice || currentPrice;
        todayProfit = quotesData[item.assetCode].todayProfit || todayProfit;
      } else if (item.assetType === 'fund' && item.assetCode && fundQuotesData[item.assetCode]) {
        const fundData = fundQuotesData[item.assetCode];
        console.log('基金计算:', item.assetCode, 'fundData:', fundData, 'shares:', item.shares);
        // 基金接口字段：netValue=昨日净值, estimateValue=今日估算净值, estimateRate=估算涨跌幅
        const yesterdayNetValue = parseFloat(fundData.netValue) || currentPrice;
        currentPrice = parseFloat(fundData.estimateValue) || yesterdayNetValue || currentPrice;
        // 基金计算昨日收益：(今日估算净值 - 昨日净值) * 份额
        todayProfit = (currentPrice - yesterdayNetValue) * (item.shares || 0);
        console.log('基金昨日收益计算:', '昨日净值:', yesterdayNetValue, '今日净值:', currentPrice, '份额:', item.shares, '收益:', todayProfit);
      } else if (item.assetType === 'gold' && item.assetCode && goldQuotesData[item.assetCode]) {
        currentPrice = goldQuotesData[item.assetCode].currentPrice || currentPrice;
      }

      const marketValue = (item.shares || 0) * currentPrice;
      // 基金使用 purchaseAmount（实际购买金额）计算持有收益，其他使用 costAmount
      const costBasis = (item.assetType === 'fund' && item.purchaseAmount) ? item.purchaseAmount : costAmount;
      const profit = marketValue - costBasis;
      const profitRate = costBasis > 0 ? (profit / costBasis * 100) : 0;
      const todayProfitRate = marketValue > 0 ? (todayProfit / marketValue * 100) : 0;
      const todayChange = item.todayChange || 0;
      const assetTypeText = item.assetType === 'stock' ? '股票' :
                            item.assetType === 'fund' ? '基金' :
                            item.assetType === 'gold' ? '黄金' : '债券';

      return {
        ...item,
        assetTypeText,
        sharesDisplay: item.shares ? format.toThousands(item.shares) : '0',
        costPriceDisplay: item.costPrice ? Number(item.costPrice).toFixed(3) : '0.000',
        costAmountDisplay: format.toThousands(costAmount),
        marketValueDisplay: format.toThousands(marketValue),
        currentPriceDisplay: currentPrice ? Number(currentPrice).toFixed(3) : '0.000',
        profitDisplay: format.toThousands(profit),
        profitRateDisplay: profitRate.toFixed(3),
        profit,
        profitRate,
        todayProfitDisplay: format.toThousands(todayProfit),
        todayProfitRateDisplay: todayProfitRate.toFixed(3),
        todayProfit,
        todayProfitRate,
        todayChange,
        profitBarWidth: Math.min(Math.abs(profitRate), 100),
        isTodayUpdated: item.isTodayUpdated || false
      };
    }).filter(item => item !== null);
  },

  async loadRecentHoldings(forceRefresh = false) {
    try {
      // 获取用户登录信息
      const app = getApp();
      const userInfo = app.globalData.userInfo || {};

      // 根据当前选中的标签类型
      const { activeTab } = this.data;

      // 获取当前类型的数据（用于列表显示）
      const cacheKey = cache.generateCacheKey('holdings', { type: activeTab });
      const fetchData = async () => {
        const result = await api.getHoldings('', activeTab, false);
        console.log('getHoldings result:', result, 'activeTab:', activeTab);
        return result;
      };

      const result = await cache.fetchWithCache(
        cacheKey,
        fetchData,
        {
          forceRefresh,
          onCacheHit: () => {
            console.log('使用缓存数据:', activeTab);
            this.updateCacheStats();
          },
          onCacheMiss: () => {
            console.log('从服务器获取数据:', activeTab);
            this.updateCacheStats();
          }
        }
      );

      // 获取所有类型的数据（用于计算总资产）
      const allTypesCacheKey = cache.generateCacheKey('holdings', { type: 'all' });
      const fetchAllData = async () => {
        const result = await api.getHoldings('', '', false);
        console.log('getAllHoldings result:', result);
        return result;
      };

      const allResult = await cache.fetchWithCache(
        allTypesCacheKey,
        fetchAllData,
        {
          forceRefresh,
          onCacheHit: () => console.log('使用缓存数据: all'),
          onCacheMiss: () => console.log('从服务器获取数据: all')
        }
      );

      // 处理当前类型的数据（用于列表显示）
      let holdings = [];
      if (result && result.code === 0 && Array.isArray(result.data)) {
        holdings = result.data;
      } else if (Array.isArray(result)) {
        holdings = result;
      } else if (result && result.data) {
        holdings = result.data;
      }

      // 处理所有类型的数据（用于计算总资产）
      let allHoldings = [];
      if (allResult && allResult.code === 0 && Array.isArray(allResult.data)) {
        allHoldings = allResult.data;
      } else if (Array.isArray(allResult)) {
        allHoldings = allResult;
      } else if (allResult && allResult.data) {
        allHoldings = allResult.data;
      }

      if (!Array.isArray(holdings) || holdings.length === 0) {
        console.log('暂无持仓数据');
        this.setData({
          holdings: [],
          recentHoldings: [],
          totalAssetsDisplay: '0.00',
          totalInvestmentDisplay: '0.00',
          totalProfitDisplay: '0.00',
          totalProfitRateDisplay: '0.00',
          totalProfit: 0,
          userName: userInfo.nickName || ''
        });
        return;
      }

      // 使用所有类型的数据计算总资产
      let totalInvestment = 0;
      let totalMarketValue = 0;

      const stockCodes = allHoldings
        .filter(item => item && item.assetType === 'stock' && item.assetCode)
        .map(item => item.assetCode);

      const fundCodes = allHoldings
        .filter(item => item && item.assetType === 'fund' && item.assetCode)
        .map(item => item.assetCode);

      const goldCodes = allHoldings
        .filter(item => item && item.assetType === 'gold' && item.assetCode)
        .map(item => item.assetCode);

      let quotesData = {};
      let fundQuotesData = {};
      let goldQuotesData = {};

      // 检查当前是否处于交易时段
      const isTrading = marketTime.isTradingTime();

      if (stockCodes.length > 0) {
        try {
          // 使用行情专用缓存策略
          const quotesCacheKey = cache.generateCacheKey('quotes', { codes: stockCodes.sort().join(',') });
          const fetchQuotes = async () => {
            const result = await api.getBatchQuotes(stockCodes);
            return (result && result.data) || {};
          };

          quotesData = await cache.fetchQuoteWithCache(quotesCacheKey, fetchQuotes);
        } catch (e) {
          console.warn('获取股票行情失败', e);
        }
      }

      // 获取基金行情
      if (fundCodes.length > 0) {
        for (const fundCode of fundCodes) {
          try {
            // 使用行情专用缓存策略
            const fundCacheKey = cache.generateCacheKey('fundQuote', { code: fundCode });
            const fetchFundQuote = async () => {
              const result = await api.getFundQuote(fundCode);
              return (result && result.code === 0) ? result.data : null;
            };

            const fundData = await cache.fetchQuoteWithCache(fundCacheKey, fetchFundQuote);
            console.log('loadRecentHoldings 基金行情:', fundCode, fundData);
            if (fundData) {
              fundQuotesData[fundCode] = fundData;
            }
          } catch (e) {
            console.warn(`获取基金 ${fundCode} 行情失败`, e);
          }
        }
      }

      // 获取黄金行情
      if (goldCodes.length > 0) {
        for (const goldCode of goldCodes) {
          try {
            // 使用行情专用缓存策略
            const goldCacheKey = cache.generateCacheKey('goldQuote', { code: goldCode });
            const fetchGoldQuote = async () => {
              const result = await api.getGoldQuote(goldCode);
              return (result && result.code === 0) ? result.data : null;
            };

            const goldData = await cache.fetchQuoteWithCache(goldCacheKey, fetchGoldQuote);
            console.log('loadRecentHoldings 黄金行情:', goldCode, goldData);
            if (goldData) {
              goldQuotesData[goldCode] = goldData;
            }
          } catch (e) {
            console.warn(`获取黄金 ${goldCode} 行情失败`, e);
          }
        }
      }

      // 处理所有类型的数据，计算总资产
      allHoldings.forEach(item => {
        if (!item) return;
        const costAmount = (item.shares || 0) * (item.costPrice || 0);

        let currentPrice = item.currentPrice || item.costPrice || 0;
        if (item.assetType === 'stock' && item.assetCode && quotesData[item.assetCode]) {
          currentPrice = quotesData[item.assetCode].currentPrice || currentPrice;
        } else if (item.assetType === 'fund' && item.assetCode && fundQuotesData[item.assetCode]) {
          // 基金接口字段：netValue=昨日净值, estimateValue=今日估算净值
          const fundData = fundQuotesData[item.assetCode];
          currentPrice = parseFloat(fundData.estimateValue) || parseFloat(fundData.netValue) || currentPrice;
        } else if (item.assetType === 'gold' && item.assetCode && goldQuotesData[item.assetCode]) {
          const goldData = goldQuotesData[item.assetCode];
          console.log('loadRecentHoldings 黄金计算:', item.assetCode, 'goldData:', goldData);
          currentPrice = goldData.currentPrice || currentPrice;
          console.log('loadRecentHoldings 黄金价格:', currentPrice);
        }

        const marketValue = (item.shares || 0) * currentPrice;

        totalInvestment += costAmount;
        totalMarketValue += marketValue;
      });

      // 处理当前类型的数据（用于列表显示）
      const processedHoldings = holdings.map(item => {
        if (!item) return null;
        const costAmount = (item.shares || 0) * (item.costPrice || 0);

        let currentPrice = item.currentPrice || item.costPrice || 0;
        let todayProfit = item.todayProfit || 0;

        if (item.assetType === 'stock' && item.assetCode && quotesData[item.assetCode]) {
          currentPrice = quotesData[item.assetCode].currentPrice || currentPrice;
          // 股票使用接口返回的今日盈亏
          todayProfit = quotesData[item.assetCode].todayProfit || todayProfit;
        } else if (item.assetType === 'fund' && item.assetCode && fundQuotesData[item.assetCode]) {
          const fundData = fundQuotesData[item.assetCode];
          console.log('loadRecentHoldings 基金计算:', item.assetCode, 'fundData:', fundData, 'shares:', item.shares);
          // 基金接口字段：netValue=昨日净值, estimateValue=今日估算净值, estimateRate=估算涨跌幅
          const yesterdayNetValue = parseFloat(fundData.netValue) || currentPrice;
          currentPrice = parseFloat(fundData.estimateValue) || yesterdayNetValue || currentPrice;
          // 基金计算昨日收益：(今日估算净值 - 昨日净值) * 份额
          todayProfit = (currentPrice - yesterdayNetValue) * (item.shares || 0);
          console.log('loadRecentHoldings 基金昨日收益:', '昨日净值:', yesterdayNetValue, '今日净值:', currentPrice, '份额:', item.shares, '收益:', todayProfit);
        } else if (item.assetType === 'gold' && item.assetCode && goldQuotesData[item.assetCode]) {
          currentPrice = goldQuotesData[item.assetCode].currentPrice || currentPrice;
        }

        const marketValue = (item.shares || 0) * currentPrice;
        // 基金使用 purchaseAmount（实际购买金额）计算持有收益，其他使用 costAmount
        const costBasis = (item.assetType === 'fund' && item.purchaseAmount) ? item.purchaseAmount : costAmount;
        const profit = marketValue - costBasis;
        const profitRate = costBasis > 0 ? (profit / costBasis * 100) : 0;
        const todayProfitRate = marketValue > 0 ? (todayProfit / marketValue * 100) : 0;
        const todayChange = item.todayChange || 0;
        const assetTypeText = item.assetType === 'stock' ? '股票' :
                              item.assetType === 'fund' ? '基金' :
                              item.assetType === 'gold' ? '黄金' : '债券';

        return {
          ...item,
          assetTypeText,
          sharesDisplay: item.shares ? format.toThousands(item.shares) : '0',
          costPriceDisplay: item.costPrice ? Number(item.costPrice).toFixed(3) : '0.000',
          costAmountDisplay: format.toThousands(costAmount),
          marketValueDisplay: format.toThousands(marketValue),
          currentPriceDisplay: currentPrice ? Number(currentPrice).toFixed(3) : '0.000',
          profitDisplay: format.toThousands(profit),
          profitRateDisplay: profitRate.toFixed(3),
          profit,
          profitRate,
          todayProfitDisplay: format.toThousands(todayProfit),
          todayProfitRateDisplay: todayProfitRate.toFixed(3),
          todayProfit,
          todayProfitRate,
          todayChange,
          profitBarWidth: Math.min(Math.abs(profitRate), 100),
          isTodayUpdated: item.isTodayUpdated || false
        };
      }).filter(item => item !== null);

      const totalProfit = totalMarketValue - totalInvestment;
      const totalProfitRate = totalInvestment > 0 ? (totalProfit / totalInvestment * 100) : 0;

      // 应用当前排序设置
      const sortedHoldings = this.processHoldingsWithSort(processedHoldings);

      // 保存基金和黄金行情数据到全局状态
      globalState.fundQuotesData = fundQuotesData;
      globalState.goldQuotesData = goldQuotesData;

      this.setData({
        holdings: sortedHoldings,
        recentHoldings: sortedHoldings.slice(0, 10),
        totalAssetsDisplay: format.toThousands(totalMarketValue),
        totalInvestmentDisplay: format.toThousands(totalInvestment),
        totalProfitDisplay: format.toThousands(totalProfit),
        totalProfitRateDisplay: totalProfitRate.toFixed(3),
        totalProfit,
        userName: userInfo.nickName || ''
      });

      console.log('持仓数据加载成功:', sortedHoldings.length, '条, 类型:', activeTab, '总资产:', totalMarketValue);
    } catch (error) {
      console.error('加载持仓失败', error);
      wx.showToast({ title: '加载失败: ' + (error.message || '未知错误'), icon: 'none' });
    }
  },

  onAddAssetTap() {
    wx.navigateTo({ url: '/pages/addAsset/addAsset' });
  },

  onAnalysisTap() {
    wx.switchTab({ url: '/pages/analysis/analysis' });
  },

  onTransactionTap() {
    wx.navigateTo({ url: '/pages/transaction/transaction' });
  },

  onSettingsTap() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  onNotificationTap() {
    wx.showToast({ title: '暂无通知', icon: 'none' });
  },

  onTimeSelectorTap() {
    const timeRanges = ['本周', '本月', '本年', '全部'];
    wx.showActionSheet({
      itemList: timeRanges,
      success: (res) => {
        this.setData({ timeRange: timeRanges[res.tapIndex] });
        this.loadAllData();
      }
    });
  },

  onSortTap() {
    const sortTypes = [
      { type: 'value', name: '按市值' },
      { type: 'profit', name: '按盈亏' },
      { type: 'name', name: '按名称' }
    ];
    wx.showActionSheet({
      itemList: sortTypes.map(s => s.name),
      success: (res) => {
        const newSortType = sortTypes[res.tapIndex].type;
        this.setData({ 
          sortType: newSortType,
          sortAsc: !this.data.sortAsc
        });
        this.sortHoldings(newSortType, this.data.sortAsc);
      }
    });
  },

  sortHoldings(sortType, sortAsc) {
    const { holdings } = this.data;

    // 对当前数据进行排序
    const sorted = [...holdings];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch(sortType) {
        case 'value':
          comparison = (b.marketValue || 0) - (a.marketValue || 0);
          break;
        case 'profit':
          comparison = (b.profit || 0) - (a.profit || 0);
          break;
        case 'name':
          comparison = (a.assetName || '').localeCompare(b.assetName || '');
          break;
      }
      return sortAsc ? -comparison : comparison;
    });

    this.setData({
      holdings: sorted,
      filteredHoldings: sorted,
      recentHoldings: sorted.slice(0, 10)
    });
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

      this.loadAllData();
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
  },

  onTabChange(e) {
    const { type } = e.currentTarget.dataset;
    if (type === this.data.activeTab) return;

    this.setData({ activeTab: type });
    // 切换标签时只加载列表数据，不重新加载总资产
    this.loadListDataOnly();
  },

  // 处理数据并应用排序
  processHoldingsWithSort(holdings) {
    const { sortType, sortAsc } = this.data;

    // 应用排序
    holdings.sort((a, b) => {
      let comparison = 0;
      switch(sortType) {
        case 'value':
          comparison = (b.marketValue || 0) - (a.marketValue || 0);
          break;
        case 'profit':
          comparison = (b.profit || 0) - (a.profit || 0);
          break;
        case 'name':
          comparison = (a.assetName || '').localeCompare(b.assetName || '');
          break;
      }
      return sortAsc ? -comparison : comparison;
    });

    return holdings;
  },

  // 懒加载完成回调
  onLazyLoad(e) {
    const { id, timestamp } = e.detail;
    console.log('懒加载完成:', id, timestamp);
  }
});
