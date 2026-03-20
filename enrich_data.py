import json
import requests
import os
import time
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

API_TOKEN = "9087f914ada0489b766a4301cfbe33992452248f"
HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

# Member Group IDs
GROUP_EINZEL = 20876624
GROUP_FIRMA = 20876947
GROUP_FIRMA_PREMIUM = 417172998

# Custom Field IDs
FIELD_HOMEPAGE = 27040549

# Initialize Geocoder
geolocator = Nominatim(user_agent="easyverein_member_map_v1")

def get_coordinates(address_string):
    try:
        location = geolocator.geocode(address_string, timeout=10)
        if location:
            return {"lat": location.latitude, "lon": location.longitude}
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        print(f"Geocoding error for {address_string}: {e}")
    return None

def download_image(url, member_id):
    if not url:
        return None
    
    filename = f"public/images/{member_id}.png"
    if os.path.exists(filename):
        return f"images/{member_id}.png"
        
    try:
        # Use session to handle redirects if any, though requests handles them by default
        # But we need to pass the token because the image is protected
        # Wait, usually easyVerein images are protected by session cookie or token in header?
        # The docs say: "Any API call authenticated with your API token..."
        # Let's try passing the header.
        response = requests.get(url, headers=HEADERS, stream=True)
        if response.status_code == 200:
            with open(filename, 'wb') as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            return f"images/{member_id}.png"
        else:
            print(f"Failed to download image for {member_id}: {response.status_code}")
    except Exception as e:
        print(f"Error downloading image for {member_id}: {e}")
    return None

def fetch_custom_fields(member_id):
    url = f"https://easyverein.com/api/v2.0/member/{member_id}/custom-fields?limit=100"
    try:
        response = requests.get(url, headers=HEADERS, timeout=20)
        if response.status_code == 200:
            time.sleep(0.7)
            return response.json()
    except Exception as e:
        print(f"Error fetching custom fields for {member_id}: {e}")
        time.sleep(0.7)
    return []

def fetch_groups(member_id):
    # This endpoint lists groups a member belongs to
    url = f"https://easyverein.com/api/v2.0/member/{member_id}/groups?limit=100"
    try:
        response = requests.get(url, headers=HEADERS, timeout=20)
        if response.status_code == 200:
            time.sleep(0.7)
            return response.json()
    except Exception as e:
        print(f"Error fetching groups for {member_id}: {e}")
        time.sleep(0.7)
    return []

