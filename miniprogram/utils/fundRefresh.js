/**
 * 基金数据刷新管理模块
 * 实现定时刷新（08:00 和 16:00）和手动刷新功能
 * 支持缓存管理和刷新状态追踪
 */

const cache = require('./cache');

// 定时刷新配置
const REFRESH_SCHEDULE = [
  { hour: 8, minute: 0 },   // 08:00
  { hour: 16, minute: 0 }   // 16:00
];

// 缓存键
const FUND_REFRESH_KEY = 'fund_last_refresh_time';
const FUND_REFRESH_STATUS_KEY = 'fund_refresh_status';
const FUND_DATA_CACHE_PREFIX = 'fund_data_';

// 刷新状态
const REFRESH_STATUS = {
  IDLE: 'idle',
  REFRESHING: 'refreshing',
  SUCCESS: 'success',
  FAILED: 'failed',
  CACHED: 'cached'
};

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 2000, // 2秒
  backoffMultiplier: 2
};

/**
 * 检查是否到达定时刷新时间
 * @returns {boolean}
 */
const isScheduledRefreshTime = () => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  return REFRESH_SCHEDULE.some(schedule =>
    schedule.hour === hour && schedule.minute === minute
  );
};

/**
 * 获取下一次定时刷新时间
 * @returns {Date}
 */
const getNextScheduledRefresh = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  // 将今天的刷新时间转换为分钟
  const todaySchedules = REFRESH_SCHEDULE.map(s => ({
    ...s,
    minutes: s.hour * 60 + s.minute
  }));

  // 找到下一个刷新时间
  const nextSchedule = todaySchedules.find(s => s.minutes > currentTime);

  if (nextSchedule) {
    // 今天还有刷新时间
    const nextDate = new Date(now);
    nextDate.setHours(nextSchedule.hour, nextSchedule.minute, 0, 0);
    return nextDate;
  } else {
    // 今天的刷新时间已过，返回明天的第一个刷新时间
    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(REFRESH_SCHEDULE[0].hour, REFRESH_SCHEDULE[0].minute, 0, 0);
    return nextDate;
  }
};

/**
 * 检查是否在允许手动刷新的时间窗口内
 * 允许在定时刷新时间前后30分钟内手动刷新
 * @returns {boolean}
 */
const isInRefreshWindow = () => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentTime = hour * 60 + minute;

  // 检查是否在任一刷新时间的前后30分钟内
  return REFRESH_SCHEDULE.some(schedule => {
    const scheduleTime = schedule.hour * 60 + schedule.minute;
    const timeDiff = Math.abs(currentTime - scheduleTime);
    return timeDiff <= 30; // 30分钟窗口
  });
};

/**
 * 获取上次刷新时间
 * @returns {number|null} 时间戳
 */
const getLastRefreshTime = () => {
  try {
    const data = wx.getStorageSync(FUND_REFRESH_KEY);
    return data ? data.timestamp : null;
  } catch (e) {
    console.error('获取上次刷新时间失败:', e);
    return null;
  }
};

/**
 * 设置刷新时间
 * @param {number} timestamp
 */
const setLastRefreshTime = (timestamp) => {
  try {
    wx.setStorageSync(FUND_REFRESH_KEY, { timestamp });
  } catch (e) {
    console.error('设置刷新时间失败:', e);
  }
};

/**
 * 获取刷新状态
 * @returns {Object}
 */
const getRefreshStatus = () => {
  try {
    const status = wx.getStorageSync(FUND_REFRESH_STATUS_KEY);
    return status || {
      status: REFRESH_STATUS.IDLE,
      lastUpdate: null,
      nextScheduledRefresh: getNextScheduledRefresh().getTime(),
      isFromCache: false,
      errorMessage: null
    };
  } catch (e) {
    console.error('获取刷新状态失败:', e);
    return {
      status: REFRESH_STATUS.IDLE,
      lastUpdate: null,
      nextScheduledRefresh: getNextScheduledRefresh().getTime(),
      isFromCache: false,
      errorMessage: null
    };
  }
};

