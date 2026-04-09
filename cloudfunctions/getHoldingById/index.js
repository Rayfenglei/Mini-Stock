const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { id } = event;
  
  try {
    const result = await db.collection('holdings').doc(id).get();
    
    if (result.data._openid !== OPENID) {
      return {
        code: -1,
        message: '无权访问该持仓'
      };
    }
    
    return {
      code: 0,
      data: result.data
    };
  } catch (err) {
    console.error('获取持仓详情失败', err);
    return {
      code: -1,
      message: '获取持仓详情失败'
    };
  }
};
