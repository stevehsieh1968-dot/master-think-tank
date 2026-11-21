# 大師智囊團

把一個問題交給十二位大師：六位中國大師（孫子、王陽明、曾國藩、鬼谷子、諸葛亮、胡適）與六位外國大師（愛因斯坦、德魯克、芒格、賈伯斯、巴菲特、馬斯克），各自依自己的思維框架給出看法，最後合議成一份建議。

- 圓桌視覺：每位大師的立場（支持／有條件支持／先別急／反對）即時顯示在座位上
- 每位大師：核心主張、看法、反問你的關鍵問題、建議的下一步
- 合議總結：一句話結論、立場分布、共識與分歧、中西視角差異、行動步驟、風險

## 部署到 Vercel

1. 到 [vercel.com/new](https://vercel.com/new) 匯入這個 GitHub repo（Framework Preset 選 **Other**，其他設定都不用改）。
2. 在 **Settings → Environment Variables** 加入：

   | 名稱 | 必要 | 說明 |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | 是 | 你的 Anthropic API 金鑰（到 [console.anthropic.com](https://console.anthropic.com) 建立） |
   | `ANTHROPIC_MODEL` | 否 | 預設 `claude-sonnet-5-5` |
   | `RATE_LIMIT` | 否 | 每個 IP 每 10 分鐘最多請求數，預設 30 |

3. 重新部署（Deployments → Redeploy），完成後就有可分享的網址。

## 檔案結構

```
index.html      前端頁面（橫幅圖片已內嵌）
api/ask.js      Vercel Serverless Function，代為呼叫 Claude API
vercel.json     函式逾時設定（60 秒）
```

## 費用與安全

- 每次「召集智囊團」約呼叫 API 3 次（中國組、外國組、總結），費用由你的 API 帳號支付。建議在 Anthropic Console 設定每月花費上限。
- 提示詞在伺服器端組合，前端只能送出問題與大師名單，別人無法拿你的金鑰做其他用途。
- 金鑰只存在 Vercel 環境變數，不會出現在程式碼或瀏覽器中。

## 本機開發

```bash
npm i -g vercel
vercel dev
```

## 說明

各大師觀點是依其公開著作與言論提煉的思維框架所做的推演，並非本人意見；僅供思考參考，不構成投資、法律或醫療建議。
