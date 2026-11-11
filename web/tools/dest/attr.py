"""Write web/public/dest/ATTRIBUTION.md from index.json (used by merge.py and override.py; run directly to resync)."""
import json,os
D=os.path.join(os.path.dirname(__file__),"../../public/dest")
HEAD=["# Destination photos and facts (Clearway skin)","",
"Hero photos come from Wikimedia Commons: the destination's English Wikipedia lead image, or a hand-picked Commons photo of the same place where the lead image was weak or off-topic (see tools/dest/override.py). Each is cropped to 4:3 and resized to at most 1600×1200 WebP (quality 80), sharp on a 3× phone screen. Only CC, public-domain, GFDL or FAL files are used; the author and licence of each are listed below.",
"Descriptions: English Wikipedia intro (CC BY-SA 4.0). Language/currency/tags: Wikidata (CC0). Monthly temperatures: the article's Wikipedia climate table (\"Weather box\").",
"Each place was accepted only if the Wikipedia article's coordinates lie within 80 km of the airport; hand-picked photos are of that same place.","",
"| Airport | Place | Photo (Commons file) | Author | Licence |","|---|---|---|---|---|"]
def write(idx):
  att=list(HEAD)
  for k,v in sorted(idx.items()):
    i=v.get("img")
    if i: att.append(f"| {k} | {v['name']} | [{i['file']}]({i.get('page','')}) | {(i.get('by') or 'see file page').replace('|','/')} | {i['lic']} |")
  open(f"{D}/ATTRIBUTION.md","w").write("\n".join(att)+"\n")
if __name__=="__main__": write(json.load(open(f"{D}/index.json"))); print("ATTRIBUTION.md written")
