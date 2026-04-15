import requests
from bs4 import BeautifulSoup

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

url = "https://quote.cngold.org/gjs/jjs.html"
res = requests.get(url, headers=headers, timeout=10)
res.encoding = "utf-8"
soup = BeautifulSoup(res.text, "html.parser")

# 保存HTML以便查看
with open("gold_page.html", "w", encoding="utf-8") as f:
    f.write(res.text)

print("页面已保存到 gold_page.html")
print("\n查找所有包含'黄金'的td标签:")
for td in soup.find_all("td"):
    text = td.get_text(strip=True)
    if "黄金" in text or "T+D" in text or "沪金" in text:
        print(f"找到: '{text}'")
