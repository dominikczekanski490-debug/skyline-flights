"""Swap one destination's hero photo by hand for a better Commons file of the same place.
python3 override.py IATA "Commons file.jpg" [fy] [fx] [z]
  fy/fx: where to crop within the spare room (0 = top/left, 1 = bottom/right; default 0.45 / 0.5).
  z: tighter 4:3 window, as a fraction of the largest (default 1); e.g. 0.75 with fy 0.9 to trade empty sky for land.
Checks the licence (CC / Public domain / PD / GFDL / FAL only), renders with img.py (4:3 1600x1200 WebP), writes
web/public/dest/<IATA>.webp, updates index.json (file, page, licence, author, colour) and regenerates ATTRIBUTION.md.
--build: legacy mode for the discovery pipeline (writes /tmp/cw/img + out.json for merge.py instead)."""
import sys,json,io,re,os,urllib.parse
sys.path.insert(0,os.path.dirname(__file__))
from build import get,clean,Image,BAD
import img as R
legacy="--build" in sys.argv; a=[x for x in sys.argv[1:] if x!="--build"]
k,f=a[0],a[1].replace(" ","_"); fy=float(a[2]) if len(a)>2 else 0.45; fx=float(a[3]) if len(a)>3 else 0.5; z=float(a[4]) if len(a)>4 else 1.0
assert not BAD.search(f),"flag/map/logo-like filename: "+f
ii=get("https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=%d&titles=File:%s"%(R.THUMB,urllib.parse.quote(f)))["query"]["pages"][0]["imageinfo"][0]
md=ii["extmetadata"]; lic=md["LicenseShortName"]["value"]; assert re.search(r"CC|Public domain|PD|GFDL|FAL",lic,re.I),lic
assert not re.search(r"NC|ND",lic),lic
b,col,sz=R.render(Image.open(io.BytesIO(get(R.pick_url(ii),raw=True))),fy,fx,z)
img={"file":f,"page":ii.get("descriptionurl"),"lic":lic,"by":clean(md.get("Artist",{}).get("value",""))[:120] or "see file page","col":col}
if fy!=0.45: img["fy"]=fy
if fx!=0.5: img["fx"]=fx
if z!=1.0: img["z"]=z
if legacy:
  open(f"/tmp/cw/img/{k}.webp","wb").write(b); o=json.load(open("/tmp/cw/out.json")); o[k]["img"]=img; json.dump(o,open("/tmp/cw/out.json","w"),ensure_ascii=False)
else:
  D=os.path.join(os.path.dirname(__file__),"../../public/dest"); idx=json.load(open(f"{D}/index.json")); assert k in idx,k
  old=(idx[k].get("img") or {}).get("file"); open(f"{D}/{k}.webp","wb").write(b); idx[k]["img"]=img
  json.dump(idx,open(f"{D}/index.json","w"),ensure_ascii=False,separators=(",",":"))
  import attr; attr.write(idx)
  open("/tmp/cw/swaps.log","a").write(json.dumps({"iata":k,"old":old,"new":f,"lic":lic,"by":img["by"],"kb":len(b)//1024,"size":sz},ensure_ascii=False)+"\n")
print(k,lic,img["by"],len(b)//1024,"KB",sz)
