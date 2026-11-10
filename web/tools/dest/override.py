import sys,json,io,re
sys.argv=[sys.argv[0]]+sys.argv[1:]
from build import get,clean,Image,urllib
k,f=sys.argv[1],sys.argv[2]
ii=get("https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1100&titles=File:"+urllib.parse.quote(f))["query"]["pages"][0]["imageinfo"][0]
md=ii["extmetadata"]; lic=md["LicenseShortName"]["value"]; assert re.search(r"CC|Public domain|PD|GFDL|FAL",lic,re.I),lic
im=Image.open(io.BytesIO(get(ii["thumburl"],raw=True))).convert("RGB"); w,h=im.size; th=w*9/16
if th<=h: t=int((h-th)*0.5); im=im.crop((0,t,w,int(t+th)))
else: nw=int(h*16/9); l=(w-nw)//2; im=im.crop((l,0,l+nw,h))
im=im.resize((800,450),Image.LANCZOS); col=im.resize((1,1),Image.BOX).getpixel((0,0))
for q in (58,50,42,34):
  b=io.BytesIO(); im.save(b,"WEBP",quality=q,method=6)
  if b.tell()<70000: break
open(f"/tmp/cw/img/{k}.webp","wb").write(b.getvalue())
o=json.load(open("out.json")); o[k]["img"]={"file":f.replace(" ","_"),"page":ii.get("descriptionurl"),"lic":lic,"by":clean(md.get("Artist",{}).get("value",""))[:120],"col":"#%02x%02x%02x"%col}
json.dump(o,open("out.json","w"),ensure_ascii=False); print(k,lic,o[k]["img"]["by"],b.tell())
