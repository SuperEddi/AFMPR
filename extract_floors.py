import re
import os
import json


def extract_from_sql(file_path):
    floors = set()
    mappings = {}  # codigo_activo -> piso

    # Patterns for INSERT INTO "activos"
    # INSERT INTO "activos" ("id","codigo_activo",...,"piso",...) VALUES(...,'CODIGO','...',...,'PISO',...);
    # Actually, the column order might vary, but in these backups it seems consistent.
    # Col 2: codigo_activo, Col 9: piso (1-indexed)

    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if 'INSERT INTO "activos"' in line:
                # Extract values from VALUES(...)
                match = re.search(r"VALUES\((.*)\);", line)
                if match:
                    values_str = match.group(1)
                    # Split by comma but be careful with commas inside strings
                    # A simple split won't work well with strings like 'DESC, WITH COMMA'
                    # Let's use a regex to find all strings and numbers
                    values = re.findall(r"'(?:''|[^'])*'|\d+|NULL", values_str)

                    if len(values) >= 9:
                        codigo = values[1].strip("'")
                        piso = values[8].strip("'")
                        if piso and piso != "NULL" and piso != "":
                            floors.add(piso)
                            mappings[codigo] = piso

            elif 'INSERT INTO "usuarios"' in line:
                match = re.search(r"VALUES\((.*)\);", line)
                if match:
                    values_str = match.group(1)
                    values = re.findall(r"'(?:''|[^'])*'|\d+|NULL", values_str)
                    if len(values) >= 7:
                        piso = values[6].strip("'")
                        if piso and piso != "NULL" and piso != "":
                            floors.add(piso)

    return sorted(list(floors)), mappings


def main():
    backups_dir = r"c:\Users\Lenovo\Downloads\para asignaciones\sql\backups"
    results = {}

    for filename in [
        "tierras_backup.sql",
        "justicia_backup.sql",
        "presidencia_backup.sql",
    ]:
        path = os.path.join(backups_dir, filename)
        if os.path.exists(path):
            print(f"Processing {filename}...")
            floors, mappings = extract_from_sql(path)
            results[filename.split("_")[0]] = {"floors": floors, "mappings": mappings}

    with open("extracted_data.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("Extraction complete. Results saved to extracted_data.json")


if __name__ == "__main__":
    main()
