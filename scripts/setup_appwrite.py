import urllib.request
import json
import time

ENDPOINT = "https://syd.cloud.appwrite.io/v1"
PROJECT_ID = "6a27f0d9002671523088"
API_KEY = "standard_a078fa72fc96cbd1d9bbee6fb4f77f5980c15fdee8fd5acb18aa37fb9c2c43f8dc0c1caebc1b2d1818872a0e3ebaef13508efc637c06c6d6794851986b5bfa77eb3c93ba00feb1be08a4912413b75bf60076b981be60bc66258ee538596f3e14ffe1cd3727a594310c021d5bde88c6edb006423b9771efd1f675e04c3e12a332"
DATABASE_ID = "castdb"

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
            # If the database/collection already exists, return it
            if err_json.get("type") == "database_already_exists" or err_json.get("type") == "collection_already_exists" or err_json.get("type") == "attribute_already_exists":
                return {"already_exists": True, "message": err_json.get("message")}
            print(f"HTTP Error {e.code}: {err_json.get('message', error_body)}")
        except Exception:
            print(f"HTTP Error {e.code}: {error_body}")
        return None
    except Exception as e:
        print(f"Request failed: {e}")
        return None

def main():
    print("=== Appwrite Database Setup ===")
    
    # 1. Create Database
    db_url = f"{ENDPOINT}/databases"
    db_payload = {
        "databaseId": DATABASE_ID,
        "name": "CastDB"
    }
    print(f"Creating database '{DATABASE_ID}'...")
    res = make_request(db_url, "POST", db_payload)
    if res:
        if res.get("already_exists"):
            print("Database already exists.")
        else:
            print("Database created successfully.")
    else:
        print("Failed to create database.")
        return

    # 2. Define collections and attributes
    collections = {
        "schedules": {
            "name": "Schedules",
            "attributes": [
                {"type": "string", "key": "meetingId", "size": 255, "required": True},
                {"type": "string", "key": "title", "size": 255, "required": True},
                {"type": "string", "key": "description", "size": 1000, "required": False},
                {"type": "string", "key": "startsAt", "size": 255, "required": True},
                {"type": "integer", "key": "duration", "required": True},
                {"type": "string", "key": "meetingType", "size": 50, "required": True},
                {"type": "string", "key": "createdBy", "size": 255, "required": True}
            ]
        },
        "chats": {
            "name": "Chats",
            "attributes": [
                {"type": "string", "key": "userId", "size": 255, "required": True},
                {"type": "string", "key": "title", "size": 255, "required": True},
                {"type": "string", "key": "messages", "size": 1048576, "required": True}, # Large text size for chat history
                {"type": "string", "key": "createdAt", "size": 255, "required": True}
            ]
        },
        "recordings": {
            "name": "Recordings",
            "attributes": [
                {"type": "string", "key": "meetingId", "size": 255, "required": True},
                {"type": "string", "key": "title", "size": 255, "required": True},
                {"type": "string", "key": "url", "size": 2048, "required": True},
                {"type": "integer", "key": "duration", "required": True},
                {"type": "string", "key": "createdAt", "size": 255, "required": True}
            ]
        },
        "tasks": {
            "name": "Tasks",
            "attributes": [
                {"type": "string", "key": "userId", "size": 255, "required": True},
                {"type": "string", "key": "title", "size": 255, "required": True},
                {"type": "string", "key": "status", "size": 50, "required": True},
                {"type": "string", "key": "dueDate", "size": 255, "required": False},
                {"type": "string", "key": "createdAt", "size": 255, "required": True}
            ]
        }
    }

    # 3. Create Collections and attributes
    for col_id, col_info in collections.items():
        col_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections"
        col_payload = {
            "collectionId": col_id,
            "name": col_info["name"],
            # Give read("any") and write("any") permissions so client/API can manage
            "permissions": ["read(\"any\")", "write(\"any\")", "create(\"any\")", "update(\"any\")", "delete(\"any\")"]
        }
        print(f"\nCreating collection '{col_info['name']}' ({col_id})...")
        res_col = make_request(col_url, "POST", col_payload)
        if res_col:
            if res_col.get("already_exists"):
                print(f"Collection '{col_id}' already exists.")
            else:
                print(f"Collection '{col_id}' created successfully.")
        else:
            print(f"Failed to create collection '{col_id}'.")
            continue

        # Create attributes for collection
        for attr in col_info["attributes"]:
            attr_type = attr["type"]
            attr_key = attr["key"]
            attr_payload = {
                "key": attr_key,
                "required": attr["required"]
            }
            
            if attr_type == "string":
                attr_payload["size"] = attr["size"]
                attr_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/{col_id}/attributes/string"
            elif attr_type == "integer":
                attr_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/{col_id}/attributes/integer"
            elif attr_type == "boolean":
                attr_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/{col_id}/attributes/boolean"
                
            print(f"  - Creating {attr_type} attribute '{attr_key}'...")
            res_attr = make_request(attr_url, "POST", attr_payload)
            if res_attr:
                if res_attr.get("already_exists"):
                    print(f"    Attribute '{attr_key}' already exists.")
                else:
                    print(f"    Attribute '{attr_key}' created.")
            else:
                print(f"    Failed to create attribute '{attr_key}'.")

    print("\nWaiting for Appwrite to finish processing attributes (10 seconds)...")
    time.sleep(10)
    print("\nDatabase configuration complete! Your Appwrite database 'CastDB' and collections are set up.")

if __name__ == "__main__":
    main()
