"""
Draw the little pictures beside the river game's what-to-do-when tips (start card and pause card),
as colour grids, into src/island/river/tip-art.ts; the page draws them as crisp SVG.

  tip     from behind: heeling over, leaning against it, the blade flat on the water
  roll    upside down, and the roll's needle swinging into its gap
  big     a wave train, pointing straight down it, leaning forward
  rocks   from above: the dark V between two rocks, arrows down it
  ledge   off the lip as it glows gold, flat
  falls   over a waterfall straight, leaning forward
  hole    in the foam behind a drop that curls back, paddling out forward
  split   from above: the hero line white and quick down one side, the sneak down the other
  eddy    from above: tucked in behind a rock, where the water turns back upstream

    python3 tools/drawings/river-tips.py [--preview out.png]
"""
import math, sys
from pathlib import Path
W,H=32,16
PAL={'w':'#6db3d6','d':'#3f7fa6','f':'#eef8fb','k':'#d9553b','K':'#9a3422','p':'#2b2640','h':'#f0c24a','y':'#e8a33a','r':'#a39d8e','R':'#6e685d','g':'#6f9e57','G':'#4f7a3d'}
class C:
  def __init__(s): s.g=[['.']*W for _ in range(H)]
  def px(s,x,y,c):
    x,y=int(round(x)),int(round(y))
    if 0<=x<W and 0<=y<H: s.g[y][x]=c
  def rect(s,x0,y0,x1,y1,c):
    for y in range(y0,y1+1):
      for x in range(x0,x1+1): s.px(x,y,c)
  def ell(s,cx,cy,rx,ry,c,a=0,only=None):
    ca,sa=math.cos(a),math.sin(a)
    for y in range(H):
      for x in range(W):
        dx,dy=x+.5-cx,y+.5-cy
        u=(dx*ca+dy*sa)/rx; v=(-dx*sa+dy*ca)/ry
        if u*u+v*v<=1 and (only is None or only(u,v)): s.g[y][x]=c
  def line(s,x0,y0,x1,y1,c):
    n=int(max(abs(x1-x0),abs(y1-y0))*2)+1
    for i in range(n+1):
      t=i/n; s.px(x0+(x1-x0)*t,y0+(y1-y0)*t,c)
  def poly(s,pts,c):
    for y in range(H):
      for x in range(W):
        X,Y=x+.5,y+.5; inside=False
        for i in range(len(pts)):
          (x1,y1),(x2,y2)=pts[i],pts[i-1]
          if (y1>Y)!=(y2>Y) and X<(x2-x1)*(Y-y1)/(y2-y1)+x1: inside=not inside
        if inside: s.g[y][x]=c
  def water(s,f,c='w',deep=None):
    for x in range(W):
      top=f(x)
      for y in range(H):
        if y>=top: s.g[y][x]= deep if deep and y>=top+3 else c
  def rows(s): return [''.join(r) for r in s.g]

def paddler(c,x,y,a,lean=0):
  """seated at (x,y) on a boat at angle a (rad, + is nose down to the right); lean tips the body forward"""
  up=a-math.pi/2+lean  # body direction
  hx,hy=x+math.cos(up)*3.2,y+math.sin(up)*3.2
  c.line(x,y,x+math.cos(up)*2,y+math.sin(up)*2,'p')
  c.px(hx,hy,'h'); c.px(hx+1,hy,'h'); c.px(hx,hy-1,'h'); c.px(hx+1,hy-1,'h')
def kayak_side(c,cx,cy,a=0,lean=0,rx=7):
  c.ell(cx,cy,rx,1.6,'k',a)
  c.ell(cx,cy,rx,1.6,'K',a,only=lambda u,v:v>0.2)
  paddler(c,cx-math.cos(a)*0.5,cy-1.3,a,lean)
def kayak_top(c,cx,cy,a=math.pi/2,paddle=True):
  c.ell(cx,cy,3.6,1.1,'k',a)
  if paddle:
    px,py=-math.sin(a),math.cos(a)
    c.line(cx-px*3.5,cy-py*3.5,cx+px*3.5,cy+py*3.5,'p')
    c.px(cx-px*3.5,cy-py*3.5,'y'); c.px(cx+px*3.5,cy+py*3.5,'y')
  c.px(cx,cy,'h')
