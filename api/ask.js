// Vercel Serverless Function：大師智囊團的 Claude 代理
// 需要在 Vercel 專案設定環境變數 ANTHROPIC_API_KEY（必要）與 ANTHROPIC_MODEL（選填）
// 提示詞在伺服器端組合，前端只能送問題與大師名單，避免金鑰被拿去做其他用途。

const M=[
{id:'sunzi',side:'east',seal:'孫',tool:'先勝後戰',name:'孫子',era:'春秋・兵家',lens:'先勝後戰、知己知彼、避實擊虛、因敵變化、不戰而屈人之兵；建議都帶條件（若形勢A則B），第一步先問掌握多少資訊。'},
{id:'wym',tool:'知行合一',side:'east',seal:'陽',name:'王陽明',era:'明・心學',lens:'知行合一、致良知、心即理、事上磨練、去人欲存天理；直指動機與良知，戳破「知道卻不做」。'},
{id:'zgf',tool:'結硬寨打呆仗',side:'east',seal:'曾',name:'曾國藩',era:'清・湘軍統帥',lens:'結硬寨打呆仗、以拙勝巧、日課自省、挺經（逆境耐煩）、廣收慎用；重笨功夫與穩紮穩打。'},
{id:'ggz',tool:'捭闔揣摩',side:'east',seal:'鬼',name:'鬼谷子',era:'戰國・縱橫家',lens:'捭闔、揣摩、飛鉗、忤合、權變；先揣度各方真實意圖與利害，再定說服與博弈之術，凡事留餘地。'},
{id:'zgl',tool:'上中下三策',side:'east',seal:'亮',name:'諸葛亮',era:'三國・蜀漢丞相',lens:'隆中對式全局分析、上中下三策、料敵從寬用兵從嚴、用人如器、當斷不斷反受其亂；必給上中下三策。'},
{id:'hushi',tool:'大膽假設',side:'east',seal:'胡',name:'胡適',era:'民國・實驗主義',lens:'大膽假設小心求證、有幾分證據說幾分話、多研究問題少談主義、漸進改良、容忍；把決策拆成可驗證的假設。'},
{id:'einstein',tool:'思維實驗',side:'west',seal:'愛',name:'愛因斯坦',era:'物理學家',lens:'思維實驗、參考系切換（找各方都認同的不變量）、第一性原理、簡潔原則、反直覺思考；常以想像場景切入。'},
{id:'drucker',tool:'聚焦貢獻',side:'west',seal:'德',name:'德魯克',era:'管理學之父',lens:'效能優先於效率、聚焦貢獻、有效決策（邊界條件）、用人所長、回饋分析、企業目的是創造顧客；直接不繞彎。'},
{id:'munger',tool:'反過來想',side:'west',seal:'芒',name:'芒格',era:'投資家',lens:'逆向思考（怎樣保證失敗）、多元思維模型、激勵機制決定一切、能力圈、認知偏誤與Lollapalooza效應；尖銳幽默。'},
{id:'jobs',tool:'聚焦就是說不',side:'west',seal:'賈',name:'賈伯斯',era:'Apple 創辦人',lens:'聚焦就是說不、端到端掌控、連點成線、死亡過濾器、科技與人文交會；直接、挑剔、追求令人驚嘆的體驗，第一人稱。'},
{id:'buffett',tool:'安全邊際',side:'west',seal:'巴',name:'巴菲特',era:'投資家',lens:'護城河、安全邊際、能力圈、市場先生、複利、打孔卡20次、聲譽法則；平實比喻、重長期、不虧本金。'},
{id:'musk',tool:'第一性原理',side:'west',seal:'馬',name:'馬斯克',era:'Tesla / SpaceX',lens:'第一性原理與漸近極限（理論最低成本/時間）、五步演算法（質疑需求、刪除、簡化、加速、自動化）、快速迭代、極端期限。'}];
const STANCES=['支持','有條件支持','先別急','反對'];
const BY_ID=Object.fromEntries(M.map(m=>[m.id,m]));
const clip=(s,n)=>String(s??'').slice(0,n);

// 簡易限流（每個執行個體各自計算，僅能擋掉明顯濫用）
const hits=new Map();
function limited(ip){
  const now=Date.now(),win=10*60*1000,max=Number(process.env.RATE_LIMIT||30);
  const arr=(hits.get(ip)||[]).filter(t=>now-t<win);arr.push(now);hits.set(ip,arr);
  return arr.length>max;
}

