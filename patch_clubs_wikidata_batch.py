"""
Batch patch squads.json with real professional clubs using Wikidata SPARQL.
Queries players in batches of 150 to avoid rate limits, and uses robust sorting
and birth-year matching.
"""
import urllib.request
import urllib.parse
import json
import os
import hashlib
import time
import sys

# Ensure UTF-8 output on Windows terminal to avoid UnicodeEncodeError
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

SQUADS_PATH = os.path.join(os.path.dirname(__file__), 'public', 'data', 'squads.json')

# List of national team names to filter out
NATIONAL_TEAMS = {
    'Algeria', 'Argentina', 'Australia', 'Austria', 'Belgium', 'Bosnia', 'Brazil', 'Canada',
    'Czechia', 'Ecuador', 'Egypt', 'France', 'Germany', 'Haiti', 'Iran', 'Iraq', 'Japan',
    'Jordan', 'Morocco', 'Mexico', 'Netherlands', 'New Zealand', 'Norway', 'Portugal',
    'Qatar', 'Saudi Arabia', 'Scotland', 'Senegal', 'South Africa', 'South Korea', 'Spain',
    'Sweden', 'Switzerland', 'Tunisia', 'Turkey', 'United States', 'Uruguay', 'Uzbekistan',
    'Colombia', 'Croatia', 'DR Congo', 'Ghana', 'Panama', 'Côte d\'Ivoire', 'Bosnia and Herzegovina',
    'Korea Republic', 'USA', 'Morocco', 'Korea', 'Hàn Quốc', 'Mỹ', 'Bỉ', 'Pháp', 'Anh',
    'Tây Ban Nha', 'Bồ Đào Nha', 'Đức', 'Hà Lan', 'Ý', 'Croatia', 'Uruguay', 'Colombia', 'Senegal',
    'Morocco', 'Nhật Bản', 'Mexico', 'Thụy Điển', 'Đan Mạch', 'Thụy Sĩ', 'Áo', 'Thổ Nhĩ Kỳ',
    'Ecuador', 'Canada', 'Nigeria', 'Czechia', 'Ai Cập', 'Tunisia', 'Iran', 'Paraguay', 'Úc',
    'Ả Rập Saudi', 'Nam Phi', 'Na Uy', 'Iraq', 'Uzbekistan', 'DR Congo', 'Ghana', 'Panama',
    'Jordan', 'Haiti', 'Curaçao', 'Cabo Verde', 'New Zealand', 'Scotland', 'Bờ Biển Ngà'
}

