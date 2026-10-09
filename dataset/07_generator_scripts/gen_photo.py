"""Anand Cartons rate card: printed card with a pen correction, photographed at an angle."""
import os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from master import *

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset", "03_vendor_replies", "4_anand_photo"))
F = "/usr/share/fonts/truetype/dejavu/"
f_h = ImageFont.truetype(F + "DejaVuSerif-Bold.ttf", 44)
f_s = ImageFont.truetype(F + "DejaVuSans.ttf", 22)
f_t = ImageFont.truetype(F + "DejaVuSansCondensed.ttf", 23)
f_tb = ImageFont.truetype(F + "DejaVuSansCondensed-Bold.ttf", 23)
f_pen = ImageFont.truetype(F + "DejaVuSans-Oblique.ttf", 30)

W, H = 1500, 2050
card = Image.new("RGB", (W, H), (247, 244, 236))
d = ImageDraw.Draw(card)
d.text((60, 50), "ANAND CARTONS", font=f_h, fill=(30, 30, 30))
d.text((60, 108), "Survey No. 88, Kharabwadi, Chakan, Pune  |  Mob 98XXXXXX12", font=f_s, fill=(60, 60, 60))
d.text((60, 145), "RATE CARD  -  OCT 2026  -  for Sahyadri Appliances", font=f_tb, fill=(30, 30, 30))
d.line((60, 185, W - 60, 185), fill=(40, 40, 40), width=3)
cols = [60, 150, 930, 1130]
y = 200
for x, h in zip(cols, ["No.", "Item", "Ply", "Rate Rs/pc"]):
    d.text((x, y), h, font=f_tb, fill=(20, 20, 20))
y += 40
d.line((60, y, W - 60, y), fill=(90, 90, 90), width=2)
y += 8
short = lambda n: n.replace(", unit carton", " box").replace("master carton", "master box").replace(" (new SKU)", "")
n = 1
rows_y = {}
for l in LINES:
    if l["id"] in AC_MISSING:
        continue
    ply = l["ply"].split()[0].replace("-ply", " PLY")
    if l["id"] == AC_SUB_LINE:
        ply = "3 PLY"
    rate = AC_L19_PRINTED if l["id"] == AC_HAND_LINE else PRICES["AC"][l["id"]]
    d.text((cols[0], y), f"{n}", font=f_t, fill=(25, 25, 25))
    d.text((cols[1], y), short(l["name"])[:52], font=f_t, fill=(25, 25, 25))
    d.text((cols[2], y), ply, font=f_t, fill=(25, 25, 25))
    d.text((cols[3], y), f"{rate:.2f}", font=f_t, fill=(25, 25, 25))
    rows_y[l["id"]] = y
    y += 52
    d.line((60, y - 10, W - 60, y - 10), fill=(205, 200, 190), width=1)
    n += 1
y += 10
d.line((60, y, W - 60, y), fill=(40, 40, 40), width=2)
for t in ["Rates include delivery at your Chakan plant. GST 18% extra.", "Valid 15 days. Payment 30 days.",
          "Printing plates free above 5,000 pcs.  We do not make: juicer box, air cooler box, jar insert."]:
    y += 34
    d.text((60, y), t, font=f_s, fill=(50, 50, 50))
y += 60
d.text((60, y), "Fictional demo document.", font=ImageFont.truetype(F + "DejaVuSans.ttf", 16), fill=(130, 130, 130))

# pen correction on the room heater line: strike the printed rate, write 31.20 (the 1 looks like a 7)
ry = rows_y[AC_HAND_LINE]
d.line((cols[3] - 6, ry + 14, cols[3] + 90, ry + 10), fill=(25, 45, 140), width=4)
pen = Image.new("RGBA", (220, 70), (0, 0, 0, 0))
pd = ImageDraw.Draw(pen)
pd.text((6, 4), "3", font=f_pen, fill=(25, 45, 150))
# a '1' with a long hooked top that reads like a 7
pd.line((30, 14, 48, 8), fill=(25, 45, 150), width=4)
pd.line((48, 8, 40, 46), fill=(25, 45, 150), width=4)
pd.text((50, 4), ".20", font=f_pen, fill=(25, 45, 150))
pen = pen.rotate(6, expand=True, resample=Image.BICUBIC)
card.paste(pen, (cols[3] + 100, ry - 22), pen)
d.text((cols[3] + 230, ry - 8), "AS", font=ImageFont.truetype(F + "DejaVuSans-Oblique.ttf", 18), fill=(25, 45, 150))

# light paper texture and a fold line
arr = np.asarray(card).astype(np.float32)
rng = np.random.default_rng(4)
arr += rng.normal(0, 4, arr.shape)
arr[:, W // 2 - 2: W // 2 + 2] *= 0.93
card = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

# place on a desk and photograph at an angle (perspective transform)
desk = Image.new("RGB", (1800, 2300), (92, 70, 52))
dnp = np.asarray(desk).astype(np.float32) + rng.normal(0, 7, (2300, 1800, 3))
desk = Image.fromarray(np.clip(dnp, 0, 255).astype(np.uint8))
desk.paste(card, (150, 120))

def coeffs(src, dst):
    A = []; B = []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B += [u, v]
    return np.linalg.lstsq(np.array(A, float), np.array(B, float), rcond=None)[0]

src = [(150, 120), (1650, 120), (1650, 2170), (150, 2170)]
dst = [(240, 150), (1580, 110), (1680, 2190), (120, 2235)]
photo = desk.transform((1800, 2300), Image.PERSPECTIVE, coeffs(src, dst), Image.BICUBIC)

# uneven lighting: darker bottom-left, a soft shadow from the phone
g = np.asarray(photo).astype(np.float32)
yy, xx = np.mgrid[0:2300, 0:1800]
light = 0.78 + 0.28 * (xx / 1800) * 0.6 + 0.22 * (1 - yy / 2300) * 0.6
shadow = 1 - 0.28 * np.exp(-(((xx - 500) / 420) ** 2 + ((yy - 1900) / 300) ** 2))
g *= (light * shadow)[..., None]
g[..., 2] *= 0.94  # warm indoor light
photo = Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.3))
photo = photo.rotate(-2.5, resample=Image.BICUBIC, fillcolor=(80, 60, 45)).resize((1350, 1725))
photo.save(os.path.join(OUT, "Anand_RateCard_photo.jpg"), quality=72)
print("ok")