function sidePrompt(list,q,ctx){
  return `你是「大師智囊團」的書記。請分別以下列每位大師的思維框架與說話風格，針對使用者的問題給出看法。每位大師都要用自己的核心方法分析，觀點要具體、針對這個問題，不可空泛，彼此要有差異，可以互相不同意。
全部使用繁體中文（台灣用語），大師以第一人稱發言。

大師名單：
${list.map(m=>`- id=${m.id}｜${m.name}（${m.era}）：${m.lens}`).join('\n')}

使用者的問題：${q}
${ctx?`背景與限制：${ctx}`:''}

只輸出 JSON，不要任何其他文字，格式：
{"views":{"<id>":{"stance":"支持|有條件支持|先別急|反對 擇一","headline":"不超過14字的核心主張","view":"110到160字的看法，帶出該大師的招牌方法","keyQuestion":"他會反問使用者的一個關鍵問題","action":"一個具體可執行的下一步"}}}`;
}
function sumPrompt(q,ctx,views){
  const lines=M.filter(m=>views[m.id]).map(m=>{const v=views[m.id];return `${m.name}（${m.side==='east'?'中國':'外國'}）【${v.stance}】${v.headline}：${v.view} 下一步：${v.action}`}).join('\n');
  return `你是智囊團主持人。以下是中外大師對同一問題的發言，請合議出一份客觀、可執行的總結建議。繁體中文（台灣用語）。共識與分歧要點名是哪些大師。
問題：${q}
${ctx?`背景：${ctx}`:''}
發言：
${lines}

只輸出 JSON：{"verdict":"一句話結論，不超過40字","consensus":["2到4點"],"divergence":["2到3點"],"eastWest":"中國與外國大師視角差異，60到100字","recommendation":"綜合建議，40到70字","steps":["3到5個有時間順序的行動步驟"],"risks":["2到3個風險"]}`;
}
function parseJSON(t){const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<a)throw new Error('模型回傳格式錯誤');return JSON.parse(t.slice(a,b+1))}

async function callClaude(prompt){
  const r=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','content-type':'application/json'},
    body:JSON.stringify({model:process.env.ANTHROPIC_MODEL||'claude-sonnet-5-5',max_tokens:4096,messages:[{role:'user',content:prompt}]})
  });
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(j?.error?.message||('Anthropic API '+r.status));e.status=r.status===429?429:502;throw e}
  return (j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
}

module.exports=async(req,res)=>{
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'只接受 POST'})}
  if(!process.env.ANTHROPIC_API_KEY)return res.status(500).json({error:'伺服器尚未設定 ANTHROPIC_API_KEY'});
  const ip=String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||'local';
  if(limited(ip))return res.status(429).json({error:'請求太頻繁，請稍後再試'});
  let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch{body={}}}
  body=body||{};
  const q=clip(body.q,1000).trim(),ctx=clip(body.ctx,1000).trim();
  if(!q)return res.status(400).json({error:'缺少問題'});
  try{
    if(body.kind==='side'){
      const ids=[...new Set(Array.isArray(body.ids)?body.ids:[])].filter(id=>BY_ID[id]).slice(0,6);
      if(!ids.length)return res.status(400).json({error:'缺少大師名單'});
      const out=parseJSON(await callClaude(sidePrompt(ids.map(id=>BY_ID[id]),q,ctx)));
      return res.status(200).json({data:out});
    }
    if(body.kind==='summary'){
      const views={};
      for(const [id,v] of Object.entries(body.views||{})){
        if(!BY_ID[id]||!v)continue;
        views[id]={stance:STANCES.includes(v.stance)?v.stance:'有條件支持',headline:clip(v.headline,40),view:clip(v.view,400),action:clip(v.action,120)};
      }
      if(!Object.keys(views).length)return res.status(400).json({error:'缺少大師發言'});
      const out=parseJSON(await callClaude(sumPrompt(q,ctx,views)));
      return res.status(200).json({data:out});
    }
    return res.status(400).json({error:'未知的請求類型'});
  }catch(e){return res.status(e.status||500).json({error:e.message||'伺服器錯誤'})}
};
