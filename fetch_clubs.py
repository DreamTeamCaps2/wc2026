"""
Fetch club info for all WC 2026 players from Football-Data.org /v4/persons/{id} API.
Updates existing squads.json with currentTeam data.
Rate limit: 10 requests/minute → ~6.5s per request.
Total: ~1200 players → ~2 hours. Script saves progress every 5 players.
"""
import urllib.request
import urllib.error
import json
import time
import os

API_KEY = 'ae4fa7a0fdd2472b861033c12c518797'
BASE_URL = 'https://api.football-data.org/v4'
SQUADS_PATH = os.path.join(os.path.dirname(__file__), 'public', 'data', 'squads.json')
PROGRESS_PATH = os.path.join(os.path.dirname(__file__), 'public', 'data', 'fetch_progress.json')

def fetch_json(url):
    req = urllib.request.Request(url)
    req.add_header('X-Auth-Token', API_KEY)
    
    max_retries = 5
    backoff = 10
    
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"\n[Rate Limit 429] Sleeping {backoff}s before retry (attempt {attempt+1}/{max_retries})...")
                time.sleep(backoff)
                backoff *= 2
                continue
            else:
                raise e
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"\n[Network Error {e}] Sleeping {backoff}s before retry (attempt {attempt+1}/{max_retries})...")
            time.sleep(backoff)
            backoff *= 2
            continue
            
    raise Exception(f"Failed to fetch {url} after {max_retries} attempts")

def save_squads(data):
    with open(SQUADS_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_progress():
    if os.path.exists(PROGRESS_PATH):
        try:
            with open(PROGRESS_PATH, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {'completed_ids': []}

def save_progress(progress):
    with open(PROGRESS_PATH, 'w') as f:
        json.dump(progress, f)

def main():
    # Step 1: Re-fetch squads with player IDs (the current squads.json may not have IDs)
    print("Step 1: Re-fetching team squads with player IDs...")
    with open(SQUADS_PATH, 'r', encoding='utf-8') as f:
        squads = json.load(f)

    # Check if we need to re-fetch (if first player has no 'id' field)
    first_team = next(iter(squads.values()))
    squad_list = first_team.get('squad', [])
    first_player = squad_list[0] if squad_list else {}
    
    if 'id' not in first_player:
        print("  squads.json missing player IDs. Re-fetching teams...")
        for team_id, team_data in squads.items():
            print(f"  Fetching team {team_data['name']} (ID: {team_id})...")
            try:
                data = fetch_json(f'{BASE_URL}/teams/{team_id}')
                new_squad = []
                for p in data.get('squad', []):
                    new_squad.append({
                        'id': p.get('id'),
                        'name': p.get('name', ''),
                        'position': p.get('position', 'Midfield'),
                        'dateOfBirth': p.get('dateOfBirth', ''),
                        'nationality': p.get('nationality', ''),
                        'shirtNumber': p.get('shirtNumber')
                    })
                team_data['squad'] = new_squad
                save_squads(squads) # Save progress after each team in step 1
            except Exception as e:
                print(f"    ERROR fetching team: {e}")
            time.sleep(6.5)
        print(f"  Updated squads.json with player IDs.")
    else:
        print("  Player IDs already present. Skipping re-fetch.")

    # Step 2: Fetch club info for each player
    print("\nStep 2: Fetching club info for each player...")
    progress = load_progress()
    completed = set(progress.get('completed_ids', []))

    # Collect all players who don't have club info yet
    all_players = []
    for team_id, team_data in squads.items():
        for i, player in enumerate(team_data.get('squad', [])):
            pid = player.get('id')
            # Check if player has id, is not in completed, and does not have currentTeam already in json
            if pid and pid not in completed and 'currentTeam' not in player:
                all_players.append((team_id, i, pid, player.get('name', '?')))

    total = len(all_players)
    print(f"  {total} players remaining to fetch club info for (already completed/skipped: {len(completed)})")

    for idx, (team_id, player_idx, pid, pname) in enumerate(all_players):
        print(f"  [{idx+1}/{total}] {pname} (ID: {pid})...", end=' ', flush=True)
        try:
            data = fetch_json(f'{BASE_URL}/persons/{pid}')
            ct = data.get('currentTeam')
            if ct:
                squads[team_id]['squad'][player_idx]['currentTeam'] = {
                    'name': ct.get('name', ''),
                    'shortName': ct.get('shortName', ''),
                    'crest': ct.get('crest', ''),
                    'country': ct.get('area', {}).get('name', '')
                }
                print(f"{ct.get('shortName', 'N/A')}")
            else:
                squads[team_id]['squad'][player_idx]['currentTeam'] = None
                print("No club")
            completed.add(pid)
        except urllib.error.HTTPError as e:
            print(f"HTTP ERROR {e.code}")
        except Exception as e:
            print(f"ERROR: {e}")

        # Save progress every 5 players
        if (idx + 1) % 5 == 0 or idx == total - 1:
            save_squads(squads)
            save_progress({'completed_ids': list(completed)})

        time.sleep(6.5)

    # Cleanup progress file
    if os.path.exists(PROGRESS_PATH):
        try:
            os.remove(PROGRESS_PATH)
        except Exception:
            pass

    print(f"\nDone! Updated {len(completed)} players with club info in {SQUADS_PATH}")

if __name__ == '__main__':
    main()
