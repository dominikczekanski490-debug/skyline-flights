"""Re-render every bundled hero from the Commons file already recorded in web/public/dest/index.json (no Wikipedia discovery).
python3 rebuild.py [IATA...]  -> writes /tmp/cw/img2/<IATA>.webp and /tmp/cw/rebuild.json ({iata: {ok, col, size, kb} | {err}}).
python3 rebuild.py --apply     -> copies successful renders into public/dest and updates img.col in index.json; failures keep the old photo."""
import json,os,re,sys,time,io,urllib.parse
sys.path.insert(0,os.path.dirname(__file__))
from build import get,Image
import img as R
D=os.path.join(os.path.dirname(__file__),"../../public/dest"); IDX=f"{D}/index.json"; OUT="/tmp/cw/img2"; LOG="/tmp/cw/rebuild.json"
os.makedirs(OUT,exist_ok=True)
LIC=re.compile(r"CC|Public domain|PD|GFDL|FAL",re.I)
def info(f):
  p=get("https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=%d&titles=File:%s"%(R.THUMB,urllib.parse.quote(f)))["query"]["pages"][0]
  return p["imageinfo"][0]
def one(k,i):
  ii=info(i["file"]); lic=(ii.get("extmetadata",{}).get("LicenseShortName") or {}).get("value","")
  if not LIC.search(lic): raise Exception("licence now "+lic)
  im=Image.open(io.BytesIO(get(R.pick_url(ii),raw=True)))
  b,col,sz=R.render(im,i.get("fy",0.45),i.get("fx",0.5),i.get("z",1.0)); open(f"{OUT}/{k}.webp","wb").write(b)
  return {"ok":1,"file":i["file"],"col":col,"size":sz,"kb":len(b)//1024,"src":[ii.get("width"),ii.get("height")]}
if __name__=="__main__":
  idx=json.load(open(IDX)); log=json.load(open(LOG)) if os.path.exists(LOG) else {}
  if sys.argv[1:2]==["--apply"]:
    n=0
    for k,r in log.items():
      if r.get("ok") and k in idx and idx[k].get("img") and r.get("file")==idx[k]["img"]["file"] and os.path.exists(f"{OUT}/{k}.webp"):  # skip photos swapped since
        os.replace(f"{OUT}/{k}.webp",f"{D}/{k}.webp"); idx[k]["img"]["col"]=r["col"]; n+=1
    json.dump(idx,open(IDX,"w"),ensure_ascii=False,separators=(",",":")); print("applied",n,"failed",[k for k,r in log.items() if not r.get("ok")]); sys.exit()
  todo=sys.argv[1:] or [k for k,v in sorted(idx.items()) if v.get("img")]
  for k in todo:
    try: log[k]=one(k,idx[k]["img"])
    except Exception as e: log[k]={"err":str(e)[:160]}
    print(k,log[k],flush=True); json.dump(log,open(LOG,"w"),indent=0); time.sleep(0.4)
