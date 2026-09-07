const FEEDS = [
  {name:'PUNCH Latest News', url:'https://rss.punchng.com/v1/category/latest_news', type:'News', category:'News'},
  {name:'Vanguard Nigeria', url:'https://www.vanguardngr.com/feed/', type:'News', category:'News'},
  {name:'Premium Times Nigeria', url:'https://www.premiumtimesng.com/feed', type:'News', category:'News'},
  {name:'Daily Post Nigeria', url:'https://dailypost.ng/feed', type:'News', category:'News'},
  {name:'Legit.ng', url:'https://www.legit.ng/rss/all.rss', type:'News', category:'Entertainment'},
  {name:'Nairametrics', url:'https://nairametrics.com/feed/', type:'News', category:'Business'},
  {name:'Brila Sports', url:'https://brila.net/feed/', type:'News', category:'Sports'},
  {name:'The Reporter Sports', url:'https://thereporter.com.ng/rss/category/sports-2', type:'News', category:'Sports'},
  {name:'SportsRation', url:'https://sportsration.com/feed/', type:'News', category:'Sports'},
  {name:'THISDAY Nigeria', url:'https://www.thisdaylive.com/feed', type:'News', category:'News'},
  {name:'BusinessDay Nigeria', url:'https://businessday.ng/feed/', type:'News', category:'Business'}
];
function decode(s=''){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/\s+/g,' ').trim();}
function textTag(xml,name){const m=xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));return m?decode(m[1]):'';}
function attrTag(xml,name,attr){const m=xml.match(new RegExp(`<${name}\\b[^>]*\\b${attr}=["']([^"']+)["'][^>]*\\/?>(?:<\\/${name}>)?`,'i'));return m?decode(m[1]):'';}
function firstLink(block){return textTag(block,'link')||attrTag(block,'link','href')||'';}
function parseItems(xml,feed){const rss=xml.match(/<item\b[\s\S]*?<\/item>/gi)||[];const atom=xml.match(/<entry\b[\s\S]*?<\/entry>/gi)||[];const blocks=rss.length?rss:atom;return blocks.slice(0,15).map(b=>{const title=textTag(b,'title');let link=firstLink(b);if(!link){const m=b.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);link=m?decode(m[1]):'';}const pub=textTag(b,'pubDate')||textTag(b,'published')||textTag(b,'updated')||textTag(b,'dc:date');const desc=textTag(b,'content:encoded')||textTag(b,'content')||textTag(b,'description')||textTag(b,'summary');if(!title||!link)return null;let d=Date.parse(pub);if(!Number.isFinite(d))d=Date.now();return {id:`external:${feed.name}:${link}`,title,source_name:feed.name,source_url:link,summary:decode(desc).slice(0,2500),category:feed.category,type:feed.type,published_at:new Date(d).toISOString()};}).filter(Boolean);}
async function fetchFeed(feed){let last='Unknown error';for(let attempt=1;attempt<=3;attempt++){const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);try{const r=await fetch(feed.url,{signal:c.signal,headers:{accept:'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8','user-agent':'IfekaHub/6.8.0 External Source Monitor'}});if(!r.ok){last=`HTTP ${r.status}`;if(![408,425,429,500,502,503,504].includes(r.status))throw new Error(last);}else{const items=parseItems(await r.text(),feed);if(items.length)return items;last='Feed returned no parseable items';}}catch(e){last=e?.name==='AbortError'?'Timeout':(e?.message||String(e));}finally{clearTimeout(t);}if(attempt<3)await new Promise(r=>setTimeout(r,500*attempt));}throw new Error(last);}

// Official opportunity directories. These are checked by the scheduled collector.
// New records are created as PENDING so an admin can verify the exact
// eligibility/deadline before public publication. No third-party aggregator is used.
const OPPORTUNITY_SOURCES = [
  {name:'Nigeria e-Government Portal', url:'https://services.gov.ng/?tab=subsidy', provider:'Federal Government of Nigeria', category:'Government', location:'Nigeria'},
  {name:'Federal Ministry of Education', url:'https://education.gov.ng/', provider:'Federal Ministry of Education', category:'Scholarships & Education', location:'Nigeria'},
  {name:'FME TVET Initiative', url:'https://www.tvet.education.gov.ng/', provider:'Federal Ministry of Education', category:'Training & Skills', location:'Nigeria'},
  {name:'3MTT DeepTech_Ready', url:'https://3mtt.nitda.gov.ng/deeptech/', provider:'3MTT / Federal Ministry of Communications, Innovation & Digital Economy', category:'Training & Skills', location:'Nigeria'},
  {name:'NYSC SAED', url:'https://www.nysc.gov.ng/saed.html', provider:'NYSC', category:'Training & Skills', location:'Nigeria'},
  {name:'Presidential Amnesty Programme', url:'https://osapnd.gov.ng/', provider:'Presidential Amnesty Programme', category:'Government Programmes', location:'Niger Delta, Nigeria'}
];
const OPPORTUNITY_KEYWORDS = /\b(apply|application|scholarship|grant|funding|fellowship|trainee|training|programme|program|job|jobs|career|internship|opportunity|empowerment|skills|stipend|loan|startup|entrepreneur|youth)\b/i;
const GENERIC_LINK_TEXT = /^(apply now|click here|learn more|read more|view|details|apply|more|home|login|sign in)$/i;

