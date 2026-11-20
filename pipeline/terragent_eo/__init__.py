"""Terragent EO factory: Sentinel-2 water mapping with reference calibration.

Modules (dependency direction is top -> bottom, no cycles):
  analyze      orchestration + output contract (used by the CLI)
  confidence   confidence level, reasons, limitations (pure python)
  calibration  mask-vs-reference metrics and method selection (numpy only)
  masks        SCL clear mask, threshold masks, weak labels, numpy MLP
  indices      spectral indices (numpy only)
  stac         network / raster IO (Planetary Computer STAC + rasterio)
"""

__all__ = ["analyze", "calibration", "confidence", "indices", "masks", "stac"]