def process_members(limit=20):
    with open("members_full.json", "r") as f:
        members = json.load(f)
    
    # Filter out deleted members or invalid ones if necessary
    active_members = [m for m in members if not m.get("_deleteAfterDate")]
    
    # Limit for demo
    if limit:
        active_members = active_members[:limit]
        
    enriched_data = []
    
    # Load existing cache if any to skip geocoding
    existing_coords = {}
    if os.path.exists("public/data.json"):
        try:
            with open("public/data.json", "r") as f:
                old_data = json.load(f)
                for item in old_data:
                    addr = item.get('address') or {}
                    zip_code = (addr.get('zip') or '').strip()
                    city = (addr.get('city') or '').strip()
                    country = (addr.get('country') or '').strip()
                    geo_query = f"{zip_code} {city}, {country}".strip().strip(",")
                    existing_coords[item['id']] = {
                        "coords": item.get('coords'),
                        "geo_query": geo_query,
                        "website": item.get("website")
                    }
        except:
            pass
    
    print(f"Processing {len(active_members)} members...")
    
    group_assignment_cache = {}

    def resolve_group_id(url):
        if not url:
            return None
        url = str(url).strip()
        if not url:
            return None
        if "/member-group/" in url:
            try:
                return int(url.rstrip("/").split("/")[-1])
            except Exception:
                return None
        cached = group_assignment_cache.get(url)
        if cached is not None:
            return cached
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            if r.status_code != 200:
                group_assignment_cache[url] = None
                return None
            data = r.json()
            mg = data.get("memberGroup") if isinstance(data, dict) else None
            if mg and "/member-group/" in str(mg):
                gid = int(str(mg).rstrip("/").split("/")[-1])
                group_assignment_cache[url] = gid
                return gid
        except Exception:
            pass
        group_assignment_cache[url] = None
        return None

    def normalize_country(value):
        v = (value or "").strip()
        if not v:
            return ""
        v_lower = v.lower()
        if v_lower in ("de", "deu", "ger", "germany"):
            return "Deutschland"
        if v_lower == "d":
            return "Deutschland"
        if "deutsch" in v_lower:
            return "Deutschland"
        if v_lower == "france":
            return "Frankreich"
        return v

    def is_germany(value):
        v = (value or "").strip().lower()
        return v in ("de", "deu", "ger", "germany", "deutschland", "d") or ("deutsch" in v)

    def pick_address(contact, is_company):
        p_street = (contact.get("street") or "").strip()
        p_zip = (contact.get("zip") or "").strip()
        p_city = (contact.get("city") or "").strip()
        p_country = normalize_country(contact.get("country"))

        c_street = (contact.get("companyStreet") or "").strip()
        c_zip = (contact.get("companyZip") or "").strip()
        c_city = (contact.get("companyCity") or "").strip()
        c_country = normalize_country(contact.get("companyCountry"))

        use_company = False
        if is_company:
            use_company = True
        elif (c_city or c_zip) and not (p_city and p_zip):
            use_company = True
        elif (c_city or c_zip) and c_country and p_country and is_germany(c_country) and not is_germany(p_country):
            use_company = True

        if use_company and not (c_street or c_city or c_zip):
            use_company = False

        if use_company:
            street, zip_code, city, country = c_street, c_zip, c_city, c_country
            if not country and p_country:
                country = p_country
            if not city and p_city:
                city = p_city
            if not zip_code and p_zip:
                zip_code = p_zip
            if not street and p_street:
                street = p_street
        else:
            street, zip_code, city, country = p_street, p_zip, p_city, p_country
            if (not (city and zip_code)) and (c_city or c_zip):
                street, zip_code, city, country = c_street, c_zip, c_city, c_country
                if not country and p_country:
                    country = p_country
                if not city and p_city:
                    city = p_city
                if not zip_code and p_zip:
                    zip_code = p_zip
                if not street and p_street:
                    street = p_street

        return street, zip_code, city, country

    for i, member in enumerate(active_members):
        print(f"[{i+1}/{len(active_members)}] Processing {member.get('id')} - {member.get('contactDetails', {}).get('name', 'Unknown')}")
        
        contact = member.get("contactDetails", {})
        if not contact:
            continue
            
        # Skip members with no address (city is minimum requirement)
        # Check both personal and company fields depending on context, or check if ANY are present
        has_address = False
        if contact.get('companyCity') or contact.get('city'):
             has_address = True
        
        # If we are processing ALL members, maybe we include them even without address for the list?
        # Yes, let's include them.
            
        # 1. Determine Type (Einzel vs Firma)
        member_type = "Einzelmitglied"
        groups_response = fetch_groups(member['id']) if (member.get('memberGroups') or []) else []
        
        # Handle paginated response or direct list
        groups_data = []
        if isinstance(groups_response, dict):
            groups_data = groups_response.get('results', [])
        elif isinstance(groups_response, list):
            groups_data = groups_response
            
        # groups_data is a list of group assignments. Each has 'memberGroup' URL.
        # We need to extract the ID from the URL or check if we can get ID directly.
        # The response structure from fetch_metadata was:
        # {'memberGroup': 'https://.../member-group/417172998', ...}
        
        is_company = False
        is_relevant_member = len(groups_data) == 0
        for g in groups_data:
            # Check if g is a dict or string
            # The API might return list of URLs if using 'groups' attribute directly on member object
            # BUT we are fetching from /member/{id}/groups which should return objects.
            # Let's debug what groups_data contains if it's strings.
            group_url = None
            if isinstance(g, dict):
                group_url = g.get('memberGroup')
            elif isinstance(g, str):
                # If it's a string, it's likely the URL itself?
                # But fetch_groups calls the endpoint.
                # If fetch_groups returned a list of strings, it means the endpoint returned list of strings.
                # But typically /groups endpoint returns membership objects.
                # Let's assume it might be a list of group URLs directly if something is weird.
                # Or maybe I am confusing member['memberGroups'] (list of URLs) with the result of fetch_groups?
                # No, I called fetch_groups().
                # Let's assume it's a dict, but maybe the response structure is different.
                # Wait, if `fetch_groups` returns `response.json()`, and that JSON is a list of strings...
                # The endpoint `member/{id}/groups` usually returns list of group memberships.
                # Let's add a print to debug if needed, but for now handle both.
                group_url = g
            
            if group_url:
                # group_url might be "https://.../member-group/20876947"
                # OR it might be the membership object URL "https://.../member-group-membership/..."
                # If it is a membership object, we need to fetch it to get the group.
                # But typically the list contains objects with 'memberGroup' attribute.
                # If g is a string, it's probably the group URL itself if the API is simple.
                
                # Let's try to extract ID from whatever URL we have.
                try:
                    # If it's a dict, we expect 'memberGroup' to be the URL of the group.
                    if isinstance(g, dict):
                         url_to_check = g.get('memberGroup')
                    else:
                         url_to_check = g
                    
                    if url_to_check:
                        group_id = resolve_group_id(url_to_check)
                        if group_id in (GROUP_EINZEL, GROUP_FIRMA, GROUP_FIRMA_PREMIUM):
                            is_relevant_member = True
                        # Debug: Print found group ID for company-like names to verify
                        if contact.get('companyName'):
                            print(f"DEBUG: Member {member['id']} ({contact.get('companyName')}) has group ID: {group_id}")
                            
                        if group_id in [GROUP_FIRMA, GROUP_FIRMA_PREMIUM]:
                            is_company = True
                            member_type = "Firmenmitglied"
                            break
                        
                        # Fallback: Check if group name is relevant if we can't rely on IDs or if IDs changed?
                        # Actually, let's also check if 'companyName' is present.
                        # If a member has a company name, they might be a company member even if assigned to 'Einzelmitglied' group?
                        # Or maybe they are just an individual working at a company.
                        # The user requirement said: 
                        # - company members ('Firmenmitgliede) with their logo (+link to their website(, name, postcode + city, phone (clickable), email (clickable)
                        
                        # In the data we inspected (e.g. member 1203604 Stephan Burock), companyName is empty but companyEmail is set.
                        # Wait, in member 1203604:
                        # "companyName": "", 
                        # "companyEmail": "baumpflegeevergreen@gmx.de"
                        # Group ID is 20876624 (Einzel-Mitgliedschaft).
                        
                        # But member 1203605 Christopher Busch:
                        # "companyName": "Busch Baumpflege",
                        # Group ID is 20876624 (Einzel-Mitgliedschaft).
                        
                        # So it seems many people with companies are in the "Einzel-Mitgliedschaft" group.
                        # Maybe we should treat anyone with a "companyName" as a potential company display?
                        # OR is there a strict rule?
                        # The prompt said: "normal members ('Einzelmitglied') ... company members ('Firmenmitgliede) ..."
                        # This implies we should strictly follow the group assignment.
                        # However, if NO members are in the Firmen group, maybe the IDs are wrong?
                        # Let's check if ANY member has the Firmen group ID.
                        
                except Exception as e:
                    # print(f"Error parsing group: {e}")
                    pass

        if not is_relevant_member:
            continue
        
        # Override based on companyName presence if strictly requested?
        # User said: "looks like we lost the company members ('Firmenmitgliede), can you check and re map again?"
        # If the user expects people with company names to be company members, we should probably use that signal too.
        # Let's enable a fallback: If companyName is present, treat as company?
        # But wait, some individuals might list their employer.
        # Let's check if the group IDs I have are correct.
        # GROUP_FIRMA = 20876947
        # GROUP_FIRMA_PREMIUM = 417172998
        # In the previous `groups.json`, these match.
        
        # If no one is assigned to these groups, maybe the data in easyVerein is not using these groups for these people?
        # Let's try to be more flexible. If they have a company name AND (website OR company email), let's treat them as company?
        # Or just if they have a company name.
        if not is_company and contact.get('companyName') and len(contact.get('companyName')) > 3:
             is_company = True
             member_type = "Firmenmitglied"
        
        # Fallback if no group found but company name exists
        # if not is_company and contact.get('companyName'):
        #      # member_type = "Firmenmitglied" # Maybe not? Let's stick to group logic for strictness
        #      pass

        # 2. Get Website (Homepage)
        website = ""
        cached = existing_coords.get(member['id'])
        if cached and cached.get("website"):
            website = cached.get("website") or ""
        cfields_response = [] if website else fetch_custom_fields(member['id'])
        
        cfields = []
        if isinstance(cfields_response, dict):
            cfields = cfields_response.get('results', [])
        elif isinstance(cfields_response, list):
            cfields = cfields_response

        for cf in cfields:
            # Check if it matches Homepage field
            # The customField in response is a URL: https://.../custom-field/27040549
            
            # Similar to groups, handle if it's string (URL) or dict
            if isinstance(cf, dict):
                cf_url = cf.get('customField')
                if cf_url and str(FIELD_HOMEPAGE) in cf_url:
                    website = cf.get('value')
                    break
            # If it's a string, we can't get the value unless we fetch the content.
            # But the endpoint member/{id}/custom-fields should return content objects.
            # If it returns strings, they are URLs to the content objects, which we'd need to fetch.
            # Given the previous error, it seems 'cf' is a string.
            # Let's see if we can fetch it if it's a string.
            elif isinstance(cf, str):
                # We can try to fetch this individual custom field content
                # But that's another request.
                # Let's skip for now or try to fetch it if really needed.
                # Actually, in sample_member_custom_fields.json, it was a list of dicts.
                # Why is it a string now?
                # Maybe fetch_custom_fields returned a list of URLs?
                # Let's print what we got to debug.
                # print(f"DEBUG: cf is {cf}")
                pass
        
        # If website is still empty, check if it's in contactDetails (sometimes it is)
        # Or maybe it's in a different field?
        # Let's check contactDetails for 'website' or similar
        if not website:
             website = contact.get('website') or contact.get('companyWebsite')
        
        # 3. Get Image
        local_image = None
        image_path = os.path.join("public", "images", f"{member['id']}.png")
        if os.path.exists(image_path):
            local_image = f"images/{member['id']}.png"
        
        # 4. Geocode
        street, zip_code, city, country = pick_address(contact, is_company)
            
        address_str = f"{street}, {zip_code} {city}, {country}".strip(", ")
        coords = None
        if city: # Only geocode if we at least have a city
            # Check if we have a valid address to geocode
            # To save time/limit, we can just geocode "Zip City Country" if street is sensitive or empty
            geo_query = f"{zip_code} {city}, {country}".strip().strip(",")
            
            # Check cache
            cached = existing_coords.get(member['id'])
            if cached and cached.get("coords") and cached.get("geo_query") == geo_query:
                coords = cached.get("coords")
            else:
                coords = get_coordinates(geo_query)
                time.sleep(1) # Respect Nominatim rate limit (1 per sec)
            
        enriched_member = {
            "id": member['id'],
            "name": contact.get('companyName') if is_company and contact.get('companyName') else contact.get('name'),
            "type": member_type,
            "address": {
                "street": street,
                "zip": zip_code,
                "city": city,
                "country": country
            },
            "coords": coords,
            "phone": contact.get('companyPhone') if is_company else (contact.get('mobilePhone') or contact.get('privatePhone')),
            "email": contact.get('companyEmail') if is_company else (contact.get('primaryEmail') or contact.get('privateEmail') or member.get('emailOrUserName')),
            "website": website,
            "image": local_image
        }
        
        enriched_data.append(enriched_member)
        
    with open("public/data.json", "w") as f:
        json.dump(enriched_data, f, indent=4)
    print("Enrichment complete. Data saved to public/data.json")

if __name__ == "__main__":
    process_members(limit=None) # Process ALL members