function htmlDecode(s=''){ return decode(s).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim(); }
function stripHtml(s=''){ return htmlDecode(s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ')); }
function absoluteUrl(href,base){ try{return new URL(href,base).toString();}catch{return href||'';} }

function parseOpportunityPage(html,src){
  const out=[],seen=new Set();
  const anchors=[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  for(const m of anchors){
    const attrs=m[1]||'', rawText=m[2]||'', href=(attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)||[])[1]||'';
    const text=stripHtml(rawText);
    if(!href||!text||text.length<8||text.length>180||GENERIC_LINK_TEXT.test(text)) continue;
    const around=stripHtml(html.slice(Math.max(0,m.index-1200),Math.min(html.length,m.index+1800)));
    if(!OPPORTUNITY_KEYWORDS.test(text+' '+around)) continue;
    const url=absoluteUrl(href,src.url);
    if(!/^https?:\/\//i.test(url)||seen.has(url)) continue;
    if(/\/(privacy|terms|contact|about|login|signin|signup|facebook|twitter|instagram|youtube)(\/|$)/i.test(url)) continue;
    const deadlineMatch=around.match(/\b(?:deadline|closing date|closes|applications close|apply by)\b[^.]{0,120}?(\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b)/i);
    seen.add(url);
    out.push({
      id:`opportunity:${src.name}:${url}`, title:text, source_name:src.provider, source_url:url,
      summary:around.slice(0,1800), category:src.category, location:src.location,
      type:'Opportunity', deadline:deadlineMatch?deadlineMatch[1]:null
    });
    if(out.length>=12) break;
  }
  return out;
}

async function fetchOpportunitySource(src){
  let last='Unknown error';
  for(let attempt=1;attempt<=2;attempt++){
    const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);
    try{
      const r=await fetch(src.url,{signal:c.signal,headers:{accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8','user-agent':'IfekaHub Opportunity Monitor/1.0'}});
      if(!r.ok){last=`HTTP ${r.status}`;if(![408,425,429,500,502,503,504].includes(r.status))throw new Error(last);}
      else { const body=await r.text(); const items=parseOpportunityPage(body,src); return {items,status:{name:src.name,ok:true,count:items.length}}; }
    }catch(e){last=e?.name==='AbortError'?'Timeout':(e?.message||String(e));}
    finally{clearTimeout(t);}
    if(attempt<2) await new Promise(r=>setTimeout(r,500));
  }
  return {items:[],status:{name:src.name,ok:false,count:0,error:last}};
}

async function officialOpportunities(){
  const results=[],statuses=[];
  await Promise.all(OPPORTUNITY_SOURCES.map(async src=>{
    const r=await fetchOpportunitySource(src); results.push(...r.items); statuses.push(r.status);
  }));
  const seen=new Set(), unique=results.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;});
  return {items:unique,feed_status:statuses};
}

async function externalContent(){
  const results=[],statuses=[];
  await Promise.all(FEEDS.map(async f=>{
    try{const items=await fetchFeed(f);results.push(...items);statuses.push({name:f.name,ok:true,count:items.length});}
    catch(e){statuses.push({name:f.name,ok:false,count:0,error:String(e?.message||e)});}
  }));
  const opp=await officialOpportunities();
  results.push(...opp.items); statuses.push(...opp.feed_status);
  results.sort((a,b)=>new Date(b.published_at||0)-new Date(a.published_at||0));
  const seen=new Set(),unique=results.filter(x=>{const k=x.source_url||x.id;if(seen.has(k))return false;seen.add(k);return true;});
  return {ok:true,checked_at:new Date().toISOString(),items:unique.slice(0,160),
    feeds:[...FEEDS.map(f=>f.name),...OPPORTUNITY_SOURCES.map(s=>s.name)],
    feed_status:statuses.sort((a,b)=>a.name.localeCompare(b.name)),
    collector_version:'6.8.0'};
}
async function persistToSupabase(items,env){
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return {enabled:false,saved:0,skipped:0,errors:[],error:'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured'};
  const base=env.SUPABASE_URL.replace(/\/$/,'');
  const h={'apikey':env.SUPABASE_SERVICE_ROLE_KEY,'Authorization':`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json','Prefer':'return=minimal'};
  let saved=0,skipped=0,errors=[];
  const pushError=(label,e)=>{const msg=String(e?.message||e);errors.push(`${label}: ${msg}`);};

  // Cloudflare Workers Free allows 50 external subrequests per invocation.
  // Never do one Supabase request per story. Group by source: at most
  // one lookup + one bulk insert per feed, keeping the whole run well below 50.
  const groups=new Map();
  for(const x of items){
    const key=(x.type==='Job'||x.type==='Opportunity')?'opportunity:'+String(x.source_name||'External Source'):'news:'+String(x.source_name||'External Source');
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(x);
  }

  for(const [groupKey,group] of groups){
    try{
      const isOpp=groupKey.startsWith('opportunity:');
      if(isOpp){
        const provider=group[0].source_name||'External Source';
        const source='External: '+provider;
        const titles=group.map(x=>x.title).filter(Boolean);
        const params=new URLSearchParams({select:'title',provider:`eq.${provider}`,limit:'200'});
        const q=await fetch(`${base}/rest/v1/opportunities?${params.toString()}`,{headers:h});
        if(!q.ok){const body=await q.text().catch(()=> '');throw new Error(`opportunities lookup HTTP ${q.status}${body?`: ${body.slice(0,500)}`:''}`);}
        const existingRows=await q.json();
        const existing=new Set(existingRows.map(r=>r.title));
        const fresh=group.filter(x=>x.title&&!existing.has(x.title));
        skipped+=group.length-fresh.length;
        if(!fresh.length)continue;
        const payload=fresh.map(x=>({title:x.title,provider:x.source_name||'External Source',category:x.category||'Government',location:x.location||'Nigeria',deadline:x.deadline||null,application_url:x.source_url||'',source,description:x.summary||'Official opportunity collected for admin review.',featured:false,is_active:false,approval_status:'pending',status:'Pending',published:false}));
        const ins=await fetch(`${base}/rest/v1/opportunities`,{method:'POST',headers:{...h,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(payload)});
        if(!ins.ok){const body=await ins.text().catch(()=> '');throw new Error(`opportunities bulk insert HTTP ${ins.status}${body?`: ${body.slice(0,500)}`:''}`);}
        saved+=fresh.length;
      }else{
        const sourceName=group[0].source_name||'External Source';
        const params=new URLSearchParams({select:'source_url',limit:'500'});
        const q=await fetch(`${base}/rest/v1/incoming_news?${params.toString()}`,{headers:h});
        if(!q.ok){const body=await q.text().catch(()=> '');throw new Error(`incoming_news lookup HTTP ${q.status}${body?`: ${body.slice(0,500)}`:''}`);}
        const existingRows=await q.json();
        const existing=new Set(existingRows.map(r=>r.source_url).filter(Boolean));
        const fresh=group.filter(x=>x.source_url&&!existing.has(x.source_url));
        skipped+=group.length-fresh.length;
        if(!fresh.length)continue;
        const payload=fresh.map(x=>({title:x.title,summary:x.summary||'',category:x.category||'News',source_name:x.source_name||'External Source',source_url:x.source_url,published_at:x.published_at,verified:false,status:'pending'}));
        const ins=await fetch(`${base}/rest/v1/incoming_news?on_conflict=source_url`,{method:'POST',headers:{...h,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(payload)});
        if(!ins.ok){
          const body=await ins.text().catch(()=> '');
          // A duplicate source URL is expected and harmless. Never surface it as a database error.
          if(ins.status===409 && /incoming_news_source_url_key|duplicate key|already exists/i.test(body)){
            skipped+=fresh.length;
            continue;
          }
          throw new Error(`incoming_news bulk insert HTTP ${ins.status}${body?`: ${body.slice(0,500)}`:''}`);
        }
        saved+=fresh.length;
      }
    }catch(e){pushError(groupKey,e);}
  }
  return {enabled:true,saved,skipped,errors,error_count:errors.length};
}
async function requireAuthenticatedUser(request,env){
  const auth=request.headers.get('authorization')||'';
  if(!auth.toLowerCase().startsWith('bearer ')) throw new Error('Authentication required');
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Server persistence is not configured');
  const r=await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/auth/v1/user`,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:auth}});
  if(!r.ok) throw new Error('Invalid or expired admin session');
  return await r.json();
}
function jsonResponse(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'Authorization, Content-Type'}});}
async function publishedNews(request,env){
  await requireAuthenticatedUser(request,env);
  const base=env.SUPABASE_URL.replace(/\/$/,'');
  const h={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`};
  const r=await fetch(`${base}/rest/v1/incoming_news?select=id,title,summary,category,source_name,source_url,image_url,published_at,created_at,status,verified&status=eq.approved&verified=eq.true&order=published_at.desc&order=created_at.desc&limit=200`,{headers:h});
  const b=await r.text();
  if(!r.ok) throw new Error(`Published news HTTP ${r.status}: ${b.slice(0,500)}`);
  return jsonResponse({ok:true,news:JSON.parse(b)});
}
function isClearlyMisfiledOpportunity(row){
  const cat=String(row?.category||'').toLowerCase().trim();
  const src=String(row?.source_name||'').toLowerCase();
  const title=String(row?.title||'').toLowerCase();
  const opportunityCategories=['grants & funding','grants','jobs','job vacancies','scholarships & education','scholarships','training & skills','government programmes','government programs','government','opportunities','business opportunities'];
  if(opportunityCategories.includes(cat)) return true;
  if(/fundsforngos|grant|scholarship|fellowship|career|job\s*(opportun|vacanc)|training\s*(opportun|programme|program)/i.test(src+' '+title)) return true;
  return false;
}
function isClearlyMisfiledNews(row){
  const cat=String(row?.category||'').toLowerCase().trim();
  const src=String(row?.source_name||row?.source||row?.provider||'').toLowerCase();
  const title=String(row?.title||'').toLowerCase();
  const newsCategories=['news','nigeria','trending news','breaking news','politics','business','technology','sports','entertainment','real estate'];
  const newsSources=/(guardian nigeria|guardian news|premium times|punch nigeria|vanguard nigeria|thisday|businessday|channels television|channels tv|daily trust|leadership nigeria|tribune online|the cable|sahara reporters|arise news|tv360 nigeria)/i;
  const opportunitySignal=/(grant|scholarship|fellowship|internship|job\b|jobs\b|career|vacancy|vacancies|training|funding|stipend|application|apply now|opportunit)/i;
  if(newsSources.test(src) && !opportunitySignal.test(title)) return true;
  if(newsCategories.includes(cat) && !opportunitySignal.test(title) && !/(grant|scholarship|fellowship|internship|vacancy|training|funding|stipend)/i.test(src)) return true;
  return false;
}
async function repairMisfiledIncomingNews(base,h,rows){
  const misfiled=(Array.isArray(rows)?rows:[]).filter(isClearlyMisfiledOpportunity);
  if(!misfiled.length) return {moved:0,errors:[]};
  let moved=0; const errors=[];
  for(const row of misfiled.slice(0,25)){
    try{
      const title=String(row.title||'').trim(); if(!title) continue;
      const lookup=await fetch(`${base}/rest/v1/opportunities?select=id&title=eq.${encodeURIComponent(title)}&limit=1`,{headers:h});
      if(!lookup.ok) throw new Error(`opportunity lookup HTTP ${lookup.status}`);
      const existing=await lookup.json();
      if(!existing.length){
        const payload={title,provider:row.source_name||'External Source',category:row.category||'Grants & Funding',location:'Nigeria',deadline:null,application_url:row.source_url||'',source:row.source_name||'External Source',description:row.summary||'External opportunity collected for admin review.',featured:false,is_active:false,approval_status:'pending',status:'Pending',published:false};
        const ins=await fetch(`${base}/rest/v1/opportunities`,{method:'POST',headers:{...h,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(payload)});
        if(!ins.ok) throw new Error(`opportunity insert HTTP ${ins.status}`);
      }
      const del=await fetch(`${base}/rest/v1/incoming_news?id=eq.${encodeURIComponent(row.id)}`,{method:'DELETE',headers:h});
      if(!del.ok) throw new Error(`incoming_news cleanup HTTP ${del.status}`);
      moved++;
    }catch(e){errors.push(`${row.title||row.id}: ${e?.message||e}`);}
  }
  return {moved,errors};
}
async function repairMisfiledOpportunities(base,h,rows){
  const misfiled=(Array.isArray(rows)?rows:[]).filter(isClearlyMisfiledNews);
  if(!misfiled.length) return {moved:0,errors:[]};
  let moved=0; const errors=[];
  for(const row of misfiled.slice(0,25)){
    try{
      const title=String(row.title||'').trim(); if(!title) continue;
      const lookup=await fetch(`${base}/rest/v1/incoming_news?select=id&title=eq.${encodeURIComponent(title)}&limit=1`,{headers:h});
      if(!lookup.ok) throw new Error(`news lookup HTTP ${lookup.status}`);
      const existing=await lookup.json();
      if(!existing.length){
        const payload={title,summary:row.description||'External news item collected for admin review.',category:row.category||'News',source_name:row.provider||row.source||'External source',source_url:row.application_url||'',published_at:row.created_at||new Date().toISOString(),verified:false,status:'pending'};
        const ins=await fetch(`${base}/rest/v1/incoming_news`,{method:'POST',headers:{...h,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(payload)});
        if(!ins.ok) throw new Error(`news insert HTTP ${ins.status}`);
      }
      const del=await fetch(`${base}/rest/v1/opportunities?id=eq.${encodeURIComponent(row.id)}`,{method:'DELETE',headers:h});
      if(!del.ok) throw new Error(`opportunities cleanup HTTP ${del.status}`);
      moved++;
    }catch(e){errors.push(`${row.title||row.id}: ${e?.message||e}`);}
  }
  return {moved,errors};
}
async function reviewQueue(request,env){
  await requireAuthenticatedUser(request,env);
  const base=env.SUPABASE_URL.replace(/\/$/,'');
  const h={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`};
  // Repair BOTH directions before returning the queues. This prevents old/misclassified
  // rows from making News and Opportunities appear mixed together.
  const n=await fetch(`${base}/rest/v1/incoming_news?select=id,title,summary,category,source_name,source_url,image_url,published_at,created_at,status,verified&verified=eq.false&order=created_at.desc&limit=200`,{headers:h});
  const nb=await n.text();
  if(!n.ok) throw new Error(`incoming_news queue HTTP ${n.status}: ${nb.slice(0,500)}`);
  const rawNews=JSON.parse(nb);
  const repairNews=await repairMisfiledIncomingNews(base,h,rawNews);

  const o=await fetch(`${base}/rest/v1/opportunities?select=id,title,category,provider,source,application_url,description,created_at,status,approval_status,is_active,published&or=(approval_status.eq.pending,status.eq.Pending)&order=created_at.desc&limit=200`,{headers:h});
  const ob=await o.text();
  if(!o.ok) throw new Error(`opportunities queue HTTP ${o.status}: ${ob.slice(0,500)}`);
  const rawOpp=JSON.parse(ob);
  const repairOpp=await repairMisfiledOpportunities(base,h,rawOpp);

  // Re-fetch after repairs so the current response is already clean.
  const n2=await fetch(`${base}/rest/v1/incoming_news?select=id,title,summary,category,source_name,source_url,image_url,published_at,created_at,status,verified&verified=eq.false&order=created_at.desc&limit=200`,{headers:h});
  const o2=await fetch(`${base}/rest/v1/opportunities?select=id,title,category,provider,source,application_url,description,created_at,status,approval_status,is_active,published&or=(approval_status.eq.pending,status.eq.Pending)&order=created_at.desc&limit=200`,{headers:h});
  const n2b=await n2.text(),o2b=await o2.text();
  if(!n2.ok) throw new Error(`incoming_news refresh HTTP ${n2.status}: ${n2b.slice(0,500)}`);
  if(!o2.ok) throw new Error(`opportunities refresh HTTP ${o2.status}: ${o2b.slice(0,500)}`);
  const newsRows=JSON.parse(n2b).filter(x=>!isClearlyMisfiledOpportunity(x));
  const oppRows=JSON.parse(o2b).filter(x=>(String(x.approval_status||'').toLowerCase()==='pending'||String(x.status||'').toLowerCase()==='pending')&&x.published!==true&&x.is_active!==true).filter(x=>!isClearlyMisfiledNews(x));
  return jsonResponse({ok:true,news:newsRows,opportunities:oppRows,repair:{movedToOpportunities:repairNews.moved,movedToNews:repairOpp.moved,errors:[...(repairNews.errors||[]),...(repairOpp.errors||[])]}});
}
async function reviewAction(request,env){
  await requireAuthenticatedUser(request,env);
  const body=await request.json().catch(()=>null); if(!body) throw new Error('Invalid request body');
  const kind=body.kind==='opportunity'?'opportunity':'news'; const id=String(body.id||''); if(!id) throw new Error('Missing draft id');
  const action=body.action; if(!['approve','reject','delete_published','edit_published'].includes(action)) throw new Error('Invalid action');
  const base=env.SUPABASE_URL.replace(/\/$/,'');
  const h={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'};
  if(kind==='news'){
    if(action==='edit_published'){
      const title=String(body.title||'').trim();
      const category=String(body.category||'News').trim()||'News';
      const summary=String(body.summary||'').trim();
      const image_url=String(body.image_url||'').trim();
      const video_url=String(body.video_url||'').trim();
      if(!title) throw new Error('Headline is required');
      if(summary.length<50) throw new Error('News brief must be at least 50 characters');
      for(const u of [image_url,video_url]) if(u && !/^https?:\/\//i.test(u)) throw new Error('Media links must start with http:// or https://');
      let storedSummary=summary.replace(/\n?\n?\[IFEKA_VIDEO\][\s\S]*?\[\/IFEKA_VIDEO\]/ig,'').replace(/\n?\n?\[IFEKA_ARTICLE_IMAGES\][\s\S]*?\[\/IFEKA_ARTICLE_IMAGES\]/ig,'').trim();
      if(video_url) storedSummary+=`\n\n[IFEKA_VIDEO]${video_url}[/IFEKA_VIDEO]`;
      const patch={title,category,summary:storedSummary};
      if(image_url) patch.image_url=image_url; else patch.image_url=null;
      const r=await fetch(`${base}/rest/v1/incoming_news?id=eq.${encodeURIComponent(id)}&status=eq.approved&verified=eq.true`,{method:'PATCH',headers:h,body:JSON.stringify(patch)});
      const b=await r.text(); if(!r.ok) throw new Error(`Published news edit HTTP ${r.status}: ${b.slice(0,500)}`);
    }else if(action==='delete_published'){
      const r=await fetch(`${base}/rest/v1/incoming_news?id=eq.${encodeURIComponent(id)}&status=eq.approved&verified=eq.true`,{method:'DELETE',headers:h});
      const b=await r.text(); if(!r.ok) throw new Error(`Published news delete HTTP ${r.status}: ${b.slice(0,500)}`);
    }else if(action==='approve'){
      const summary=String(body.summary||'').trim(); if(summary.length<50) throw new Error('A fuller original summary of at least 50 characters is required');
      const image_url=String(body.image_url||'').trim();
      const video_url=String(body.video_url||'').trim();
      const article_images=Array.isArray(body.article_images)?body.article_images.map(x=>String(x||'').trim()).filter(x=>/^https?:\/\//i.test(x)).slice(0,12):[];
      const category=String(body.category||'News').trim()||'News';
      const source_note=String(body.source_note||'').trim();
      const tags=Array.isArray(body.tags)?body.tags.map(x=>String(x||'').trim()).filter(Boolean).slice(0,20):[];
      const editor_notes=String(body.editor_notes||'').trim();
      const seo_description=String(body.seo_description||'').trim().slice(0,160);
      const media_source=String(body.media_source||'').trim();
      const media_rights_status=String(body.media_rights_status||'Not Checked').trim()||'Not Checked';
      const originality_checked=body.originality_checked===true;
      let storedSummary=summary;
      if(video_url) storedSummary+=`\n\n[IFEKA_VIDEO]${video_url}[/IFEKA_VIDEO]`;
      if(article_images.length) storedSummary+=`\n\n[IFEKA_ARTICLE_IMAGES]\n${article_images.join('\n')}\n[/IFEKA_ARTICLE_IMAGES]`;
      const existingRes=await fetch(`${base}/rest/v1/incoming_news?id=eq.${encodeURIComponent(id)}&select=id,title,source_name,source_url,created_at`,{headers:h});
      const existingBody=await existingRes.text(); if(!existingRes.ok) throw new Error(`News source lookup HTTP ${existingRes.status}: ${existingBody.slice(0,500)}`);
      const existingRows=JSON.parse(existingBody); const original=existingRows?.[0]; if(!original) throw new Error('News draft was not found');
      const patch={summary:storedSummary,verified:true,status:'approved'};
      if(image_url) patch.image_url=image_url;
      const r=await fetch(`${base}/rest/v1/incoming_news?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:h,body:JSON.stringify(patch)});
      const b=await r.text(); if(!r.ok) throw new Error(`News approval HTTP ${r.status}: ${b.slice(0,500)}`);
      const cleanSummary=summary.replace(/\s+/g,' ').trim();
      const blogRow={title:String(body.title||original.title||'').trim()||original.title,content:storedSummary,image_url:image_url||null,video_url:video_url||null,category,author:'Ifeka',published:true,source_name:original.source_name||'External source',source_url:original.source_url||null,editor_summary:cleanSummary.slice(0,500),editor_notes:editor_notes||source_note||null,seo_description:seo_description||cleanSummary.slice(0,155),tags:tags.length?tags:null,editorial_status:'Approved',media_source:media_source||null,media_rights_status,originality_checked};
      const blogRes=await fetch(`${base}/rest/v1/blog_posts`,{method:'POST',headers:{...h,Prefer:'return=minimal'},body:JSON.stringify(blogRow)});
      const blogBody=await blogRes.text(); if(!blogRes.ok) throw new Error(`Editorial post save HTTP ${blogRes.status}: ${blogBody.slice(0,500)}`);
      const del=await fetch(`${base}/rest/v1/incoming_news?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:h});
      const delBody=await del.text(); if(!del.ok) throw new Error(`News draft cleanup HTTP ${del.status}: ${delBody.slice(0,500)}`);
    }else{
      const r=await fetch(`${base}/rest/v1/incoming_news?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:h});
      const b=await r.text(); if(!r.ok) throw new Error(`News rejection HTTP ${r.status}: ${b.slice(0,500)}`);
    }
  }else{
    if(action==='edit_published'){
      const title=String(body.title||'').trim();
      const category=String(body.category||'News').trim()||'News';
      const content=String(body.content||'').trim();
      const author=String(body.author||'Ifeka').trim()||'Ifeka';
      const image_url=String(body.image_url||'').trim();
      const video_url=String(body.video_url||'').trim();
      if(!title||!content) throw new Error('Headline and news content are required');
      for(const u of [image_url,video_url]) if(u && !/^https?:\/\//i.test(u)) throw new Error('Media links must start with http:// or https://');
      const patch={title,category,content,author,image_url:image_url||null,video_url:video_url||null};
      const r=await fetch(`${base}/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}&published=eq.true`,{method:'PATCH',headers:h,body:JSON.stringify(patch)});
      const b=await r.text(); if(!r.ok) throw new Error(`Published post edit HTTP ${r.status}: ${b.slice(0,500)}`);
    }else{
    const patch=action==='approve'?{approval_status:'approved',is_active:true,status:'Active',published:true}:null;
    const r=await fetch(`${base}/rest/v1/opportunities?id=eq.${encodeURIComponent(id)}`,{method:patch?'PATCH':'DELETE',headers:h,...(patch?{body:JSON.stringify(patch)}:{})});
    const b=await r.text(); if(!r.ok) throw new Error(`Opportunity ${action} HTTP ${r.status}: ${b.slice(0,500)}`);
    }
  }
  return jsonResponse({ok:true,action,kind,id});
}


function htmlToSourceFacts(html){
  const decodeHtml=(v='')=>String(v).replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
  const strip=(v='')=>decodeHtml(v).replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<noscript\b[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const clean=(v='')=>strip(v).replace(/\s+/g,' ').trim();
  const facts=[];
  const add=(v)=>{const x=clean(v);if(x&&x.length>35)facts.push(x);};

  // Structured data is usually the richest and cleanest article text.
  const ld=[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for(const m of ld){
    try{
      const data=JSON.parse(m[1].trim());
      const stack=Array.isArray(data)?data:[data];
      const graph=[]; for(const x of stack){ if(x&&Array.isArray(x['@graph'])) graph.push(...x['@graph']); }
      for(const x of stack.concat(graph)){
        if(!x||typeof x!=='object')continue;
        if(x.articleBody)add(x.articleBody);
        if(x.headline)add(x.headline);
        if(x.description)add(x.description);
      }
    }catch(e){}
  }

  // Prefer common article containers before falling back to the whole page.
  const containers=[];
  const selectors=[
    /<article\b[^>]*>([\s\S]*?)<\/article>/gi,
    /<main\b[^>]*>([\s\S]*?)<\/main>/gi,
    /<div\b[^>]*(?:class|id)=["'][^"']*(?:entry-content|post-content|article-content|article-body|story-content|single-post|td-post-content|content-area)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi
  ];
  for(const re of selectors){for(const m of html.matchAll(re)){if(m[1]&&m[1].length>200)containers.push(m[1]);}}
  const best=containers.sort((a,b)=>b.length-a.length)[0]||html;
  const paras=[...best.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>clean(m[1])).filter(x=>x.length>35);
  for(const x of paras)add(x);
  if(paras.length<3)add(best);

  // Useful metadata when the page has little visible HTML text.
  for(const m of html.matchAll(/<meta\b[^>]*(?:property|name)=["'](?:og:title|twitter:title|title|description|og:description|twitter:description)["'][^>]*content=["']([^"']+)["'][^>]*>/gi)) add(m[1]);
  for(const m of html.matchAll(/<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:title|twitter:title|description|og:description|twitter:description)["'][^>]*>/gi)) add(m[1]);

  const out=[]; const seen=new Set(); let total=0;
  for(const x of facts){
    const k=x.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim().slice(0,220);
    if(!k||seen.has(k))continue; seen.add(k);
    if(total+x.length>12000)break;
    out.push(x); total+=x.length;
  }
  return out.join('\n\n').slice(0,12000);
}
function cleanSourceFallback(v){
  return String(v||'').replace(/https?:\/\/\S+/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'\"').replace(/&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim().slice(0,12000);
}


function absoluteMediaUrl(value, baseUrl){
  try{
    const raw=String(value||'').trim();
    if(!raw||raw.startsWith('data:')||raw.startsWith('javascript:')) return '';
    return new URL(raw,baseUrl).toString();
  }catch(e){return '';}
}
function htmlAttr(tag,name){
  const re=new RegExp(name+"\\s*=\\s*[\"\']([^\"\']+)[\"\']",'i');
  const m=String(tag||'').match(re); return m?m[1]:'';
}
function extractMediaFromHtml(html,sourceUrl){
  const text=String(html||''); const images=[],videos=[];
  const add=(arr,v)=>{v=absoluteMediaUrl(v,sourceUrl); if(v && !arr.includes(v)) arr.push(v);};
  const metaRe=/<meta\b[^>]*>/gi; let m;
  while((m=metaRe.exec(text))){
    const tag=m[0], prop=(htmlAttr(tag,'property')||htmlAttr(tag,'name')||htmlAttr(tag,'itemprop')).toLowerCase(), content=htmlAttr(tag,'content');
    if(!content) continue;
    if(['og:image','og:image:url','twitter:image','twitter:image:src','image'].includes(prop)) add(images,content);
    if(['og:video','og:video:url','og:video:secure_url','twitter:player:stream','video'].includes(prop)) add(videos,content);
  }
  // JSON-LD image/video fields.
  const ldRe=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while((m=ldRe.exec(text))){
    try{
      const data=JSON.parse(m[1].trim()); const stack=Array.isArray(data)?data:[data];
      const walk=(x)=>{ if(!x||typeof x!=='object') return; if(Array.isArray(x)){x.forEach(walk);return;}
        if(x.image){const a=Array.isArray(x.image)?x.image:[x.image];a.forEach(v=>add(images,typeof v==='string'?v:v?.url));}
        if(x.video){const a=Array.isArray(x.video)?x.video:[x.video];a.forEach(v=>add(videos,typeof v==='string'?v:(v?.contentUrl||v?.embedUrl)));}
        Object.values(x).forEach(v=>{if(v&&typeof v==='object')walk(v);});
      }; stack.forEach(walk);
    }catch(e){}
  }
  // Common HTML media tags and embedded players.
  const imgRe=/<img\b[^>]*>/gi; while((m=imgRe.exec(text))){ const tag=m[0]; add(images,htmlAttr(tag,'src')||htmlAttr(tag,'data-src')||htmlAttr(tag,'data-lazy-src')); }
  const sourceRe=/<source\b[^>]*>/gi; while((m=sourceRe.exec(text))){ add(videos,htmlAttr(m[0],'src')||htmlAttr(m[0],'data-src')); }
  const videoRe=/<video\b[^>]*>/gi; while((m=videoRe.exec(text))){ add(videos,htmlAttr(m[0],'src')||htmlAttr(m[0],'data-src')); }
  const iframeRe=/<iframe\b[^>]*>/gi; while((m=iframeRe.exec(text))){ const u=htmlAttr(m[0],'src'); if(/youtube(?:-nocookie)?\.com|youtu\.be|vimeo\.com|facebook\.com/i.test(u)) add(videos,u); }
  return {images:images.slice(0,12),videos:videos.slice(0,12)};
}
async function sourceMedia(request,env){
  await requireAuthenticatedUser(request,env);
  const body=await request.json().catch(()=>({})); const sourceUrl=String(body.url||'').trim();
  if(!/^https?:\/\//i.test(sourceUrl)) throw new Error('A valid source URL is required');
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const r=await fetch(sourceUrl,{redirect:'follow',signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; IfekaHubMediaFetcher/1.0)'}});
    const html=await r.text();
    if(!r.ok) throw new Error(`Source returned HTTP ${r.status}`);
    const media=extractMediaFromHtml(html,sourceUrl);
    return jsonResponse({ok:true,...media,source_url:sourceUrl,partial:!media.images.length&&!media.videos.length});
  }finally{clearTimeout(timer);}
}

async function sourceFacts(request,env){
  await requireAuthenticatedUser(request,env);
  const body=await request.json().catch(()=>null); if(!body) throw new Error('Invalid request body');
  const target=String(body.url||'').trim();
  if(!/^https?:\/\//i.test(target)) throw new Error('A valid http(s) source URL is required');
  const u=new URL(target); if(!['http:','https:'].includes(u.protocol)) throw new Error('Invalid source URL');
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);
  try{
    const r=await fetch(target,{signal:c.signal,redirect:'follow',headers:{accept:'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.7,*/*;q=0.5','user-agent':'Mozilla/5.0 (compatible; IfekaHub Editorial Bot/1.1)'}});
    if(!r.ok) throw new Error(`Source returned HTTP ${r.status}`);
    const html=await r.text();
    let facts=htmlToSourceFacts(html);
    // Some publishers return only a shell/metadata to automated requests.
    // Preserve a caller-provided RSS/source summary as a factual fallback,
    // and explicitly report when the full article could not be fetched.
    const fallback=cleanSourceFallback(body.fallbackText||'');
    if(facts.length<600 && fallback.length>facts.length) facts=fallback;
    if(!facts) throw new Error('No readable article facts were found. The publisher may block automated access or load the article dynamically. Paste the verified source text/summary into the editor and build from that.');
    const paragraphs=facts.split(/\n\n+/).filter(Boolean);
    return jsonResponse({ok:true,facts,paragraphs:paragraphs.length,characters:facts.length,partial:facts.length<900,source_access:'fetched'});
  }catch(e){throw new Error(e?.name==='AbortError'?'Source request timed out':(e?.message||String(e)));}
  finally{clearTimeout(timer);}
}

async function submitOpportunity(request,env){
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Server persistence is not configured');
  let body={};
  try{body=await request.json();}catch(e){throw new Error('Invalid submission data');}
  const clean=(v,max=2000)=>String(v??'').trim().slice(0,max);
  const title=clean(body.title,220), provider=clean(body.provider,180), description=clean(body.description,4000);
  const application_url=clean(body.application_url,1000), submitter_contact=clean(body.submitter_contact,120);
  const category=clean(body.category,80)||'job';
  if(!title||!provider||!description||!application_url||!submitter_contact) throw new Error('Please complete the required opportunity fields.');
  const allowed=['job','grant','scholarship','funding','training','sports','entertainment','business'];
  if(!allowed.includes(category)) throw new Error('Invalid opportunity category.');
  const row={
    title,provider,category,location:clean(body.location,180),deadline:body.deadline?clean(body.deadline,20):null,
    application_url,description,source:provider,featured:false,is_active:false,approval_status:'pending',status:'Pending',published:false,
    promotion_status:clean(body.promotion_status,40)||'none',promotion_plan:clean(body.promotion_plan,40)||'free',submitter_contact,
    work_mode:clean(body.work_mode,80),salary:clean(body.salary,120),requirements:clean(body.requirements||body.qualification,1200)
  };
  const base=env.SUPABASE_URL.replace(/\/$/,'');
  const h={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'return=representation'};
  const r=await fetch(`${base}/rest/v1/opportunities`,{method:'POST',headers:h,body:JSON.stringify(row)});
  const text=await r.text();
  if(!r.ok) throw new Error(`Opportunity submission HTTP ${r.status}: ${text.slice(0,500)}`);
  let data=[];try{data=JSON.parse(text)||[]}catch(e){}
  return jsonResponse({ok:true,id:data?.[0]?.id||null,message:'Opportunity submitted for review.'});
}

async function removeTestOpportunities(request,env){
  await requireAuthenticatedUser(request,env);
  const base=env.SUPABASE_URL.replace(/\/$/,'');
  const h={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,Prefer:'return=representation'};
  const titles=['Administrative Officer','Marketing & Business Development Opportunity'];
  const params=new URLSearchParams({title:`in.(${titles.map(t=>`"${t.replace(/"/g,'\\"')}"`).join(',')})`});
  const r=await fetch(`${base}/rest/v1/opportunities?${params.toString()}`,{method:'DELETE',headers:h});
  const b=await r.text();
  if(!r.ok)throw new Error(`Test opportunity cleanup HTTP ${r.status}: ${b.slice(0,500)}`);
  let rows=[]; try{rows=JSON.parse(b)||[]}catch(e){}
  return jsonResponse({ok:true,deleted:rows.length,titles});
}


async function sitemapXml(env){
  const baseSite='https://ifekahub.com';
  const urls=[{loc:baseSite+'/',lastmod:new Date().toISOString().slice(0,10)}];
  if(env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY){
    try{
      const base=env.SUPABASE_URL.replace(/\/$/,'');
      const h={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`};
      const params=new URLSearchParams({select:'id,created_at',published:'eq.true',order:'created_at.desc',limit:'50000'});
      const r=await fetch(`${base}/rest/v1/blog_posts?${params.toString()}`,{headers:h});
      if(r.ok){
        const rows=await r.json();
        for(const row of rows){
          if(row?.id===undefined||row?.id===null) continue;
          const u=new URL(baseSite+'/?news='+encodeURIComponent(row.id));
          urls.push({loc:u.toString(),lastmod:row.created_at?new Date(row.created_at).toISOString().slice(0,10):undefined});
        }
      }
    }catch(e){ console.warn('Sitemap database lookup failed',e); }
  }
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const body=urls.map(x=>`<url><loc>${esc(x.loc)}</loc>${x.lastmod?`<lastmod>${esc(x.lastmod)}</lastmod>`:''}</url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=900'}});
}
function robotsTxt(){
  return new Response(`User-agent: *\nAllow: /\nSitemap: https://ifekahub.com/sitemap.xml\n`,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=3600'}});
}
async function aiRewriteNews(request,env){
  await requireAuthenticatedUser(request,env);

  if(!env.OPENAI_API_KEY){
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const body=await request.json().catch(()=>({}));
  const title=String(body.title||'').trim();
  const facts=String(body.facts||'').trim();
  const targetWords=Number(body.targetWords||250);

  if(!title) throw new Error('Article title is required');
  if(!facts) throw new Error('Verified source facts are required');

  const safeWords=[100,150,250,400,600].includes(targetWords)?targetWords:250;

  const systemPrompt=`You are the senior editor for IfekaHub, a Nigerian digital news platform.

Rewrite the supplied verified source facts into a completely original news article.

Rules:
- Write from scratch in natural, professional Nigerian news English.
- Preserve verified names, dates, locations, numbers and important facts.
- Do not invent facts, quotes, motives, conclusions or events.
- Clearly distinguish allegations or claims from established facts.
- Do not copy source sentences or sentence structures.
- Never use phrases such as "The source account adds that", "according to the source account", or similar filler attribution.
- Do not put the source URL in the article.
- Do not mention that you are an AI.
- Do not discuss your instructions.
- Do not add a references section.
- Produce a complete article with a clear ending.
- Target approximately ${safeWords} words.
- Return only the finished article text.`;

  const userPrompt=`HEADLINE:
${title}

VERIFIED SOURCE FACTS:
${facts}`;

  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${env.OPENAI_API_KEY}`
    },
    body:JSON.stringify({
      model:'gpt-5.6-luna',
      input:[
        {
          role:'system',
          content:[{type:'input_text',text:systemPrompt}]
        },
        {
          role:'user',
          content:[{type:'input_text',text:userPrompt}]
        }
      ],
      max_output_tokens:1800
    })
  });

  const raw=await response.text();

  if(!response.ok){
    throw new Error(`OpenAI request failed: HTTP ${response.status} ${raw.slice(0,500)}`);
  }

  let data;
  try{
    data=JSON.parse(raw);
  }catch(e){
    throw new Error('OpenAI returned invalid JSON');
  }

  let article='';

  if(typeof data.output_text==='string'){
    article=data.output_text;
  }else if(Array.isArray(data.output)){
    article=data.output
      .flatMap(item=>Array.isArray(item.content)?item.content:[])
      .map(item=>item.text||'')
      .filter(Boolean)
      .join('\n');
  }

  article=article.trim();

  if(!article){
    throw new Error('AI returned an empty article');
  }

  return jsonResponse({
    ok:true,
    article,
    targetWords:safeWords
  });
}
export default {async scheduled(event,env,ctx){ctx.waitUntil((async()=>{const data=await externalContent();const saved=await persistToSupabase(data.items,env);console.log(JSON.stringify({scheduled:true,checked:data.items.length,saved:saved.saved,errors:saved.errors?.length||0,enabled:saved.enabled}));})().catch(e=>console.warn('Scheduled collector failed',e)));},async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==='OPTIONS' && (url.pathname.startsWith('/api/review-')||url.pathname==='/api/external-content'||url.pathname==='/api/source-facts'||url.pathname==='/api/source-media'||url.pathname==='/api/submit-opportunity')) return jsonResponse({ok:true},204);
  try{
    if(url.pathname==='/api/submit-opportunity' && request.method==='POST') return await submitOpportunity(request,env);
    if(url.pathname==='/api/external-content'){
      const data=await externalContent();
      const persist=url.searchParams.get('persist')==='1'?await persistToSupabase(data.items,env):{enabled:false,saved:0};
      return jsonResponse({...data,persist});
    }
    if(url.pathname==='/api/published-news' && request.method==='GET') return await publishedNews(request,env);
    if(url.pathname==='/api/review-queue' && request.method==='GET') return await reviewQueue(request,env);
    if(url.pathname==='/api/review-action' && request.method==='POST') return await reviewAction(request,env);
    if(url.pathname==='/api/ai-rewrite-news' && request.method==='POST') return await aiRewriteNews(request,env);
    if(url.pathname==='/api/source-facts' && request.method==='POST') return await sourceFacts(request,env);

    if(url.pathname==='/api/source-media' && request.method==='POST') return await sourceMedia(request,env);
    if(url.pathname==='/sitemap.xml' && request.method==='GET') return await sitemapXml(env);
    if(url.pathname==='/robots.txt' && request.method==='GET') return robotsTxt();
    if(url.pathname==='/api/remove-test-opportunities' && request.method==='POST') return await removeTestOpportunities(request,env);
    return env.ASSETS.fetch(request);
  }catch(e){return jsonResponse({ok:false,error:String(e?.message||e)}, e?.message==='Authentication required'||String(e?.message||'').includes('Invalid or expired')?401:400);}
}};
