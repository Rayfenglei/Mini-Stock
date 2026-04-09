const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { accountId, refresh = false } = event;
  
  try {
    let query = db.collection('holdings').where({ _openid: OPENID });
    
    if (accountId) {
      query = db.collection('holdings').where({ accountId, _openid: OPENID });
    }
    
    const result = await query.orderBy('marketValue', 'desc').get();
    
    return {
      code: 0,
      data: result.data
    };
  } catch (err) {
    console.error('获取持仓列表失败', err);
    return {
      code: -1,
      message: '获取持仓列表失败'
    };
  }
};
