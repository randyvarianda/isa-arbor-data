import requests
import json
import time

API_TOKEN = "9087f914ada0489b766a4301cfbe33992452248f"
BASE_URL = "https://easyverein.com/api/v2.0"
HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

def fetch_all_items(endpoint):
    items = []
    url = f"{BASE_URL}/{endpoint}?limit=100"
    
    while url:
        print(f"Fetching {endpoint}: {url}")
        try:
            response = requests.get(url, headers=HEADERS)
            response.raise_for_status()
            data = response.json()
            
            # Check if the response is a list (some APIs return list directly) or a dict with results
            if isinstance(data, list):
                items.extend(data)
                print(f"Received list of {len(data)} items.")
                url = None 
            elif isinstance(data, dict):
                if "count" in data and not items:
                     print(f"Total {endpoint} available according to API: {data['count']}")
                results = data.get("results", [])
                items.extend(results)
                url = data.get("next")
            else:
                print("Unknown data format.")
                break
                
        except requests.exceptions.RequestException as e:
            print(f"Error fetching data: {e}")
            break
            
    print(f"Total {endpoint} fetched: {len(items)}")
    return items

def main():
    members = fetch_all_items("member")
    contact_details = fetch_all_items("contact-details")
    
    # Create a lookup for contact details by ID
    contact_lookup = {item["id"]: item for item in contact_details}
    
    # Merge contact details into members
    for member in members:
        contact_url = member.get("contactDetails")
        if contact_url and isinstance(contact_url, str):
            # Extract ID from URL
            try:
                contact_id = int(contact_url.rstrip("/").split("/")[-1])
                if contact_id in contact_lookup:
                    member["contactDetails"] = contact_lookup[contact_id]
            except (ValueError, IndexError):
                pass

    with open("members_full.json", "w") as f:
        json.dump(members, f, indent=4)
    print("Data saved to members_full.json")
    
    # Also save raw files if needed
    with open("members_raw.json", "w") as f:
        json.dump(members, f, indent=4) # Note: members is modified in place, so this will be the same as members_full
                                        # If we wanted raw, we should have saved it before merging or deepcopied.
                                        # But members_full is what the user likely wants.
    
    # Let's save contact details separately too
    with open("contact_details.json", "w") as f:
        json.dump(contact_details, f, indent=4)
    print("Contact details saved to contact_details.json")

if __name__ == "__main__":
    main()
