import json,csv,shutil,os,html
out=json.load(open('/tmp/cw/out.json')); tz={}
for r in csv.reader(open('/workspace/skyline/server/data/airports.dat',encoding='utf8')):
  if len(r)>11 and r[4] and r[4]!='\\N': tz[r[4]]=r[11]
D='/workspace/skyline/web/public/dest'; os.makedirs(D,exist_ok=True)
idx={}; att=["# Destination photos and facts (Clearway skin)","","Hero photos are lead images of the destination's English Wikipedia article, hosted on Wikimedia Commons, resized to 800×450 WebP (cropped to 16:9).","Descriptions: English Wikipedia intro (CC BY-SA 4.0). Language/currency/tags: Wikidata (CC0). Monthly temperatures: the article's Wikipedia climate table (\"Weather box\").","Each place was accepted only if the Wikipedia article's coordinates lie within 80 km of the airport.","","| Airport | Place | Photo (Commons file) | Author | Licence |","|---|---|---|---|---|"]
for k,v in sorted(out.items()):
  if v.get('miss') or v.get('err') or not v.get('title'): continue
  v=dict(v); import re
  if v.get('desc'):
    d=v['desc']
    for _ in range(3): d=re.sub(r"\s*\((?:[^()]|\([^()]*\))*?(?:UK:|US:|\[|pronounced|listen|lit\.|;\s)(?:[^()]|\([^()]*\))*\)","",d)
    v['desc']=re.sub(r"\s+([,.;])",r"\1",re.sub(r"\s{2,}"," ",d)).strip()
  v.pop('imgPick',None); v.pop('imgErr',None); v.pop('km',None); v.pop('qid',None); v['tz']=tz.get(k)
  if v.get('img') and os.path.exists(f'/tmp/cw/img/{k}.webp'):
    shutil.copy(f'/tmp/cw/img/{k}.webp',f'{D}/{k}.webp'); v['img'].pop('kb',None)
    i=v['img']; att.append(f"| {k} | {v['name']} | [{i['file']}]({i.get('page','')}) | {(i.get('by') or 'see file page').replace('|','/')} | {i['lic']} |")
  else: v.pop('img',None)
  idx[k]=v
json.dump(idx,open(f'{D}/index.json','w'),ensure_ascii=False,separators=(',',':'))
open(f'{D}/ATTRIBUTION.md','w').write("\n".join(att)+"\n")
n=sum(1 for v in idx.values() if v.get('img')); print(len(idx),'entries',n,'photos',sum(1 for v in idx.values() if v.get('climate')),'climate', sum(os.path.getsize(f'{D}/{k}.webp') for k,v in idx.items() if v.get('img'))//1024,'KB')
