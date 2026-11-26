import urllib.request
import json
import time

from _env import ENDPOINT, PROJECT_ID, API_KEY, DATABASE_ID  # secrets come from .env.local

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
    print("=== Appwrite Chats & Messages Schema Rebuild ===")
    
    # 1. Delete old chats collection if it exists
    chats_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/chats"
    print("Deleting old 'chats' collection if it exists...")
    make_request(chats_url, "DELETE")
    
    # Wait a moment for deletion to finalize
    time.sleep(2)
    
    # 2. Re-create 'chats' collection
    create_col_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections"
    chats_payload = {
        "collectionId": "chats",
        "name": "Chats",
        "permissions": []
    }
    print("Creating new 'chats' collection...")
    make_request(create_col_url, "POST", chats_payload)
    
    # 3. Create 'messages' collection
    messages_payload = {
        "collectionId": "messages",
        "name": "Messages",
        "permissions": []
    }
    print("Creating new 'messages' collection...")
    make_request(create_col_url, "POST", messages_payload)
    
    # 4. Define attributes
    chats_attributes = [
        {"type": "string", "key": "userId", "size": 255, "required": True},
        {"type": "string", "key": "title", "size": 255, "required": True},
        {"type": "boolean", "key": "pinned", "required": True},
        {"type": "boolean", "key": "deleted", "required": True},
        {"type": "integer", "key": "messageCount", "required": True},
        {"type": "string", "key": "createdAt", "size": 255, "required": True},
        {"type": "string", "key": "updatedAt", "size": 255, "required": True}
    ]
    
    messages_attributes = [
        {"type": "string", "key": "chatId", "size": 255, "required": True},
        {"type": "string", "key": "userId", "size": 255, "required": True},
        {"type": "string", "key": "role", "size": 50, "required": True},
        {"type": "string", "key": "content", "size": 1048576, "required": True},
        {"type": "string", "key": "createdAt", "size": 255, "required": True}
    ]
    
    # 5. Create Chats attributes
    print("\nCreating attributes for 'chats'...")
    for attr in chats_attributes:
        attr_type = attr["type"]
        attr_key = attr["key"]
        attr_payload = {"key": attr_key, "required": attr["required"]}
        
        if attr_type == "string":
            attr_payload["size"] = attr["size"]
            attr_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/chats/attributes/string"
        elif attr_type == "integer":
            attr_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/chats/attributes/integer"
        elif attr_type == "boolean":
            attr_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/chats/attributes/boolean"
            
        print(f"  - Creating {attr_type} attribute '{attr_key}'...")
        make_request(attr_url, "POST", attr_payload)

    # 6. Create Messages attributes
    print("\nCreating attributes for 'messages'...")
    for attr in messages_attributes:
        attr_type = attr["type"]
        attr_key = attr["key"]
        attr_payload = {"key": attr_key, "required": attr["required"]}
        
        if attr_type == "string":
            attr_payload["size"] = attr["size"]
            attr_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/messages/attributes/string"
        elif attr_type == "integer":
            attr_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/messages/attributes/integer"
        elif attr_type == "boolean":
            attr_url = f"{ENDPOINT}/databases/{DATABASE_ID}/collections/messages/attributes/boolean"
            
        print(f"  - Creating {attr_type} attribute '{attr_key}'...")
        make_request(attr_url, "POST", attr_payload)

    print("\nWaiting 10 seconds for Appwrite indexing...")
    time.sleep(10)
    print("\nChats and Messages collections are successfully rebuilt!")

if __name__ == "__main__":
    main()
