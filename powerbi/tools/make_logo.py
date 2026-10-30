"""Dibuja el logo genérico de FinDemo (fintech ficticia) para el reporte.

Uso:  python powerbi/tools/make_logo.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

NAVY = (14, 40, 65)
ORANGE = (242, 140, 40)
WHITE = (255, 255, 255)
SIZE = 360
OUT = (Path(__file__).resolve().parents[1] / "FinDemoGrowth.Report" / "StaticResources"
       / "RegisteredResources" / "FinDemoLogo1761780000.png")


def main() -> None:
    scale = 4  # se dibuja en grande y se reduce para suavizar bordes
    s = SIZE * scale
    img = Image.new("RGBA", (s, s), (255, 255, 255, 0))
    d = ImageDraw.Draw(img)

    # Monograma: cuadrado redondeado azul marino con barras ascendentes y una flecha.
    box = (int(s * 0.22), int(s * 0.06), int(s * 0.78), int(s * 0.62))
    d.rounded_rectangle(box, radius=int(s * 0.12), fill=NAVY)
    left, top, right, bottom = box
    bw = (right - left) * 0.14
    base = bottom - (bottom - top) * 0.2
    for i, h in enumerate((0.22, 0.36, 0.52)):
        x = left + (right - left) * (0.2 + i * 0.22)
        d.rounded_rectangle((x, base - (bottom - top) * h, x + bw, base), radius=int(bw * 0.3),
                            fill=WHITE if i < 2 else ORANGE)
    # Flecha de crecimiento sobre las barras.
    p0 = (left + (right - left) * 0.2, top + (bottom - top) * 0.5)
    p1 = (left + (right - left) * 0.48, top + (bottom - top) * 0.36)
    p2 = (left + (right - left) * 0.78, top + (bottom - top) * 0.18)
    d.line([p0, p1, p2], fill=ORANGE, width=int(s * 0.022), joint="curve")
    a = s * 0.05
    d.polygon([(p2[0] + a * 0.35, p2[1] - a * 0.35), (p2[0] - a, p2[1] - a * 0.2), (p2[0] - a * 0.2, p2[1] + a)],
              fill=ORANGE)

    # Nombre.
    font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", int(s * 0.17))
    text_fin, text_demo = "Fin", "Demo"
    w_fin = d.textlength(text_fin, font=font)
    w_total = w_fin + d.textlength(text_demo, font=font)
    x = (s - w_total) / 2
    y = s * 0.68
    d.text((x, y), text_fin, font=font, fill=NAVY)
    d.text((x + w_fin, y), text_demo, font=font, fill=ORANGE)

    img = img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
