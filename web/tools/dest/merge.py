import json,csv,shutil,os,html
out=json.load(open('/tmp/cw/out.json')); tz={}
for r in csv.reader(open('/workspace/skyline/server/data/airports.dat',encoding='utf8')):
  if len(r)>11 and r[4] and r[4]!='\\N': tz[r[4]]=r[11]
D='/workspace/skyline/web/public/dest'; os.makedirs(D,exist_ok=True)
import sys; sys.path.insert(0,os.path.dirname(__file__)); import attr
# Safety: never drop a destination that is already bundled just because this discovery run missed it.
idx=json.load(open(f'{D}/index.json')) if os.path.exists(f'{D}/index.json') else {}; att=[]
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
  elif k in idx and idx[k].get('img'): v['img']=idx[k]['img']  # keep the existing photo if this run's fetch failed
  else: v.pop('img',None)
  idx[k]=v
json.dump(idx,open(f'{D}/index.json','w'),ensure_ascii=False,separators=(',',':'))
attr.write(idx)
n=sum(1 for v in idx.values() if v.get('img')); print(len(idx),'entries',n,'photos',sum(1 for v in idx.values() if v.get('climate')),'climate', sum(os.path.getsize(f'{D}/{k}.webp') for k,v in idx.items() if v.get('img'))//1024,'KB')
