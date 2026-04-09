const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  
  try {
    const result = await db.collection('accounts')
      .where({ _openid: OPENID })
      .orderBy('createTime', 'desc')
      .get();
    
    return {
      code: 0,
      data: result.data
    };
  } catch (err) {
    console.error('获取账户列表失败', err);
    return {
      code: -1,
      message: '获取账户列表失败'
    };
  }
};
