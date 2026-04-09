const cloud = require('wx-server-sdk');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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

exports.main = async (event, context) => {
  const { code } = event;
  
  try {
    let fullCode = code;
    if (!/^(sh|sz|bj)/i.test(code)) {
      const prefix = code.startsWith('6') || code.startsWith('8') || code.startsWith('4') ? 'sh' : 'sz';
      fullCode = `${prefix}${code}`;
    }
    
    const url = `https://qt.gtimg.cn/q=${fullCode}`;
    const rawData = await httpGet(url);
    
    const match = rawData.match(/v_(\w+)="([^"]*)"/);
    if (!match) {
      return {
        code: -1,
        message: '获取股票行情失败'
      };
    }
    
    const values = match[2].split('~');
    if (values.length < 4) {
      return {
        code: -1,
        message: '获取股票行情失败'
      };
    }
    
    const name = values[1];
    const currentPrice = parseFloat(values[3]) || 0;
    const preClose = parseFloat(values[4]) || 0;
    const open = parseFloat(values[5]) || 0;
    const high = parseFloat(values[33]) || 0;
    const low = parseFloat(values[34]) || 0;
    const changePercent = parseFloat(values[32]) || 0;
    
    return {
      code: 0,
      data: {
        name,
        currentPrice,
        changePercent,
        preClose,
        open,
        high,
        low
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
