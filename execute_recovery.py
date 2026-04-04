import json
import requests
import time


def execute_recovery(institution, mappings):
    # Base URL for the production site
    url = "https://activosvt1.pages.dev/api/migrate"
    headers = {
        "x-admin-password": "6925*",
        "x-institution": institution,
        "Content-Type": "application/json",
    }

    # Transform mappings for the new 'recovery_floors' action
    data_for_api = []
    for codigo, piso in mappings.items():
        if piso and piso != "NULL":
            data_for_api.append({"codigo_activo": codigo, "piso": piso})

    if not data_for_api:
        print(f"No valid data to recover for {institution}.")
        return

    # Process in chunks to avoid D1 limits and Worker timeouts
    CHUNK_SIZE = 80  # Match backend batch size for efficiency
    total = len(data_for_api)
    print(f"Starting recovery for {institution} ({total} records)...")

    for i in range(0, total, CHUNK_SIZE):
        chunk = data_for_api[i : i + CHUNK_SIZE]
        payload = {"type": "recovery_floors", "data": chunk}

        retries = 3
        while retries > 0:
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=30)
                if response.status_code == 200:
                    print(
                        f"  [{institution}] Processed {min(i+CHUNK_SIZE, total)}/{total}"
                    )
                    break
                else:
                    print(
                        f"  [{institution}] Error {response.status_code}: {response.text}"
                    )
                    retries -= 1
                    time.sleep(2)
            except Exception as e:
                print(f"  [{institution}] Exception: {str(e)}")
                retries -= 1
                time.sleep(5)

        if retries == 0:
            print(f"  [{institution}] FAILED chunk at index {i}")


def main():
    try:
        with open("extracted_data.json", "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print("Error: extracted_data.json not found. Run extract_floors.py first.")
        return

    # Priority order
    institutions = ["tierras", "justicia", "presidencia"]

    for inst in institutions:
        if inst in data and data[inst]["mappings"]:
            execute_recovery(inst, data[inst]["mappings"])


if __name__ == "__main__":
    main()
