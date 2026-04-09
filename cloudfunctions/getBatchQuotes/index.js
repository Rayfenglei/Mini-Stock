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
  const { codes } = event;
  
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    return { code: 0, data: {} };
  }
  
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
      
      const name = values[1];
      const currentPrice = parseFloat(values[3]) || 0;
      const preClose = parseFloat(values[4]) || 0;
      const open = parseFloat(values[5]) || 0;
      const high = parseFloat(values[33]) || 0;
      const low = parseFloat(values[34]) || 0;
      const changePercent = parseFloat(values[32]) || 0;
      
      const quoteData = {
        name,
        currentPrice,
        preClose,
        open,
        high,
        low,
        changePercent
      };
      
      data[fullCode] = quoteData;
      
      const codeWithoutPrefix = fullCode.replace(/^(sh|sz|bj)/i, '');
      data[codeWithoutPrefix] = quoteData;
    });
    
    return { code: 0, data };
  } catch (err) {
    console.error('获取批量行情失败', err);
    return { code: -1, message: '获取批量行情失败', data: {} };
  }
};