def chevron(c,x,y,col='y',d='down'):
  if d=='down': c.px(x-1,y-1,col); c.px(x,y,col); c.px(x+1,y-1,col)
  if d=='right': c.px(x-1,y-1,col); c.px(x,y,col); c.px(x-1,y+1,col)
  if d=='up': c.px(x-1,y+1,col); c.px(x,y,col); c.px(x+1,y+1,col)
  if d=='left': c.px(x+1,y-1,col); c.px(x,y,col); c.px(x+1,y+1,col)

def arrow(c,x0,y0,x1,y1,col='p'):
  c.line(x0,y0,x1,y1,col)
  L=math.hypot(x1-x0,y1-y0); ux,uy=(x1-x0)/L,(y1-y0)/L
  for k in (1,2):
    for sgn in (-1,1):
      c.px(x1-ux*k+(-uy)*k*sgn,y1-uy*k+ux*k*sgn,col)
A={}
# tipping over: from behind, the boat heeling right, you leaning left against it, the blade flat on the water
c=C(); c.water(lambda x:10,deep='d')
c.ell(14,10,4.2,1.8,'k',0.4); c.ell(14,10,4.2,1.8,'K',0.4,only=lambda u,v:v>0.1)
c.line(13,8,11,4,'p'); c.line(14,8,12,4,'p')
c.rect(10,1,12,3,'h')
c.line(13,6,24,10,'p'); c.rect(23,10,27,10,'y'); c.rect(22,9,28,9,'f'); c.px(21,10,'f'); c.px(29,10,'f')
arrow(c,8,4,4,4)
A['tip']=c.rows()
# upside down: the hull up, you under it, and the roll's needle in its gap
c=C(); c.water(lambda x:6,deep='d')
c.ell(17,6,8,1.6,'K'); c.ell(17,6,8,1.6,'k',only=lambda u,v:v<0)
c.line(17,7,17,10,'p'); c.rect(16,11,18,12,'h')
for (x,y) in [(21,9),(22,7),(20,11)]: c.px(x,y,'f')
cx,cy=5,5.5
for t in range(0,181,6):
  r=math.radians(t); col='y' if 115<t<150 else 'r'
  c.px(cx-math.cos(r)*4.2,cy-math.sin(r)*4.2,col)
c.line(cx,cy,cx+math.cos(math.radians(50))*3.2,cy-math.sin(math.radians(50))*3.2,'p')
A['roll']=c.rows()
# big water: a wave train, pointing straight down it and leaning forward
c=C(); f=lambda x:8+2.6*math.sin((x-3)*2*math.pi/13)
c.water(f,deep='d')
for x in range(W):
  if math.cos((x-3)*2*math.pi/13)<-0.2 and math.sin((x-3)*2*math.pi/13)<0: c.px(x,int(f(x)),'f'); c.px(x,int(f(x))+1,'f')
kayak_side(c,16,7.2,0.42,0.5,rx=6.5)
A['big']=c.rows()
# rocks ahead: from above, the dark V between two rocks, arrows down it
c=C(); c.rect(0,0,W-1,H-1,'w')
c.poly([(9,0),(23,0),(16,15)],'d')
for (x,y,rx,ry) in [(6,7,5,3.2),(26,7,5,3.2)]:
  c.ell(x,y+.3,rx+.8,ry+.8,'f',only=lambda u,v:v<-0.1); c.ell(x,y,rx,ry,'R'); c.ell(x-.6,y-.6,rx-1,ry-1,'r')
