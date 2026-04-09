const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { code } = event;
  
  try {
    const prefix = code.substring(0, 2);
    const url = `https://qt.gtimg.cn/q=${prefix}${code}`;
    
    return {
      code: 0,
      data: {
        name: '示例股票',
        currentPrice: 10.50,
        changePercent: 2.5,
        preClose: 10.25,
        open: 10.30,
        high: 10.80,
        low: 10.20
      }
    };
  } catch (err) {
    console.error('获取股票行情失败', err);
    return {
      code: -1,
      message: '获取股票行情失败'
    };
  }
};
