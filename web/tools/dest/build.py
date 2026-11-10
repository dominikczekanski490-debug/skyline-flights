import json,re,math,io,sys,time,html,urllib.parse,urllib.request,concurrent.futures as cf
from PIL import Image
UA={"User-Agent":"SkylineDestGuide/1.0 (https://skyline-flights.onrender.com; dominikczekanski490@gmail.com)"}
def get(url,raw=False):
  for i in range(4):
    try:
      r=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=40).read()
      return r if raw else json.loads(r)
    except Exception as e:
      if i==3: raise
      time.sleep(2+3*i)
W="https://en.wikipedia.org/w/api.php?format=json&formatversion=2&"
ISL={"TLL":"Tallinn","JFK":"New York City","EWR":"Newark, New Jersey","NCL":"Newcastle upon Tyne","SID":"Sal, Cape Verde","NBE":"Hammamet","MLB":"Melbourne, Florida","NQY":"Newquay","FKB":"Baden-Baden","IAD":"Washington, D.C.","PDX":"Portland, Oregon","RDU":"Raleigh, North Carolina","GND":"Grenada","TAS":"Tashkent","ALG":"Algiers","GCI":"St Peter Port","DXB":"Dubai","LUX":"Luxembourg City","HHN":"Hahn","GOX":"Goa","ACE":"Lanzarote","FUE":"Fuerteventura","TFS":"Tenerife","TFN":"Tenerife","LPA":"Gran Canaria","PMI":"Mallorca","IBZ":"Ibiza","MAH":"Menorca","CFU":"Corfu","ZTH":"Zakynthos","RHO":"Rhodes","HER":"Heraklion","CHQ":"Chania","KGS":"Kos","JTR":"Santorini","JMK":"Mykonos","EFL":"Kefalonia","JSI":"Skiathos","FNC":"Madeira","FAO":"Faro","PFO":"Paphos","LCA":"Larnaca","MLA":"Malta","SPU":"Split","DBV":"Dubrovnik","OLB":"Olbia","CAG":"Cagliari","PMO":"Palermo","CTA":"Catania","AYT":"Antalya","DLM":"Dalaman","BJV":"Bodrum","SSH":"Sharm El Sheikh","HRG":"Hurghada","RAK":"Marrakesh","AGA":"Agadir","BOJ":"Burgas","VAR":"Varna","TIV":"Tivat","PVK":"Preveza","KLX":"Kalamata","NAP":"Naples","BCN":"Barcelona","AGP":"Málaga","ALC":"Alicante"}
BAD=re.compile(r"\.svg$|flag|map|locator|location|coat_of_arms|coa_|logo|seal|emblem|wappen|herb|blason|escudo|insignia",re.I)
def hav(a,b,c,d):
  R=6371;p=math.pi/180;x=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2;return 2*R*math.asin(math.sqrt(x))
