/**
 * 交易时段管理模块
 * 判断当前是否处于A股交易时段（9:30-15:00）
 * 交易时间：周一至周五 9:30-11:30, 13:00-15:00
 */

// 交易时段配置
const MARKET_CONFIG = {
  // 上午交易开始时间（小时:分钟）
  morningStart: { hour: 9, minute: 30 },
  // 上午交易结束时间
  morningEnd: { hour: 11, minute: 30 },
  // 下午交易开始时间
  afternoonStart: { hour: 13, minute: 0 },
  // 下午交易结束时间
  afternoonEnd: { hour: 15, minute: 0 }
};

/**
 * 判断今天是否为交易日（周一至周五）
 * @returns {boolean}
 */
const isTradingDay = () => {
  const now = new Date();
  const day = now.getDay();
  // 0=周日, 6=周六
  return day >= 1 && day <= 5;
};

/**
 * 判断当前是否处于交易时段
 * @returns {boolean}
 */
const isTradingTime = () => {
  // 如果不是交易日，直接返回false
  if (!isTradingDay()) {
    return false;
  }

  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentTime = hour * 60 + minute; // 转换为分钟数

  const morningStart = MARKET_CONFIG.morningStart.hour * 60 + MARKET_CONFIG.morningStart.minute;
  const morningEnd = MARKET_CONFIG.morningEnd.hour * 60 + MARKET_CONFIG.morningEnd.minute;
  const afternoonStart = MARKET_CONFIG.afternoonStart.hour * 60 + MARKET_CONFIG.afternoonStart.minute;
  const afternoonEnd = MARKET_CONFIG.afternoonEnd.hour * 60 + MARKET_CONFIG.afternoonEnd.minute;

  // 判断是否在上午或下午交易时段
  return (currentTime >= morningStart && currentTime <= morningEnd) ||
         (currentTime >= afternoonStart && currentTime <= afternoonEnd);
};

/**
 * 获取下一个交易时段开始时间
 * @returns {Date|null}
 */
const getNextTradingStart = () => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentTime = hour * 60 + minute;

  const morningStart = MARKET_CONFIG.morningStart.hour * 60 + MARKET_CONFIG.morningStart.minute;
  const afternoonStart = MARKET_CONFIG.afternoonStart.hour * 60 + MARKET_CONFIG.afternoonStart.minute;

  const nextDate = new Date(now);

  // 如果在上午交易时段之前
  if (currentTime < morningStart) {
    nextDate.setHours(MARKET_CONFIG.morningStart.hour, MARKET_CONFIG.morningStart.minute, 0, 0);
    return nextDate;
  }

  // 如果在上午交易时段和下午交易时段之间
  if (currentTime > MARKET_CONFIG.morningEnd.hour * 60 + MARKET_CONFIG.morningEnd.minute &&
      currentTime < afternoonStart) {
    nextDate.setHours(MARKET_CONFIG.afternoonStart.hour, MARKET_CONFIG.afternoonStart.minute, 0, 0);
    return nextDate;
  }

  // 如果已经过了下午交易时段，返回明天的上午开盘时间
  if (currentTime > MARKET_CONFIG.afternoonEnd.hour * 60 + MARKET_CONFIG.afternoonEnd.minute) {
    nextDate.setDate(nextDate.getDate() + 1);
    // 跳过周末
    while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    nextDate.setHours(MARKET_CONFIG.morningStart.hour, MARKET_CONFIG.morningStart.minute, 0, 0);
    return nextDate;
  }

  // 当前正在交易时段内
  return null;
};

/**
 * 获取当前交易时段状态信息
 * @returns {Object}
 */
const getMarketStatus = () => {
  const now = new Date();
  const isTrading = isTradingTime();
  const nextStart = getNextTradingStart();

  return {
    isTrading,
    isTradingDay: isTradingDay(),
    nextTradingStart: nextStart ? nextStart.getTime() : null,
    currentTime: now.getTime()
  };
};

/**
 * 计算缓存过期时间
 * 交易时段：使用较短的缓存时间（如30秒）
 * 非交易时段：使用较长的缓存时间（如24小时）
 * @param {number} tradingExpiry - 交易时段缓存时间（毫秒）
 * @param {number} nonTradingExpiry - 非交易时段缓存时间（毫秒）
 * @returns {number} 建议的缓存过期时间
 */
const getCacheExpiry = (tradingExpiry = 10 * 60 * 1000, nonTradingExpiry = 24 * 60 * 60 * 1000) => {
  return isTradingTime() ? tradingExpiry : nonTradingExpiry;
};

module.exports = {
  isTradingDay,
  isTradingTime,
  getNextTradingStart,
  getMarketStatus,
  getCacheExpiry,
  MARKET_CONFIG
};
