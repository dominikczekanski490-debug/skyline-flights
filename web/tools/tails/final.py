import json,cv2,numpy as np,sys
from PIL import Image
from rembg import remove,new_session
P=json.load(open("poly.json")); S=new_session("isnet-general-use")
POLYONLY=set("BA AF KL QR TK LO AA UA AY LX OS W6 TP EK BY".split())
for k,pts in P.items():
  im=np.array(Image.open(f"tc/{k}.png").convert("RGB")); h,w=im.shape[:2]; SS=4
  pm=Image.new("L",(w*SS,h*SS),0); from PIL import ImageDraw; ImageDraw.Draw(pm).polygon([(x*w*SS,y*h*SS) for x,y in pts],fill=255)
  poly=np.array(pm.resize((w,h),Image.LANCZOS))
  root=int(round(max(y for x,y in pts)*h))
  if k in POLYONLY: a=poly
  else:
    r=max(2,int(min(w,h)*0.05)); dil=cv2.dilate(poly,np.ones((2*r+1,2*r+1),np.uint8))
    hard=(poly>0).astype(np.uint8); dd=cv2.dilate(hard,np.ones((2*int(min(w,h)*0.05)+1,)*2,np.uint8))
    med=np.median(im[dd==0],axis=0) if (dd==0).any() else np.array([200,200,200]); x=im.copy(); x[dd==0]=med
    pad=int(0.15*max(w,h)); X=np.full((h+2*pad,w+2*pad,3),med,np.uint8); X[pad:pad+h,pad:pad+w]=x
    rb=np.array(remove(Image.fromarray(X),session=S,only_mask=True))[pad:pad+h,pad:pad+w]
    a=np.minimum(rb,dil); a[root:]=0
    # fill interior holes (logos misread as background): inside eroded polygon force opaque
    ero=cv2.erode((poly>128).astype(np.uint8),np.ones((8*r+1,8*r+1),np.uint8)); a=np.maximum(a,ero*255)
  o=Image.fromarray(np.dstack([im,a]),"RGBA"); o=o.crop(o.getchannel("A").point(lambda v:255 if v>24 else 0).getbbox())
  o.thumbnail((222,168),Image.LANCZOS); o.save(f"cut5/{k}.png"); print(k,o.size,end="; ",flush=True)