/**
 * 设置刷新状态
 * @param {Object} status
 */
const setRefreshStatus = (status) => {
  try {
    const currentStatus = getRefreshStatus();
    wx.setStorageSync(FUND_REFRESH_STATUS_KEY, {
      ...currentStatus,
      ...status,
      lastUpdate: Date.now()
    });
  } catch (e) {
    console.error('设置刷新状态失败:', e);
  }
};

/**
 * 带重试机制的数据获取
 * @param {Function} fetchFn
 * @param {number} retryCount
 * @returns {Promise}
 */
const fetchWithRetry = async (fetchFn, retryCount = 0) => {
  try {
    return await fetchFn();
  } catch (error) {
    if (retryCount < RETRY_CONFIG.maxRetries) {
      const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
      console.log(`刷新失败，${delay}ms后重试 (${retryCount + 1}/${RETRY_CONFIG.maxRetries})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(fetchFn, retryCount + 1);
    }
    throw error;
  }
};

/**
 * 刷新单个基金数据
 * @param {string} fundCode
 * @param {Function} apiGetFundQuote
 * @returns {Promise}
 */
const refreshFundData = async (fundCode, apiGetFundQuote) => {
  const cacheKey = `${FUND_DATA_CACHE_PREFIX}${fundCode}`;

  try {
    const data = await fetchWithRetry(() => apiGetFundQuote(fundCode));

    // 缓存数据，有效期到下一次刷新时间
    const nextRefresh = getNextScheduledRefresh();
    const expiry = nextRefresh.getTime() - Date.now();

    cache.setCache(cacheKey, data, expiry);

    return { success: true, data, fromCache: false };
  } catch (error) {
    console.error(`刷新基金 ${fundCode} 数据失败:`, error);

    // 尝试返回缓存数据
    const cachedData = cache.getCache(cacheKey);
    if (cachedData) {
      return { success: true, data: cachedData, fromCache: true, error: error.message };
    }

    return { success: false, error: error.message };
  }
};

/**
 * 批量刷新基金数据
 * @param {Array<string>} fundCodes
 * @param {Function} apiGetFundQuote
 * @param {Object} options
 * @returns {Promise}
 */
const refreshMultipleFunds = async (fundCodes, apiGetFundQuote, options = {}) => {
  const { onProgress = null, forceRefresh = false } = options;

  // 检查是否允许刷新
  if (!forceRefresh && !isInRefreshWindow()) {
    const nextRefresh = getNextScheduledRefresh();
    return {
      success: false,
      error: '不在刷新时间窗口内',
      nextScheduledRefresh: nextRefresh.getTime(),
      isInRefreshWindow: false
    };
  }

  setRefreshStatus({ status: REFRESH_STATUS.REFRESHING });

  const results = {
    success: [],
    failed: [],
    fromCache: [],
    total: fundCodes.length
  };

  for (let i = 0; i < fundCodes.length; i++) {
    const fundCode = fundCodes[i];

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: fundCodes.length,
        fundCode,
        percentage: Math.round(((i + 1) / fundCodes.length) * 100)
      });
    }

    const result = await refreshFundData(fundCode, apiGetFundQuote);

    if (result.success) {
      if (result.fromCache) {
        results.fromCache.push({ fundCode, ...result });
      } else {
        results.success.push({ fundCode, ...result });
      }
    } else {
      results.failed.push({ fundCode, ...result });
    }
  }

  // 更新刷新状态
  const hasFailures = results.failed.length > 0;
  const allFromCache = results.success.length === 0 && results.fromCache.length > 0;

  setRefreshStatus({
    status: hasFailures ? REFRESH_STATUS.FAILED : (allFromCache ? REFRESH_STATUS.CACHED : REFRESH_STATUS.SUCCESS),
    lastUpdate: Date.now(),
    nextScheduledRefresh: getNextScheduledRefresh().getTime(),
    isFromCache: allFromCache,
    errorMessage: hasFailures ? `${results.failed.length} 只基金刷新失败` : null,
    refreshResults: {
      success: results.success.length,
      failed: results.failed.length,
      fromCache: results.fromCache.length
    }
  });

  setLastRefreshTime(Date.now());

  return {
    success: results.failed.length === 0,
    results,
    isFromCache: allFromCache,
    nextScheduledRefresh: getNextScheduledRefresh().getTime()
  };
};

/**
 * 自动检查并执行定时刷新
 * @param {Array<string>} fundCodes
 * @param {Function} apiGetFundQuote
 * @returns {Promise}
 */
const autoRefreshIfNeeded = async (fundCodes, apiGetFundQuote) => {
  const lastRefresh = getLastRefreshTime();
  const now = Date.now();

  // 检查是否到达刷新时间且距离上次刷新已超过1小时
  const shouldRefresh = isScheduledRefreshTime() &&
    (!lastRefresh || (now - lastRefresh) > 60 * 60 * 1000);

  if (shouldRefresh) {
    console.log('执行定时基金数据刷新');
    return refreshMultipleFunds(fundCodes, apiGetFundQuote, { forceRefresh: true });
  }

  return {
    success: true,
    skipped: true,
    message: '未到刷新时间',
    nextScheduledRefresh: getNextScheduledRefresh().getTime()
  };
};

/**
 * 获取基金数据（优先从缓存获取）
 * @param {string} fundCode
 * @param {Function} apiGetFundQuote
 * @param {Object} options
 * @returns {Promise}
 */
const getFundData = async (fundCode, apiGetFundQuote, options = {}) => {
  const { forceRefresh = false } = options;
  const cacheKey = `${FUND_DATA_CACHE_PREFIX}${fundCode}`;

  // 如果不是强制刷新，先尝试从缓存获取
  if (!forceRefresh) {
    const cachedData = cache.getCache(cacheKey);
    if (cachedData) {
      return {
        success: true,
        data: cachedData,
        fromCache: true,
        nextScheduledRefresh: getNextScheduledRefresh().getTime()
      };
    }
  }

  // 缓存未命中或强制刷新，从API获取
  const result = await refreshFundData(fundCode, apiGetFundQuote);
  return {
    ...result,
    nextScheduledRefresh: getNextScheduledRefresh().getTime()
  };
};

/**
 * 格式化刷新时间显示
 * @param {number} timestamp
 * @returns {string}
 */
const formatRefreshTime = (timestamp) => {
  if (!timestamp) return '未刷新';

  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 小于1分钟
  if (diff < 60 * 1000) {
    return '刚刚';
  }

  // 小于1小时
  if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}分钟前`;
  }

  // 小于24小时
  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  }

  // 超过24小时，显示具体日期时间
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 清除所有基金缓存
 */
const clearFundCache = () => {
  try {
    const keys = wx.getStorageInfoSync().keys;
    keys.forEach(key => {
      if (key.startsWith(FUND_DATA_CACHE_PREFIX)) {
        wx.removeStorageSync(key);
      }
    });
    wx.removeStorageSync(FUND_REFRESH_KEY);
    wx.removeStorageSync(FUND_REFRESH_STATUS_KEY);
    console.log('已清除所有基金缓存');
  } catch (e) {
    console.error('清除基金缓存失败:', e);
  }
};

module.exports = {
  // 刷新控制
  isScheduledRefreshTime,
  getNextScheduledRefresh,
  isInRefreshWindow,
  autoRefreshIfNeeded,
  refreshMultipleFunds,
  refreshFundData,
  getFundData,

  // 状态管理
  getRefreshStatus,
  setRefreshStatus,
  getLastRefreshTime,

  // 工具函数
  formatRefreshTime,
  clearFundCache,

  // 常量
  REFRESH_STATUS,
  REFRESH_SCHEDULE
};
