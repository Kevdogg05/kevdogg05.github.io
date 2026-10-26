# Generator

Regenerates every file in the parent folder from `design.py` (shapes in reference-image pixels, 0.33 mm/px).

```
pip install shapely numpy pillow reportlab
python3 export.py ..
```

- `design.py` - helmet/NVG/mask/vest components, each painted at a layer height (1 = backer, 6 = top)
- `build.py` - turns the painted heights into per-layer cut outlines and clips score/engrave detail to what stays visible
- `export.py` - writes the xTool SVGs (mm), stand files, previews and the PDF guide
