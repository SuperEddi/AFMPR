import subprocess
import json

dbs = {
    "tierras": "detalle_activos_tierras",
    "justicia": "db_justicia_activos",
    "presidencia": "db_presidencia_activos",
    "culturas": "db_culturas_activos",
    "vicepresidencia": "db_vicepresidencia_activos",
}


def run_query(db_name, query):
    cmd = f'npx wrangler d1 execute {db_name} --command="{query}" --json'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    try:
        data = json.loads(result.stdout)
        if isinstance(data, list) and len(data) > 0:
            return data[0].get("results", [])
        return []
    except:
        print(f"Error reading {db_name}: {result.stderr}")
        return []


def sync():
    print("Fetching canonical data from TIERRAS...")
    grupos = run_query(dbs["tierras"], "SELECT * FROM cat_grupos_contables")
    auxiliares = run_query(dbs["tierras"], "SELECT * FROM cat_auxiliares")

    if not grupos or not auxiliares:
        print("Failed to fetch data from Tierras. Check table names.")
        return

    print(f"Grandes Grupos: {len(grupos)}, Auxiliares: {len(auxiliares)}")

    # Generate SQL for Grupos
    sql_grupos = "DELETE FROM cat_grupos_contables; "
    for g in grupos:
        life = g["vida_util"] if g["vida_util"] is not None else "NULL"
        obs = f"'{g['observaciones']}'" if g["observaciones"] else "NULL"
        reg = f"'{g['registrado_por']}'" if g["registrado_por"] else "NULL"
        sql_grupos += f"INSERT INTO cat_grupos_contables (id, nombre, vida_util, observaciones, registrado_por, fecha_creacion) VALUES ({g['id']}, '{g['nombre']}', {life}, {obs}, {reg}, '{g['fecha_creacion']}'); "

    # Generate SQL for Auxiliares
    sql_aux = "DELETE FROM cat_auxiliares; "
    for a in auxiliares:
        gid = (
            a["cat_grupo_contable_id"]
            if a["cat_grupo_contable_id"] is not None
            else "NULL"
        )
        reg = f"'{a['registrado_por']}'" if a["registrado_por"] else "NULL"
        sql_aux += f"INSERT INTO cat_auxiliares (id, nombre, cat_grupo_contable_id, registrado_por, fecha_creacion) VALUES ({a['id']}, '{a['nombre']}', {gid}, {reg}, '{a['fecha_creacion']}'); "

    full_sql = sql_grupos + sql_aux

    # Write to temp file for safety
    with open("sync_catalogs.sql", "w", encoding="utf-8") as f:
        f.write(full_sql)

    # Sync to other DBs
    targets = ["justicia", "presidencia", "culturas", "vicepresidencia"]
    for t in targets:
        print(f"Syncing to {t.upper()}...")
        cmd = f"npx wrangler d1 execute {dbs[t]} --file=sync_catalogs.sql"
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if "Success" in res.stdout or res.returncode == 0:
            print(f"Successfully synced {t.upper()}")
        else:
            print(f"Error syncing {t.upper()}: {res.stderr}")


if __name__ == "__main__":
    sync()