chevron(c,16,6); chevron(c,16,9); chevron(c,16,12)
kayak_top(c,16,2)
A['rocks']=c.rows()
# a ledge: off the lip as it glows gold, landing flat
c=C()
c.rect(0,7,13,15,'R'); c.rect(0,5,13,6,'w'); c.rect(0,7,13,7,'d')
c.rect(12,5,13,5,'y')
c.poly([(13.5,5),(15.5,6),(16,12),(14,12)],'f')
c.rect(14,12,31,15,'w'); c.rect(14,14,31,15,'d'); c.rect(14,11,19,11,'f'); c.rect(15,12,18,12,'f')
kayak_side(c,22,5,-0.05,0.3,rx=6)
A['ledge']=c.rows()
# a waterfall: over it straight, leaning forward
c=C()
c.rect(0,4,9,15,'R'); c.rect(1,6,8,15,'r'); c.rect(0,2,9,3,'w')
c.poly([(9.5,2),(12,3),(13,14),(10,14)],'f'); c.poly([(10,4),(11.2,4.5),(12,13),(10.6,13)],'w')
c.rect(10,14,31,15,'w'); c.rect(9,13,17,13,'f')
kayak_side(c,17,6.5,1.05,0.35,rx=6)
A['falls']=c.rows()
# a hole: the water behind a drop curling back on itself; lean forward and paddle out
c=C()
c.rect(0,8,8,15,'R'); c.rect(0,6,8,7,'w'); c.poly([(8.5,6),(10,7),(10,11),(9,11)],'f')
c.rect(9,10,31,15,'w'); c.rect(9,13,31,15,'d')
c.ell(15,10,6,2.4,'f')
kayak_side(c,15,8.4,0,0.5,rx=6)
arrow(c,21,12,13,12,'p')
arrow(c,25,7,30,7,'y')
A['hole']=c.rows()
# a split: the hero line (white and quick) down the left, the sneak down the right
c=C(); c.rect(0,0,W-1,H-1,'w'); c.rect(0,0,2,15,'g'); c.rect(29,0,31,15,'g')
c.ell(17,12,5,6,'r'); c.ell(17,12.5,4,5,'g'); c.ell(17,12.8,2.5,3.5,'G')
for (x,y) in [(5,6),(8,8),(5,10),(9,12),(6,14),(8,5),(4,12)]: c.rect(x,y,x+1,y,'f')
chevron(c,7,10,'y'); chevron(c,7,13,'y')
c.px(26,11,'d'); c.px(26,14,'d')
kayak_top(c,16,2.5)
A['split']=c.rows()
# an eddy: tucked in behind a rock, the water turning back upstream
c=C(); c.rect(0,0,W-1,H-1,'w'); c.rect(27,0,31,15,'g'); c.rect(26,0,26,15,'G')
c.poly([(10,4),(18,4),(20,15),(8,15)],'d')
c.ell(14,3.4,5.6,3.2,'f',only=lambda u,v:v<-0.2); c.ell(14,3,5,2.6,'R'); c.ell(13.4,2.4,4,1.8,'r')
for x,y in [(4,2),(4,9),(23,2),(23,9)]: arrow(c,x,y,x,y+4,'f')
kayak_top(c,14,10.5,math.pi/2,paddle=False)
arrow(c,10,14,10,8)
A['eddy']=c.rows()

for name, rows in A.items():
  assert len(rows) == H and all(len(r) == W for r in rows), name

out = Path(__file__).resolve().parents[2] / 'src/island/river/tip-art.ts'
lines = ['// Drawn by tools/drawings/river-tips.py: run that, don\'t edit here.', '',
  '/** The colour of each letter in a drawing (a dot is left clear). */',
  'export const TIP_COLOURS: Record<string, string> = { ' + ', '.join(f"{k}: '{v}'" for k, v in PAL.items()) + ' };', '',
  f'/** The pictures beside the river tips, {W} by {H}. */',
  'export const TIP_ART: Record<string, string[]> = {']
for name, rows in A.items():
  lines.append(f'  {name}: [')
  lines += [f"    '{r}'," for r in rows]
  lines.append('  ],')
lines.append('};')
out.write_text('\n'.join(lines) + '\n')

if '--preview' in sys.argv:
  from PIL import Image
  S = 8
  im = Image.new('RGB', ((W + 2) * S * 3, (H + 2) * S * 3), '#f4ead5')
  for i, (name, rows) in enumerate(A.items()):
    ox, oy = (i % 3) * (W + 2) * S + S, (i // 3) * (H + 2) * S + S
    for y, r in enumerate(rows):
      for x, ch in enumerate(r):
        if ch != '.':
          im.paste(tuple(int(PAL[ch][j:j + 2], 16) for j in (1, 3, 5)), (ox + x * S, oy + y * S, ox + x * S + S, oy + y * S + S))
  im.save(sys.argv[sys.argv.index('--preview') + 1])
