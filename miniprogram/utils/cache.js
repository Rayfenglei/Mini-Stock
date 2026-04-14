/**
 * 缓存管理模块
 * 实现基于时间的缓存策略，支持5分钟有效期
 * 优化：根据交易时段动态调整缓存策略
 */

const marketTime = require('./marketTime');

// 交易时段缓存有效期：30秒（实时更新）
const TRADING_CACHE_EXPIRY = 30 * 1000;
// 非交易时段缓存有效期：24小时（使用缓存）
const NON_TRADING_CACHE_EXPIRY = 24 * 60 * 60 * 1000;
// 默认缓存有效期（向后兼容）
const CACHE_EXPIRY = 5 * 60 * 1000;

const CACHE_PREFIX = 'stock_cache_';

// 缓存统计
let cacheStats = {
  hits: 0,
  misses: 0,
  totalRequests: 0
};

/**
 * 生成缓存键
 * @param {string} key - 基础键名
 * @param {Object} params - 参数对象
 * @returns {string} 完整的缓存键
 */
const generateCacheKey = (key, params = {}) => {
  const paramsStr = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return `${CACHE_PREFIX}${key}${paramsStr ? '_' + paramsStr : ''}`;
};

/**
 * 设置缓存
 * @param {string} key - 缓存键
 * @param {*} data - 缓存数据
 * @param {number} expiry - 过期时间（毫秒），默认5分钟
 */
const setCache = (key, data, expiry = CACHE_EXPIRY) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now(),
      expiry
    };
    wx.setStorageSync(key, cacheData);
  } catch (e) {
    console.error('设置缓存失败:', e);
    // 如果存储失败，清理过期缓存
    clearExpiredCache();
  }
};

/**
 * 获取缓存
 * @param {string} key - 缓存键
 * @returns {Object|null} 缓存数据或null
 */
const getCache = (key) => {
  try {
    const cacheData = wx.getStorageSync(key);
    if (!cacheData) {
      cacheStats.misses++;
      cacheStats.totalRequests++;
      return null;
    }

    const now = Date.now();
    if (now - cacheData.timestamp > cacheData.expiry) {
      // 缓存已过期
      wx.removeStorageSync(key);
      cacheStats.misses++;
      cacheStats.totalRequests++;
      return null;
    }

    cacheStats.hits++;
    cacheStats.totalRequests++;
    return cacheData.data;
  } catch (e) {
    console.error('获取缓存失败:', e);
    cacheStats.misses++;
    cacheStats.totalRequests++;
    return null;
  }
};

/**
 * 清除指定缓存
 * @param {string} key - 缓存键
 */
const removeCache = (key) => {
  try {
    wx.removeStorageSync(key);
  } catch (e) {
    console.error('清除缓存失败:', e);
  }
};

/**
 * 清除所有过期缓存
 */
const clearExpiredCache = () => {
  try {
    const keys = wx.getStorageInfoSync().keys;
    const now = Date.now();

    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        try {
          const cacheData = wx.getStorageSync(key);
          if (cacheData && now - cacheData.timestamp > cacheData.expiry) {
            wx.removeStorageSync(key);
          }
        } catch (e) {
          console.error('清理缓存项失败:', key, e);
        }
      }
    });
  } catch (e) {
    console.error('清理过期缓存失败:', e);
  }
};

/**
 * 清除所有缓存
 */
const clearAllCache = () => {
  try {
    const keys = wx.getStorageInfoSync().keys;
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        wx.removeStorageSync(key);
      }
    });
    // 重置统计
    cacheStats = { hits: 0, misses: 0, totalRequests: 0 };
  } catch (e) {
    console.error('清除所有缓存失败:', e);
  }
};

/**
 * 获取缓存命中率
 * @returns {Object} 缓存统计信息
 */
const getCacheStats = () => {
  const hitRate = cacheStats.totalRequests > 0
    ? (cacheStats.hits / cacheStats.totalRequests * 100).toFixed(2)
    : 0;

  return {
    ...cacheStats,
    hitRate: parseFloat(hitRate),
    hitRateFormatted: `${hitRate}%`
  };
};

/**
 * 重置缓存统计
 */
const resetCacheStats = () => {
  cacheStats = { hits: 0, misses: 0, totalRequests: 0 };
};

/**
 * 带缓存的数据获取函数
 * @param {string} cacheKey - 缓存键
 * @param {Function} fetchFn - 数据获取函数
 * @param {Object} options - 配置选项
 * @returns {Promise} 数据
 */
const fetchWithCache = async (cacheKey, fetchFn, options = {}) => {
  const {
    expiry = null, // 如果为null，自动根据交易时段判断
    forceRefresh = false,
    onCacheHit = null,
    onCacheMiss = null,
    useMarketTime = true // 是否使用交易时段判断
  } = options;

  // 根据交易时段确定缓存有效期
  const actualExpiry = useMarketTime
    ? (expiry || marketTime.getCacheExpiry(TRADING_CACHE_EXPIRY, NON_TRADING_CACHE_EXPIRY))
    : (expiry || CACHE_EXPIRY);

  const isTrading = marketTime.isTradingTime();

  // 非交易时段：优先使用缓存，避免不必要的接口请求
  if (!isTrading && !forceRefresh) {
    const cachedData = getCache(cacheKey);
    if (cachedData !== null) {
      console.log('非交易时段：使用缓存数据', cacheKey);
      if (onCacheHit) onCacheHit(cachedData);
      return cachedData;
    }
    // 如果没有缓存，继续获取数据并缓存24小时
    console.log('非交易时段：无缓存，获取数据并长期缓存', cacheKey);
  }

  // 交易时段：如果不是强制刷新，先尝试从缓存获取
  if (isTrading && !forceRefresh) {
    const cachedData = getCache(cacheKey);
    if (cachedData !== null) {
      console.log('交易时段：使用缓存数据（30秒内）', cacheKey);
      if (onCacheHit) onCacheHit(cachedData);
      return cachedData;
    }
  }

  // 缓存未命中或强制刷新，获取新数据
  if (onCacheMiss) onCacheMiss();

  try {
    const data = await fetchFn();
    // 存入缓存，使用根据交易时段确定的过期时间
    setCache(cacheKey, data, actualExpiry);
    console.log(isTrading ? '交易时段：获取新数据并缓存' : '非交易时段：获取数据并长期缓存', cacheKey);
    return data;
  } catch (error) {
    // 如果获取失败，尝试返回缓存数据（即使已过期）
    const staleCache = wx.getStorageSync(cacheKey);
    if (staleCache) {
      console.warn('获取失败，使用过期缓存数据');
      return staleCache.data;
    }
    throw error;
  }
};

/**
 * 获取行情数据专用缓存函数
 * 根据交易时段自动调整缓存策略
 * @param {string} cacheKey - 缓存键
 * @param {Function} fetchFn - 数据获取函数
 * @param {Object} options - 配置选项
 * @returns {Promise} 数据
 */
const fetchQuoteWithCache = async (cacheKey, fetchFn, options = {}) => {
  return fetchWithCache(cacheKey, fetchFn, {
    ...options,
    useMarketTime: true
  });
};

module.exports = {
  generateCacheKey,
  setCache,
  getCache,
  removeCache,
  clearExpiredCache,
  clearAllCache,
  getCacheStats,
  resetCacheStats,
  fetchWithCache,
  fetchQuoteWithCache,
  CACHE_EXPIRY,
  TRADING_CACHE_EXPIRY,
  NON_TRADING_CACHE_EXPIRY
};
