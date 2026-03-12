import requests
import json

API_TOKEN = "9087f914ada0489b766a4301cfbe33992452248f"
BASE_URL = "https://easyverein.com/api/v2.0"
HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

def fetch_data(endpoint):
    items = []
    url = f"{BASE_URL}/{endpoint}?limit=100"
    
    while url:
        print(f"Fetching {endpoint}: {url}")
        try:
            response = requests.get(url, headers=HEADERS)
            response.raise_for_status()
            data = response.json()
            
            if isinstance(data, list):
                items.extend(data)
                url = None 
            elif isinstance(data, dict):
                results = data.get("results", [])
                items.extend(results)
                url = data.get("next")
            else:
                break
                
        except Exception as e:
            print(f"Error fetching {endpoint}: {e}")
            break
            
    return items

def main():
    # Fetch Groups
    groups = fetch_data("member-group")
    with open("groups.json", "w") as f:
        json.dump(groups, f, indent=4)
    print(f"Fetched {len(groups)} groups.")

    # Fetch Custom Fields
    custom_fields = fetch_data("custom-field")
    with open("custom_fields_definitions.json", "w") as f:
        json.dump(custom_fields, f, indent=4)
    print(f"Fetched {len(custom_fields)} custom field definitions.")

    # Fetch Custom Field Values (just for one member to see structure)
    # We will pick a member ID from members_full.json manually later or just fetch all
    # But fetching ALL custom field values is huge (N members * M fields).
    # Instead, let's fetch custom fields for the first member we saw (ID: 1203571)
    # The endpoint is /member/{id}/custom-fields
    
    member_id = 1203571
    member_custom_fields = fetch_data(f"member/{member_id}/custom-fields")
    with open("sample_member_custom_fields.json", "w") as f:
        json.dump(member_custom_fields, f, indent=4)
    print(f"Fetched {len(member_custom_fields)} custom fields for member {member_id}.")

if __name__ == "__main__":
    main()
