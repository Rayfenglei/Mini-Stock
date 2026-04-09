const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { accountId } = event;
  
  try {
    const result = await db.collection('transactions')
      .where({ accountId, _openid: OPENID })
      .orderBy('tradeDate', 'desc')
      .get();
    
    return {
      code: 0,
      data: result.data
    };
  } catch (err) {
    console.error('获取交易记录失败', err);
    return {
      code: -1,
      message: '获取交易记录失败'
    };
  }
};
