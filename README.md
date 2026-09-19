# APIAPP - Guess the NBA Player

Guess the NBA Player is an interactive web game where users try to identify a randomly selected active NBA player. Players can reveal up to five clues — position, jersey number, draft year, college, and current NBA team — with the number of available points decreasing after each clue. The game also includes an animated basketball shot that progresses toward the hoop as clues are revealed.

## How to Play

1. Start with 1,000 possible points.
2. Enter an NBA player's name and submit your guess.
3. If you need help, click **Reveal Next Clue**.
4. Each revealed clue moves the basketball farther along its shot trajectory and decreases the number of points available.
5. Correct guesses complete the shot and add the remaining points to your total score.
6. If you give up, the correct player is revealed.
7. Click **New Player** to play another round.

## API and Data

This project uses the Python `nba_api` package to retrieve NBA player data from NBA.com. The `PlayerIndex` endpoint is called with `active_nullable="1"` to request active NBA players, and the returned data is converted into a pandas DataFrame. The data is filtered to include players currently on an NBA roster, and fields including player name, position, jersey number, draft year, college, and current NBA team are selected.

The processed player information is saved as a JSON array in `players.json`. The JavaScript application uses `fetch()` to load this JSON data, randomly select players, generate clues, and populate the player-name autocomplete menu. No API key or authentication is required to use `nba_api`.

## Technologies Used

- HTML
- CSS
- JavaScript
- Python
- `nba_api`
- pandas
- JSON
- GitHub Pages

## Running the Project Locally

### 1. Clone the repository

```bash
git clone YOUR-REPOSITORY-URL
cd YOUR-REPOSITORY-NAME
```

### 2. Create a virtual environment (recommended)

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install the required Python packages

```bash
pip install nba_api pandas
```

### 4. Generate the player data

Run:

```bash
python create_players.py
```

This retrieves the active NBA player data and creates/updates `players.json`.

### 5. Start a local web server

```bash
python3 -m http.server 8000
```

### 6. Open the game

Open the following address in your browser:

```text
http://localhost:8000/
```

A local web server is recommended instead of opening `index.html` directly because the JavaScript application uses `fetch()` to load `players.json`.


## Deployment

The game is deployed using GitHub Pages. Because the processed NBA data is stored in `players.json`, the deployed website can run entirely through HTML, CSS, and JavaScript without requiring a Python backend.

To update the player pool in the future, run:

```bash
python create_players.py
```

Then commit and push the updated `players.json` file to GitHub so the game can be accessed using GitHub Pages.

## Author

Nicole Timko