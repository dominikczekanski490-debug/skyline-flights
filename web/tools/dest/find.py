import sys,os,json,re,io,urllib.parse,time,math
sys.path.insert(0,'/workspace/skyline/web/tools/dest')
from build import get,clean,BAD,hav
from PIL import Image,ImageDraw,ImageFont
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',13)
idx=json.load(open('/workspace/skyline/web/public/dest/index.json'))
LIC=re.compile(r"CC|Public domain|PD|GFDL|FAL",re.I)
def search(q,n=30):
  r=get("https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&list=search&srnamespace=6&srlimit=%d&srsearch=%s"%(n,urllib.parse.quote(q)))
  return [x["title"] for x in r["query"]["search"]]
def infos(titles):
  out={}
  for i in range(0,len(titles),20):
    r=get("https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=480&titles="+urllib.parse.quote("|".join(titles[i:i+20])))
    for p in r["query"]["pages"]:
      if p.get("imageinfo"): out[p["title"]]=p["imageinfo"][0]
  return out
k=sys.argv[1]; qs=sys.argv[2:]; d=idx[k]; lat,lon=d["lat"],d["lon"]
titles=[]
for q in qs:
  for extra in (' incategory:Quality_images',' filew:>2400'):
    try: titles+= search(q+extra+' filetype:bitmap')
    except Exception as e: print('search err',e)
titles=list(dict.fromkeys(t for t in titles if re.search(r'\.jpe?g$',t,re.I) and not BAD.search(t)))
I=infos(titles); C=[]
for t,ii in I.items():
  md=ii.get('extmetadata',{}); lic=(md.get('LicenseShortName') or {}).get('value','')
  if not LIC.search(lic): continue
  if (ii.get('width') or 0)<1800: continue
  if ii['width']/ii['height']<1.0: continue  # portrait crops badly to 4:3 heroes
  g=None
  try: g=round(hav(lat,lon,float(md['GPSLatitude']['value']),float(md['GPSLongitude']['value'])))
  except Exception: pass
  if g is not None and g>80: continue
  C.append(dict(t=t[5:],lic=lic,by=clean((md.get('Artist') or {}).get('value',''))[:80],w=ii['width'],h=ii['height'],km=g,th=ii.get('thumburl'),qi='Quality' in (md.get('Categories') or {}).get('value','')))
C=C[:24]
json.dump(C,open(f'/tmp/cw/cand/{k}.json','w'),ensure_ascii=False,indent=0)
T=(300,200);cols=4;rows=(len(C)+cols-1)//cols or 1
sh=Image.new('RGB',(cols*T[0],rows*(T[1]+34)),'white');dr=ImageDraw.Draw(sh)
for i,c in enumerate(C):
  try: im=Image.open(io.BytesIO(get(c['th'],raw=True))).convert('RGB'); im.thumbnail(T)
  except Exception: continue
  x=(i%cols)*T[0];y=(i//cols)*(T[1]+34); sh.paste(im,(x,y+34))
  dr.text((x+2,y+1),f"{i} {c['w']}x{c['h']} {c['km']}km {c['lic'][:12]}",fill='black',font=F); dr.text((x+2,y+17),c['t'][:40],fill='#333',font=F)
  time.sleep(0.1)
sh.save(f'/tmp/cw/cand/{k}.png'); print(k,len(C))
