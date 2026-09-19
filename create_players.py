import json
import pandas as pd
from nba_api.stats.endpoints import playerindex


# Get active NBA players
response = playerindex.PlayerIndex(
    active_nullable="1"
)

df = response.get_data_frames()[0]


# Keep only players currently on a team
df = df[
    (df["ROSTER_STATUS"] == 1) &
    (df["TEAM_ID"] != 0)
].copy()


players = []

for _, row in df.iterrows():

    player = player = {
        "id": int(row["PERSON_ID"]),
        "first_name": row["PLAYER_FIRST_NAME"],
        "last_name": row["PLAYER_LAST_NAME"],

        "position": (
            None if pd.isna(row["POSITION"])
            else row["POSITION"]
        ),

        "jersey_number": (
            None if pd.isna(row["JERSEY_NUMBER"])
            else str(row["JERSEY_NUMBER"])
        ),

        "draft_year": (
            None if pd.isna(row["DRAFT_YEAR"])
            else int(row["DRAFT_YEAR"])
        ),

        "college": (
            None if pd.isna(row["COLLEGE"])
            else row["COLLEGE"]
        ),

        "team": {
            "full_name": f'{row["TEAM_CITY"]} {row["TEAM_NAME"]}',
            "abbreviation": row["TEAM_ABBREVIATION"]
        }
    }

    players.append(player)


with open("players.json", "w") as file:
    json.dump(players, file, indent=4, allow_nan=False)


print(f"Saved {len(players)} active NBA players to players.json")