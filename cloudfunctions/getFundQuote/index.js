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

  if (!code || !/^\d{6}$/.test(code)) {
    return {
      code: -1,
      message: '基金代码格式不正确，应为6位数字'
    };
  }

  try {
    // 使用天天基金网API获取基金信息
    const url = `https://fundgz.1234567.com.cn/js/${code}.js`;
    const rawData = await httpGet(url);

    // 解析返回的JSON数据
    const match = rawData.match(/jsonpgz\((.*)\)/);
    if (!match) {
      return {
        code: -1,
        message: '获取基金信息失败'
      };
    }

    const fundData = JSON.parse(match[1]);

    return {
      code: 0,
      data: {
        name: fundData.name,
        code: fundData.fundcode,
        netValue: parseFloat(fundData.dwjz) || 0,  // 单位净值
        estimateRate: parseFloat(fundData.gszzl) || 0,  // 估算涨跌幅
        estimateValue: parseFloat(fundData.gsz) || 0,  // 估算净值
        date: fundData.jzrq,  // 净值日期
        estimateTime: fundData.gztime  // 估算时间
      }
    };
  } catch (err) {
    console.error('获取基金行情失败', err);
    return {
      code: -1,
      message: '获取基金行情失败'
    };
  }
};
