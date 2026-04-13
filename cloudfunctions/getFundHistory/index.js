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
  const { code, date, page = 1, per = 30 } = event;

  // 验证基金代码
  if (!code || !/^\d{6}$/.test(code)) {
    return {
      code: -1,
      message: '基金代码格式不正确，应为6位数字'
    };
  }

  // 验证日期格式
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      code: -1,
      message: '日期格式不正确，应为YYYY-MM-DD格式'
    };
  }

  try {
    // 使用天天基金网API获取基金历史净值，默认30条/页
    const url = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${code}&page=${page}&per=${per}`;
    const rawData = await httpGet(url);

    // 解析返回的数据
    const match = rawData.match(/var apidata=\{([^}]+)\}/);
    if (!match) {
      return {
        code: -1,
        message: '获取基金历史净值失败'
      };
    }

    // 尝试从内容中解析净值数据
    const contentMatch = rawData.match(/content:\"([^\"]+)\"/);
    if (!contentMatch) {
      return {
        code: -1,
        message: '基金历史净值数据为空'
      };
    }

    // 解析HTML表格数据
    const content = contentMatch[1];
    const rows = content.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);

    if (!rows || rows.length === 0) {
      return {
        code: -1,
        message: '未找到基金历史净值数据'
      };
    }

    // 解析所有净值数据
    const historyData = [];
    let targetNetValue = null;
    let targetFound = false;

    for (const row of rows) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
      if (cells && cells.length >= 2) {
        const rowDate = cells[0].replace(/<[^>]+>/g, '').trim();
        const netValue = cells[1].replace(/<[^>]+>/g, '').trim();
        const accumValue = cells[2] ? cells[2].replace(/<[^>]+>/g, '').trim() : '';
        const dailyRate = cells[3] ? cells[3].replace(/<[^>]+>/g, '').trim() : '';

        if (rowDate && netValue) {
          const record = {
            date: rowDate,
            netValue: parseFloat(netValue),
            accumValue: accumValue ? parseFloat(accumValue) : null,
            dailyRate: dailyRate ? dailyRate.replace('%', '') : null
          };
          historyData.push(record);

          if (rowDate === date) {
            targetNetValue = record.netValue;
            targetFound = true;
          }
        }
      }
    }

    // 获取基金名称和总页数信息
    let fundName = '';
    let totalPages = 1;
    let totalCount = historyData.length;

    try {
      const latestUrl = `https://fundgz.1234567.com.cn/js/${code}.js`;
      const latestData = await httpGet(latestUrl);
      const latestMatch = latestData.match(/jsonpgz\((.*)\)/);
      if (latestMatch) {
        const fundData = JSON.parse(latestMatch[1]);
        fundName = fundData.name;
      }
    } catch (e) {
      console.warn('获取基金名称失败', e);
    }

    // 尝试从返回数据中获取总页数
    const pagesMatch = rawData.match(/pages:(\d+)/);
    if (pagesMatch) {
      totalPages = parseInt(pagesMatch[1]);
    }

    // 如果找到目标日期，返回成功
    if (targetFound && targetNetValue) {
      return {
        code: 0,
        data: {
          code: code,
          name: fundName,
          date: date,
          netValue: targetNetValue,
          isLatest: false,
          history: historyData,
          pagination: {
            currentPage: page,
            totalPages: totalPages,
            perPage: per,
            totalCount: totalCount
          }
        }
      };
    }

    // 如果没找到目标日期，检查是否是今天或未来日期
    const requestDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (requestDate >= today) {
      // 尝试获取最新净值
      try {
        const latestUrl = `https://fundgz.1234567.com.cn/js/${code}.js`;
        const latestData = await httpGet(latestUrl);
        const latestMatch = latestData.match(/jsonpgz\((.*)\)/);

        if (latestMatch) {
          const fundData = JSON.parse(latestMatch[1]);
          return {
            code: 0,
            data: {
              code: code,
              name: fundData.name,
              date: fundData.jzrq,
              netValue: parseFloat(fundData.dwjz),
              isLatest: true,
              message: '返回最新净值数据',
              history: historyData,
              pagination: {
                currentPage: page,
                totalPages: totalPages,
                perPage: per,
                totalCount: totalCount
              }
            }
          };
        }
      } catch (e) {
        console.warn('获取最新净值失败', e);
      }
    }

    // 返回历史数据，但未找到目标日期
    return {
      code: -1,
      message: `未找到 ${date} 的净值数据，可能是非交易日或数据尚未更新`,
      data: {
        code: code,
        name: fundName,
        history: historyData,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          perPage: per,
          totalCount: totalCount
        }
      }
    };

  } catch (err) {
    console.error('获取基金历史净值失败', err);
    return {
      code: -1,
      message: '获取基金历史净值失败，请稍后重试'
    };
  }
};
