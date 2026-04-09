const STORAGE_KEYS = {
  CURRENT_ACCOUNT_ID: 'currentAccountId',
  HOLDINGS_CACHE: 'holdingsCache_',
  STOCK_QUOTES_CACHE: 'stockQuotesCache',
  USER_INFO: 'userInfo'
};

const CACHE_EXPIRE_TIME = 5 * 60 * 1000;

const setStorage = (key, data) => {
  try {
    wx.setStorageSync(key, {
      data,
      timestamp: Date.now()
    });
    return true;
  } catch (e) {
    console.error('setStorage error', e);
    return false;
  }
};

const getStorage = (key) => {
  try {
    const result = wx.getStorageSync(key);
    if (!result || !result.data) return null;
    return result.data;
  } catch (e) {
    console.error('getStorage error', e);
    return null;
  }
};

const getCache = (key) => {
  try {
    const result = wx.getStorageSync(key);
    if (!result || !result.data) return null;
    if (Date.now() - result.timestamp > CACHE_EXPIRE_TIME) {
      wx.removeStorageSync(key);
      return null;
    }
    return result.data;
  } catch (e) {
    console.error('getCache error', e);
    return null;
  }
};

const setCache = (key, data) => {
  return setStorage(key, data);
};

const removeCache = (key) => {
  try {
    wx.removeStorageSync(key);
    return true;
  } catch (e) {
    console.error('removeCache error', e);
    return false;
  }
};

const clearAllCache = () => {
  try {
    wx.clearStorageSync();
    return true;
  } catch (e) {
    console.error('clearAllCache error', e);
    return false;
  }
};

module.exports = {
  STORAGE_KEYS,
  setStorage,
  getStorage,
  getCache,
  setCache,
  removeCache,
  clearAllCache
};