def clean(s): return re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]+>","",s or ""))).strip()
def weather(title):
  try: wt=get(W+"action=parse&prop=wikitext&page="+urllib.parse.quote(title))["parse"]["wikitext"]
  except Exception: return None
  m=re.search(r"\{\{\s*Weather box(.*?)\n\}\}",wt,re.S|re.I); src=title
  if not m:
    t=re.search(r"\{\{\s*([^{}|]*?[Ww]eather ?box[^{}|]*?)\s*\}\}",wt)
    if t:
      src="Template:"+t.group(1).strip()
      try: wt2=get(W+"action=parse&prop=wikitext&page="+urllib.parse.quote(src))["parse"]["wikitext"]; m=re.search(r"\{\{\s*Weather box(.*?)\n\}\}",wt2,re.S|re.I)
      except Exception: m=None
  if not m: return None
  b=m.group(1); M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  def row(k):
    v=[]
    for mo in M:
      x=re.search(r"\|\s*%s %s C\s*=\s*([−\-\d.]+)"%(mo,k),b)
      if not x: return None
      v.append(float(x.group(1).replace("−","-")))
    return v
  hi=row("high") or row("mean max"); lo=row("low") or row("mean min")
  if not hi or not lo: return None
  loc=re.search(r"\|\s*location\s*=\s*([^\n]+)",b); per=re.search(r"\|\s*source\s*1?\s*=\s*([^\n]+)",b)
  return {"hi":[round(x) for x in hi],"lo":[round(x) for x in lo],"loc":clean(re.sub(r"\{\{[^}]*\}\}","",re.sub(r"\{\{convert\|([\d.]+)\|(\w+)[^}]*\}\}",r"\1 \2",re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]",r"\1",loc.group(1))))).strip(" ,") if loc else "","page":src}
def wd(ids):
  if not ids: return {}
  return get("https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&languages=en&props=labels|claims&ids="+"|".join(ids))["entities"]
def lab(e): return (e.get("labels",{}).get("en") or {}).get("value")
def cl(e,p,whole=False): return [c["mainsnak"]["datavalue"]["value"]["id"] for c in e.get("claims",{}).get(p,[]) if c.get("rank")!="deprecated" and c["mainsnak"].get("datavalue") and isinstance(c["mainsnak"]["datavalue"]["value"],dict) and "id" in c["mainsnak"]["datavalue"]["value"] and not c.get("qualifiers",{}).get("P582") and not (whole and (c.get("qualifiers",{}).get("P518") or c.get("qualifiers",{}).get("P3005") or c.get("qualifiers",{}).get("P1001")))]
TAGMAP={"big city":"City","city":"City","city or town":"City","million city":"City","metropolis":"Metropolis","capital city":"Capital","capital":"Capital","national capital":"Capital","island":"Island","tourist destination":"Tourist destination","port city":"Port city","port settlement":"Port city","resort town":"Resort","seaside resort":"Seaside resort","global city":"Global city","town":"Town","largest city":"City","volcanic island":"Island","ski resort":"Ski resort","spa town":"Spa town","university town":"University town","old town":"Old town","holiday destination":"Tourist destination","archipelago":"Archipelago"}
def one(iata,city,lat,lon,country):
  lat,lon=float(lat),float(lon); cands=[x for x in [ISL.get(iata),city,f"{city}, {country}"] if x]
  for t in cands:
    q=get(W+"action=query&redirects=1&prop=pageimages|coordinates|extracts|pageprops|info&inprop=url&piprop=name&exintro=1&explaintext=1&exsentences=3&titles="+urllib.parse.quote(t))
    p=q["query"]["pages"][0]
    if p.get("missing") or not p.get("coordinates"): continue
    c=p["coordinates"][0]; dk=hav(lat,lon,c["lat"],c["lon"])
    if dk>80: continue
    if "disambiguation" in (p.get("pageprops") or {}): continue
    r={"iata":iata,"name":ISL.get(iata) or re.sub(r" \(.*\)$","",p["title"].split(",")[0]),"title":p["title"],"url":p["fullurl"],"desc":(p.get("extract") or "").split("\n")[0][:600],"lat":c["lat"],"lon":c["lon"],"km":round(dk)}
    qid=(p.get("pageprops") or {}).get("wikibase_item")
    try:
      E=wd([qid]) if qid else {}; e=E.get(qid,{}); cty=cl(e,"P17")[:1]; inst=cl(e,"P31")[:8]
      E2=wd(cty+inst); ce=E2.get(cty[0],{}) if cty else {}
      langs=cl(ce,"P37",True)[:1]; cur=cl(ce,"P38",True)[:1]; E3=wd(langs+cur)
      r["country"]=lab(ce) or country; r["countryUrl"]="https://en.wikipedia.org/wiki/"+urllib.parse.quote((lab(ce) or country).replace(" ","_"))
      r["lang"]=[lab(E3[x]) for x in langs if x in E3 and lab(E3[x])]; r["cur"]=[lab(E3[x]) for x in cur if x in E3 and lab(E3[x])]
      r["tags"]=list(dict.fromkeys(TAGMAP[lab(E2[x])] for x in inst if x in E2 and lab(E2[x]) in TAGMAP))[:3]; r["qid"]=qid
    except Exception as ex: r["country"]=country
    img=p.get("pageimage")
    if not img or BAD.search(img):
      try:
        tok=[w.lower() for w in re.findall(r"\w{4,}",r["name"])][:1]
        L=[x["title"][5:].replace(" ","_") for x in get(W+"action=query&prop=images&imlimit=60&titles="+urllib.parse.quote(p["title"]))["query"]["pages"][0].get("images",[])]
        L=[x for x in L if re.search(r"\.jpe?g$",x,re.I) and not BAD.search(x) and tok and tok[0] in x.lower().replace("_"," ")]
        pref=[x for x in L if re.search(r"skyline|panorama|view|aerial|harbou?r|old.town|centre|center|beach|bay|square|cityscape",x,re.I)]
        img=(pref or L or [None])[0]; r["imgPick"]="article image matched by name"
      except Exception: img=None
    if img and not BAD.search(img):
      try:
        ii=get("https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1100&titles=File:"+urllib.parse.quote(img))["query"]["pages"][0]
        if ii.get("imageinfo"):
          inf=ii["imageinfo"][0]; md=inf.get("extmetadata",{}); lic=(md.get("LicenseShortName") or {}).get("value","")
          if lic and re.search(r"CC|Public domain|PD|GFDL|Attribution|FAL",lic,re.I):
            im=Image.open(io.BytesIO(get(inf["thumburl"],raw=True))).convert("RGB"); w,h=im.size; th=w*9/16
            if th<=h: top=int((h-th)*0.42); im=im.crop((0,top,w,int(top+th)))
            else: nw=int(h*16/9); l=(w-nw)//2; im=im.crop((l,0,l+nw,h))
            im=im.resize((800,450),Image.LANCZOS); col=im.resize((1,1),Image.BOX).getpixel((0,0))
            for qv in (58,50,42):
              bio=io.BytesIO(); im.save(bio,"WEBP",quality=qv,method=6)
              if bio.tell()<70000: break
            open(f"/tmp/cw/img/{iata}.webp","wb").write(bio.getvalue())
            r["img"]={"file":img,"page":inf.get("descriptionurl"),"lic":lic,"by":clean((md.get("Artist") or {}).get("value",""))[:120],"col":"#%02x%02x%02x"%col,"kb":round(bio.tell()/1024)}
      except Exception as ex: r["imgErr"]=str(ex)[:100]
    r["climate"]=weather(p["title"])
    return r
  return {"iata":iata,"miss":True}
if __name__=="__main__":
  N=json.load(open("/tmp/cw/names.json")); D=json.load(open("/tmp/cw/dests.json"))
  extra=[k for k in ["KRK","MAN","STN","EMA","LHR","LGW","BHX","EDI","GLA","DUB","FRA","WAW","BER","VIE","PRG","LBA","NCL","GDN"] if k in N]
  todo=list(dict.fromkeys(extra+sorted(D,key=lambda k:-D[k])))
  if len(sys.argv)>1: todo=sys.argv[1:]
  out={}
  with cf.ThreadPoolExecutor(int(__import__("os").environ.get("PAR","6"))) as ex:
    import csv as _c
    AD={r[4]:(r[6],r[7]) for r in _c.reader(open("/workspace/skyline/server/data/airports.dat",encoding="utf8")) if len(r)>7}
    for i in todo:
      if i in N and (N[i][1] in (None,"None") or N[i][2] in (None,"None")) and i in AD: N[i][1],N[i][2]=AD[i]
    fs={ex.submit(one,i,*N[i]):i for i in todo if i in N}
    for f in cf.as_completed(fs):
      i=fs[f]
      try: out[i]=f.result()
      except Exception as e: out[i]={"iata":i,"err":str(e)[:120]}
  json.dump(out,open("/tmp/cw/out.json" if len(sys.argv)<2 else "/tmp/cw/test.json","w"),ensure_ascii=False,indent=0)
  print(len(out),sum(1 for v in out.values() if v.get("img")),sum(1 for v in out.values() if v.get("climate")))
