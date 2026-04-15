import requests
import json

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://quote.cngold.org/"
}

# 直接调用API获取实时行情数据
codes = "JO_9753,JO_92226,JO_9754,JO_71,JO_70,JO_73,JO_72,JO_75,JO_9751,JO_9752,JO_92224,JO_92225,JO_92276,JO_76,JO_74,JO_92277,JO_92278"
url = f"https://api.jijinhao.com/quoteCenter/realTime.htm?codes={codes}"

res = requests.get(url, headers=headers, timeout=10)
res.encoding = "utf-8"

# 提取JSON数据 (格式: var quote_json = {...})
content = res.text
json_start = content.find('{')
json_end = content.rfind('}') + 1
json_str = content[json_start:json_end]

data = json.loads(json_str)

# 定义代码映射
name_map = {
    "JO_9753": "黄金T+D",
    "JO_92226": "m黄金T+D",
    "JO_9754": "白银T+D",
    "JO_71": "黄金9999",
    "JO_70": "黄金9995",
    "JO_73": "金条100g",
    "JO_72": "金条50g",
    "JO_75": "白银999",
    "JO_9751": "黄金T+N1",
    "JO_9752": "黄金T+N2",
    "JO_92224": "i黄金100g",
    "JO_92225": "i黄金9999",
}

# 输出
print("===== 沪金/上金所实时行情 =====")
print(f"数据时间: {data.get('JO_9753', {}).get('time', 'N/A')}")
print()

for code, name in name_map.items():
    if code in data:
        quote = data[code]
        price = quote.get('q63', 0)  # 最新价
        change = quote.get('q70', 0)  # 涨跌额
        change_pct = quote.get('q80', 0)  # 涨跌幅
        unit = quote.get('unit', '元/克')
        
        if price:
            print(f"{name}: {price} {unit} (涨跌: {change}, 涨跌幅: {change_pct}%)")
        else:
            print(f"{name}: 暂无数据")
