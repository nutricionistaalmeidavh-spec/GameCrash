"""Generate Brazil Crash assets from scratch. R$0, no paid providers."""
import json
from pathlib import Path
from .cars import SPECS,build_car
from . import brasilia,imigrantes,serra

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"public"/"assets"/"brazil"
CARS=OUT/"cars"
MAPS=OUT/"maps"

def run():
    CARS.mkdir(parents=True,exist_ok=True)
    MAPS.mkdir(parents=True,exist_ok=True)
    manifest={"version":1,"units":"meters","coordinateSystem":"glTF Y-up",
        "vehicleForward":"-Z","cars":{},"maps":{}}
    for row in SPECS:
        slug,metadata=build_car(row,CARS)
        manifest["cars"][slug]=metadata
    for slug,module in [
        ("brasilia-eixo-monumental",brasilia),
        ("imigrantes",imigrantes),
        ("serra-do-rio-do-rastro",serra)]:
        scene,metadata=module.build()
        scene.export(MAPS/(slug+".glb"))
        manifest["maps"][slug]={"file":"assets/brazil/maps/"+slug+".glb",
             "collisionMeshPrefix":"COLLIDER_",**metadata}
    (OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",
         encoding="utf-8")
    print("Generated",len(manifest["cars"]),"vehicles and",
         len(manifest["maps"]),"landscapes in",OUT)

if __name__=="__main__":run()
