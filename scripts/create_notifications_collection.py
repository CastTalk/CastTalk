import urllib.request
import json
import time

from _env import ENDPOINT, PROJECT_ID, API_KEY, DATABASE_ID  # secrets come from .env.local
COLLECTION_ID = "notifications"

def make_request(url, method="GET", data=None):
    headers = {
        "X-Appwrite-Project": PROJECT_ID,
        "X-Appwrite-Key": API_KEY,
        "Content-Type": "application/json"
    }
    
    req_data = None
    if data:
        req_data = json.dumps(data).encode("utf-8")
        
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(error_body)
            if err_json.get("type") == "collection_already_exists" or err_json.get("type") == "attribute_already_exists":
                return {"already_exists": True, "message": err_json.get("message")}
            print(f"HTTP Error {e.code}: {err_json.get('message', error_body)}")
        except Exception:
            print(f"HTTP Error {e.code}: {error_body}")
        return None
    except Exception as e:
        print(f"Request failed: {e}")
        return None

def main():
    print("=== Appwrite Notifications Collection Creation ===")
    
    # 1. Create Collection
    col_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections"
    col_payload = {
        "collectionId": COLLECTION_ID,
        "name": "Notifications",
        "permissions": []
    }
    print(f"Creating collection '{COLLECTION_ID}'...")
    res_col = make_request(col_url, "POST", col_payload)
    if res_col:
        if res_col.get("already_exists"):
            print("Collection already exists.")
        else:
            print("Collection created successfully.")
    else:
        print("Failed to create collection.")
        return

    # 2. Attributes specifications
    attributes = [
        {"type": "string", "key": "userId", "size": 255, "required": True},
        {"type": "string", "key": "text", "size": 255, "required": True},
        {"type": "boolean", "key": "read", "required": True},
        {"type": "string", "key": "type", "size": 50, "required": True},
        {"type": "string", "key": "createdAt", "size": 255, "required": True}
    ]

    # 3. Create Attributes
    for attr in attributes:
        attr_type = attr["type"]
        attr_key = attr["key"]
        attr_payload = {
            "key": attr_key,
            "required": attr["required"]
        }
        
        if attr_type == "string":
            attr_payload["size"] = attr["size"]
            attr_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/{COLLECTION_ID}/attributes/string"
        elif attr_type == "integer":
            attr_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/{COLLECTION_ID}/attributes/integer"
        elif attr_type == "boolean":
            attr_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/{COLLECTION_ID}/attributes/boolean"
            
        print(f"  - Creating {attr_type} attribute '{attr_key}'...")
        res_attr = make_request(attr_url, "POST", attr_payload)
        if res_attr:
            if res_attr.get("already_exists"):
                print(f"    Attribute '{attr_key}' already exists.")
            else:
                print(f"    Attribute '{attr_key}' created.")
        else:
            print(f"    Failed to create attribute '{attr_key}'.")

    print("\nWaiting 10 seconds for Appwrite attribute indexing...")
    time.sleep(10)
    print("\nSetup complete! Notifications collection is ready.")

if __name__ == "__main__":
    main()