def query_wikidata_batch(player_names):
    # Escape quotes for SPARQL VALUES block
    escaped_names = []
    for name in player_names:
        # Avoid names with backslashes or invalid characters
        clean_name = name.replace('"', '\\"')
        escaped_names.append(f'"{clean_name}"@en')
        # Also try other languages if name has accents
        escaped_names.append(f'"{clean_name}"@fr')
        escaped_names.append(f'"{clean_name}"@es')
        escaped_names.append(f'"{clean_name}"@de')
        escaped_names.append(f'"{clean_name}"@pt')

    query = """
    SELECT ?playerName ?clubLabel ?clubCrest ?clubCountryLabel ?birthDate ?startDate ?endDate WHERE {
      VALUES ?playerName { %s }
      ?player wdt:P106 wd:Q937857.
      ?player rdfs:label ?playerName.
      
      OPTIONAL { ?player wdt:P569 ?birthDate. }
      
      ?player p:P54 ?statement.
      ?statement ps:P54 ?club.
      
      OPTIONAL { ?statement pq:P580 ?startDate. }
      OPTIONAL { ?statement pq:P582 ?endDate. }
      
      ?club rdfs:label ?clubLabel.
      FILTER(LANG(?clubLabel) = 'en')
      
      # Filter out national/youth teams
      FILTER(!CONTAINS(LCASE(?clubLabel), "national"))
      FILTER(!CONTAINS(LCASE(?clubLabel), "youth"))
      FILTER(!CONTAINS(LCASE(?clubLabel), "selection"))
      FILTER(!CONTAINS(LCASE(?clubLabel), "under-"))
      FILTER(!CONTAINS(LCASE(?clubLabel), "u-2"))
      FILTER(!CONTAINS(LCASE(?clubLabel), "u-1"))
      FILTER(!CONTAINS(LCASE(?clubLabel), "olympic"))
      
      OPTIONAL { ?club wdt:P154 ?clubCrest. }
      OPTIONAL { ?club wdt:P17 ?clubCountry. ?clubCountry rdfs:label ?clubCountryLabel. FILTER(LANG(?clubCountryLabel) = 'en') }
    }
    """ % ' '.join(escaped_names)

    # Encode query for POST request
    post_data = urllib.parse.urlencode({'query': query}).encode('utf-8')

    req = urllib.request.Request(
        'https://query.wikidata.org/sparql',
        data=post_data,
        headers={
            'User-Agent': 'WC2026App/2.0 (contact@example.com) Python-urllib/3.x', 
            'Accept': 'application/sparql-results+json',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('results', {}).get('bindings', [])
    except Exception as e:
        print(f"  Error querying Wikidata batch: {e}")
        return []

def select_best_club(results_for_player, player_birth_year):
    # Filter by birth year if available
    valid_results = []
    for r in results_for_player:
        bd = r.get('birthDate', {}).get('value', '')
        if bd:
            # Extract year
            try:
                by = bd.split('-')[0]
                if by != player_birth_year:
                    continue # Birth year mismatch
            except Exception:
                pass
        valid_results.append(r)

    if not valid_results:
        # Fallback to all if birth year filter left nothing
        valid_results = results_for_player

    if not valid_results:
        return None

    # Sorting key logic:
    # 1. Latest start date first
    # 2. If no start date, check if no end date
    def sort_key(r):
        start_date = r.get('startDate', {}).get('value', '')
        end_date = r.get('endDate', {}).get('value', '')
        return (1 if start_date else 0, start_date, 1 if not end_date else 0)

    # Sort descending
    valid_results.sort(key=sort_key, reverse=True)
    best = valid_results[0]
    
    club_name = best.get('clubLabel', {}).get('value')
    club_crest = best.get('clubCrest', {}).get('value')
    club_country = best.get('clubCountryLabel', {}).get('value', '')
    
    # Process crest file name to upload url if necessary (if it is just Commons filename)
    if club_crest and not club_crest.startswith('http'):
        # Sometimes Wikidata returns file name instead of full URL
        try:
            club_crest = club_crest.replace(' ', '_')
            md5_hash = hashlib.md5(club_crest.encode('utf-8')).hexdigest()
            club_crest = f"https://upload.wikimedia.org/wikipedia/commons/{md5_hash[0]}/{md5_hash[0:2]}/{club_crest}"
        except Exception:
            pass

    return {
        'name': club_name,
        'shortName': club_name.replace(' F.C.', '').replace(' FC', '').replace(' CF', '').replace(' Real ', ' ').replace(' Athletic ', ' '),
        'crest': club_crest or '',
        'country': club_country
    }

def main():
    print("Loading squads.json...")
    with open(SQUADS_PATH, 'r', encoding='utf-8') as f:
        squads = json.load(f)

    # Gather all players needing a club
    players_to_query = []
    player_map = {} # Maps (playerName, birthYear) to list of (teamId, playerIdx)
    
    for team_id, team_data in squads.items():
        team_country = team_data.get('name', '')
        for i, player in enumerate(team_data.get('squad', [])):
            pname = player.get('name')
            pdob = player.get('dateOfBirth', '')
            pyear = pdob.split('-')[0] if pdob else ''
            
            ct = player.get('currentTeam')
            is_national = False
            if ct:
                ct_name = ct.get('name', '')
                if ct_name in NATIONAL_TEAMS or ct_name == team_country or ct_name == team_data.get('shortName', ''):
                    is_national = True
            
            if not ct or is_national:
                # Add to query list
                key = (pname, pyear)
                if key not in player_map:
                    player_map[key] = []
                    players_to_query.append({'name': pname, 'year': pyear})
                player_map[key].append((team_id, i))

    total_players = len(players_to_query)
    print(f"Found {total_players} unique players requiring real club info.")
    if total_players == 0:
        print("All players have clubs. Done!")
        return

    # Split into batches of 100
    batch_size = 100
    batches = [players_to_query[i:i + batch_size] for i in range(0, total_players, batch_size)]
    
    print(f"Processing in {len(batches)} batches of up to {batch_size} players...")
    patched_count = 0
    
    for b_idx, batch in enumerate(batches):
        print(f"\n--- Batch {b_idx+1}/{len(batches)} (Size: {len(batch)}) ---")
        batch_names = [p['name'] for p in batch]
        
        # Query Wikidata
        results = query_wikidata_batch(batch_names)
        print(f"  Received {len(results)} raw rows from Wikidata.")
        
        # Group results by player label
        grouped_results = {}
        for r in results:
            p_label = r.get('playerName', {}).get('value')
            if p_label not in grouped_results:
                grouped_results[p_label] = []
            grouped_results[p_label].append(r)
            
        # Match each player in batch
        for player in batch:
            pname = player['name']
            pyear = player['year']
            
            # Find matching results
            p_results = grouped_results.get(pname, [])
            
            # Resolve best club
            club_info = select_best_club(p_results, pyear)
            
            # Apply to all instances in squads.json
            instances = player_map.get((pname, pyear), [])
            for team_id, idx in instances:
                if club_info:
                    squads[team_id]['squad'][idx]['currentTeam'] = club_info
                else:
                    # Clear or keep national if missing
                    # Since national team is redundant, we set to None to avoid displaying national team as club
                    squads[team_id]['squad'][idx]['currentTeam'] = None
            
            if club_info:
                print(f"  {pname} ({pyear}) -> {club_info['name']} ({club_info['country']})")
                patched_count += 1
            else:
                print(f"  {pname} ({pyear}) -> No club found")

        # Save progress after each batch
        with open(SQUADS_PATH, 'w', encoding='utf-8') as f:
            json.dump(squads, f, ensure_ascii=False, indent=2)
            
        # Be nice to Wikidata query service
        if b_idx < len(batches) - 1:
            print("  Sleeping 6 seconds before next batch...")
            time.sleep(6)

    print(f"\nDone! Successfully patched {patched_count} players out of {total_players} in {SQUADS_PATH}")

if __name__ == '__main__':
    main()
