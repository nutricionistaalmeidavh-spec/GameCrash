from pathlib import Path
import json
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public' / 'assets'

def test_all_assets_generated():
    manifest = json.loads((ASSETS/'manifest.json').read_text(encoding='utf8'))
    assert len(manifest['cars']) == 10
    assert len(manifest['maps']) == 3
    assert manifest['vehicleForward'] == '-Z'
    for kind in ('cars','maps'):
        for item in manifest[kind].values():
            path = ASSETS / item['file']
            assert path.is_file() and path.stat().st_size > 3000
            scene = trimesh.load(path, force='scene')
            assert np.isfinite(scene.bounds).all()

def test_driving_metadata():
    manifest = json.loads((ASSETS/'manifest.json').read_text(encoding='utf8'))
    for car in manifest['cars'].values():
        assert 500 < car['massKg'] < 2500
        assert car['wheelbaseMeters'] > 1.5
    for m in manifest['maps'].values():
        assert len(m['route']) >= 30
        assert m['lanes'] >= 2
        assert len(m['obstacles']) == 2
        assert len(m['spawn']['position']) == 3
