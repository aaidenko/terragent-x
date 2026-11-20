"""Network and raster IO: Planetary Computer STAC search, Sentinel-2 band
reads onto one analysis grid, and reference-water rasters reprojected onto
that grid. Everything that touches the network lives here."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
S2_COLLECTION = "sentinel-2-l2a"
WORLDCOVER_COLLECTION = "esa-worldcover"
JRC_GSW_COLLECTION = "jrc-gsw"


@dataclass
class Grid:
    crs: Any
    transform: Any
    height: int
    width: int


def _client():
    import planetary_computer as pc
    from pystac_client import Client

    return Client.open(STAC_URL, modifier=pc.sign_inplace)


def search(collection: str, bbox: list[float], datetime: str | None = None,
           max_cloud: float | None = None, limit: int = 8) -> list[Any]:
    kwargs: dict[str, Any] = {"collections": [collection], "bbox": bbox, "max_items": limit}
    if datetime:
        kwargs["datetime"] = datetime
    if max_cloud is not None:
        kwargs["query"] = {"eo:cloud_cover": {"lt": max_cloud}}
    return list(_client().search(**kwargs).items())


def clearest(items: list[Any]) -> Any | None:
    if not items:
        return None
    return sorted(items, key=lambda i: i.properties.get("eo:cloud_cover", 100))[0]


def _clip_window(ds: Any, bbox: list[float]):
    from rasterio.warp import transform_bounds
    from rasterio.windows import Window, from_bounds

    left, bottom, right, top = transform_bounds("EPSG:4326", ds.crs, *bbox, densify_pts=21)
    left, right = max(left, ds.bounds.left), min(right, ds.bounds.right)
    bottom, top = max(bottom, ds.bounds.bottom), min(top, ds.bounds.top)
    if left >= right or bottom >= top:
        raise RuntimeError("AOI does not intersect selected tile")
    window = from_bounds(left, bottom, right, top, transform=ds.transform)
    return window.intersection(Window(0, 0, ds.width, ds.height))


def read_s2_scene(item: Any, bbox: list[float], scale: int = 10) -> tuple[dict[str, np.ndarray], Grid]:
    """Read B02,B03,B04,B08,B11 (DN) and SCL onto one grid (10 m * scale)."""
    import planetary_computer as pc
    import rasterio
    from affine import Affine
    from rasterio.enums import Resampling

    signed = pc.sign(item)
    with rasterio.open(signed.assets["B03"].href) as ds:
        window = _clip_window(ds, bbox)
        out_h = max(32, int(window.height // scale))
        out_w = max(32, int(window.width // scale))
        transform = ds.window_transform(window) * Affine.scale(
            window.width / out_w, window.height / out_h
        )
        grid = Grid(ds.crs, transform, out_h, out_w)

    def band(name: str, nearest: bool = False) -> np.ndarray:
        with rasterio.open(signed.assets[name].href) as ds:
            return ds.read(
                1,
                window=_clip_window(ds, bbox),
                out_shape=(out_h, out_w),
                resampling=Resampling.nearest if nearest else Resampling.bilinear,
            ).astype("float32")

    bands = {n: band(n) for n in ("B02", "B03", "B04", "B08", "B11")}
    bands["SCL"] = band("SCL", nearest=True)
    return bands, grid


def processing_baseline(item: Any) -> str | None:
    return item.properties.get("s2:processing_baseline")


def _reproject_items(items: list[Any], asset: str, grid: Grid, bbox: list[float],
                     resampling: Any, nodata: float) -> np.ndarray:
    import planetary_computer as pc
    import rasterio
    from rasterio.warp import reproject

    dst = np.full((grid.height, grid.width), nodata, dtype="float32")
    pad = 0.02
    padded = [bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad]
    for item in items:
        href = pc.sign(item).assets[asset].href
        with rasterio.open(href) as ds:
            try:
                win = _clip_window(ds, padded)
            except RuntimeError:
                continue
            src = ds.read(1, window=win).astype("float32")
            tmp = np.full_like(dst, nodata)
            reproject(
                src, tmp,
                src_transform=ds.window_transform(win), src_crs=ds.crs, src_nodata=ds.nodata,
                dst_transform=grid.transform, dst_crs=grid.crs, dst_nodata=nodata,
                resampling=resampling,
            )
            fill = (dst == nodata) & (tmp != nodata)
            dst[fill] = tmp[fill]
    return dst


def read_reference_water(grid: Grid, bbox: list[float]) -> dict[str, Any]:
    """Reference permanent-water layers on `grid`:
    - jrc_occurrence: JRC GSW occurrence 0-100 (% of observations water, 1984-2021)
    - worldcover: ESA WorldCover 2021 class codes (80 = permanent water)
    Returns arrays plus item ids; missing layers are None."""
    from rasterio.enums import Resampling

    out: dict[str, Any] = {"jrc_occurrence": None, "worldcover": None, "items": []}
    try:
        jrc = search(JRC_GSW_COLLECTION, bbox, limit=4)
        if jrc:
            arr = _reproject_items(jrc, "occurrence", grid, bbox, Resampling.average, 255.0)
            out["jrc_occurrence"] = np.where(arr > 100, np.nan, arr)
            out["items"] += [f"{JRC_GSW_COLLECTION}:{i.id}" for i in jrc]
    except Exception:  # noqa: BLE001 - reference is optional; caller records limitation
        out["jrc_error"] = True
    try:
        wc = search(WORLDCOVER_COLLECTION, bbox, limit=4)
        wc = [i for i in wc if "2021" in i.id] or wc
        if wc:
            arr = _reproject_items(wc, "map", grid, bbox, Resampling.mode, 0.0)
            out["worldcover"] = np.where(arr == 0, np.nan, arr)
            out["items"] += [f"{WORLDCOVER_COLLECTION}:{i.id}" for i in wc]
    except Exception:  # noqa: BLE001
        out["worldcover_error"] = True
    return out
