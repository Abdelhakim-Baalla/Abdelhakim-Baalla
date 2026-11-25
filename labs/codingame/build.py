"""Bundle the public solvers and their original licenses at the revisions in projects.json."""
import json
from pathlib import Path
from shutil import copytree
from urllib.request import urlopen

root = Path(__file__).resolve().parent
output = root / "dist"
copytree(root / "site", output, dirs_exist_ok=True)
for project in json.loads((output / "projects.json").read_text()):
    folder = output / "solvers" / project["id"]
    folder.mkdir(parents=True, exist_ok=True)
    for file in ("solution.js", "LICENSE"):
        url = f'https://raw.githubusercontent.com/Abdelhakim-Baalla/{project["id"]}/{project["rev"]}/{file}'
        with urlopen(url, timeout=30) as response:
            (folder / file).write_bytes(response.read())
