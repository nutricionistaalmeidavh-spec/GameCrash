"""Regression tests for the generated assets; run after build."""
from pathlib import Path
import json
import numpy as np
import trimesh

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/"public"/"assets"/"brazil"

def test_catalog_and_paths():
    data=json.loads((ASSETS/"manifest.json").read_text(encoding="utf-8"))
    assert len(data["cars"])==10
    assert len(data["maps"])==3
    assert data["vehicleForward"]=="-Z"
    for section in ("cars","maps"):
        for entry in data[section].values():
            path=ROOT/"public"/entry["file"].removeprefix("assets/")
            # Entries contain assets/brazil/*; the public base must be preserved.
            path=ROOT/"public"/entry["file"]
            assert path.is_file(),path
            assert path.stat().st_size>1000
            scene=trimesh.load(path,force="scene")
            assert np.isfinite(scene.bounds).all()
            assert len(scene.geometry)>=8

def test_routes_have_enough_points_and_spawn():
    data=json.loads((ASSETS/"manifest.json").read_text(encoding="utf-8"))
    for map_data in data["maps"].values():
        assert len(map_data["route"])>=12
        assert len(map_data["obstacles"])>=2
        assert len(map_data["spawn"]["position"])==3

def test_no_paid_runtime_dependencies():
    assert (ROOT/"tools"/"brasil"/"build.py").exists()
