const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { id } = event;
  
  try {
    const holding = await db.collection('holdings').doc(id).get();
    
    if (holding.data._openid !== OPENID) {
      return {
        code: -1,
        message: '无权删除该持仓'
      };
    }
    
    await db.collection('holdings').doc(id).remove();
    
    return {
      code: 0,
      message: '删除成功'
    };
  } catch (err) {
    console.error('删除持仓失败', err);
    return {
      code: -1,
      message: '删除持仓失败'
    };
  }
};
