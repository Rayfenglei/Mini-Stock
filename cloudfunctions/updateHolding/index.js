const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { id, ...data } = event;
  
  try {
    // 检查持仓是否存在且属于当前用户
    const holding = await db.collection('holdings').doc(id).get();
    
    if (!holding.data) {
      return {
        code: -1,
        message: '持仓不存在'
      };
    }
    
    if (holding.data._openid !== OPENID) {
      return {
        code: -1,
        message: '无权修改该持仓'
      };
    }
    
    // 更新持仓数据
    await db.collection('holdings').doc(id).update({
      data: {
        ...data,
        updatedAt: new Date().toISOString()
      }
    });
    
    return {
      code: 0,
      message: '更新成功'
    };
  } catch (err) {
    console.error('更新持仓失败', err);
    return {
      code: -1,
      message: '更新失败'
    };
  }
};