const cloud = require('wx-server-sdk');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// HTTP GET 请求工具
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(data);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// 获取股票批量行情
async function getBatchStockQuotes(codes) {
  if (!codes || codes.length === 0) return {};

  try {
    const codeParams = codes.map(c => {
      if (/^(sh|sz|bj)/i.test(c)) {
        return c;
      }
      const prefix = c.startsWith('6') || c.startsWith('8') || c.startsWith('4') ? 'sh' : 'sz';
      return `${prefix}${c}`;
    });

    const url = `https://qt.gtimg.cn/q=${codeParams.join(',')}`;
    const rawData = await httpGet(url);

    const data = {};
    const lines = rawData.split(';');

    lines.forEach((line) => {
      if (!line.trim()) return;

      const match = line.match(/v_(\w+)="([^"]*)"/);
      if (!match) return;

      const fullCode = match[1];
      const values = match[2].split('~');

      if (values.length < 4) return;

      const currentPrice = parseFloat(values[3]) || 0;
      const preClose = parseFloat(values[4]) || 0;
      const changePercent = parseFloat(values[32]) || 0;

      const quoteData = {
        currentPrice,
        preClose,
        changePercent
      };

      // 存储带前缀和不带前缀的代码
      data[fullCode] = quoteData;
      const codeWithoutPrefix = fullCode.replace(/^(sh|sz|bj)/i, '');
      data[codeWithoutPrefix] = quoteData;
    });

    return data;
  } catch (err) {
    console.error('获取股票行情失败', err);
    return {};
  }
}

// 获取基金行情
async function getFundQuote(code) {
  if (!code || !/^\d{6}$/.test(code)) return null;

  try {
    const url = `https://fundgz.1234567.com.cn/js/${code}.js`;
    const rawData = await httpGet(url);

    const match = rawData.match(/jsonpgz\((.*)\)/);
    if (!match) return null;

    const fundData = JSON.parse(match[1]);

    return {
      netValue: parseFloat(fundData.gsz) || parseFloat(fundData.dwjz) || 0,
      estimateRate: parseFloat(fundData.gszzl) || 0
    };
  } catch (err) {
    console.error(`获取基金 ${code} 行情失败`, err);
    return null;
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { accountId, assetType, refresh = false } = event;

  try {
    // 构建查询条件
    let whereCondition = { _openid: OPENID };

    if (accountId) {
      whereCondition.accountId = accountId;
    }

    // 如果指定了资产类型，添加类型筛选
    if (assetType) {
      whereCondition.assetType = assetType;
    }

    const result = await db.collection('holdings')
      .where(whereCondition)
      .orderBy('marketValue', 'desc')
      .get();

    let holdings = result.data;

    // 如果需要刷新行情数据，获取实时价格
    if (refresh && holdings.length > 0) {
      // 提取股票代码和基金代码
      const stockCodes = holdings
        .filter(item => item.assetType === 'stock' && item.assetCode)
        .map(item => item.assetCode);

      const fundCodes = holdings
        .filter(item => item.assetType === 'fund' && item.assetCode)
        .map(item => item.assetCode);

      // 获取实时行情
      let stockQuotes = {};
      let fundQuotes = {};

      if (stockCodes.length > 0) {
        stockQuotes = await getBatchStockQuotes(stockCodes);
      }

      if (fundCodes.length > 0) {
        for (const code of fundCodes) {
          const quote = await getFundQuote(code);
          if (quote) {
            fundQuotes[code] = quote;
          }
        }
      }

      // 更新持仓数据中的当前价格
      holdings = holdings.map(item => {
        if (!item.assetCode) return item;

        let updatedPrice = null;

        if (item.assetType === 'stock' && stockQuotes[item.assetCode]) {
          updatedPrice = stockQuotes[item.assetCode].currentPrice;
        } else if (item.assetType === 'fund' && fundQuotes[item.assetCode]) {
          updatedPrice = fundQuotes[item.assetCode].netValue;
        }

        if (updatedPrice && updatedPrice > 0) {
          return {
            ...item,
            currentPrice: updatedPrice
          };
        }

        return item;
      });
    }

    return {
      code: 0,
      data: holdings
    };
  } catch (err) {
    console.error('获取持仓列表失败', err);
    return {
      code: -1,
      message: '获取持仓列表失败'
    };
  }
};
