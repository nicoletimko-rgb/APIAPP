/* =====================================================
   GUESS THE NBA PLAYER — SHOT TRACKER

   Game logic is unchanged from the original version.
   What's new is the presentation layer:

     - clues render as rows of a feature table
     - the shot arc is plotted as an SVG trajectory
     - each revealed clue drops a tracked sample point
     - the HUD readouts update every turn
===================================================== */


/* =====================================================
   CONFIGURATION
===================================================== */

const API_URL = "players.json";

/* =====================================================
   GAME STATE
===================================================== */

let players = [];
let mysteryPlayer = null;
let clueNumber = 0;
let score = 1000;
let gameOver = false;
let selectedSuggestionIndex = -1;
let plottedIndex = 0;          // how far along the arc the line is drawn
let totalPoints = 0;
let playersGuessedCorrectly = 0;
let playersAttempted = 0;

/* =====================================================
   SHOT ARC

   Each object is one point on the shot.
   bottom rises and then falls, producing the arc.

   Position 0 is the release point, up at the
   shooter's hand.
===================================================== */

const shotPositions = [
    { left: 7,  bottom: 150 },   // release
    { left: 18, bottom: 205 },   // feature 1
    { left: 30, bottom: 245 },   // feature 2
    { left: 43, bottom: 272 },   // feature 3
    { left: 57, bottom: 278 },   // feature 4 — apex
    { left: 69, bottom: 265 }    // feature 5 — descending
];


/*
    The rest of the arc, used only to draw the
    projected (dashed) path toward the rim.
*/

const projectedFinish = [
    { left: 76, bottom: 235 },
    { left: 81, bottom: 190 },
    { left: 84, bottom: 145 },
    { left: 85, bottom: 110 }
];


/* Readout tables, indexed by clues revealed. */

const SCORES     = [1000, 800, 600, 400, 200, 100];
const CERTAINTY  = [12, 28, 44, 61, 79, 93];
const ARC_PCT    = [0, 18, 36, 54, 72, 86];
const DECAY      = ["FULL", "-20%", "-40%", "-60%", "-80%", "-90%"];


/* =====================================================
   ELEMENTS
===================================================== */
const rim               = document.getElementById("rim");
const root              = document.getElementById("shot-tracker");
const court             = document.getElementById("court");
const basketball        = document.getElementById("basketball");
const cluesContainer    = document.getElementById("clues");
const scoreDisplay      = document.getElementById("score");
const scoreBar          = document.getElementById("score-bar");
const guessInput        = document.getElementById("guess-input");
const suggestionsContainer = document.getElementById("suggestions");
const message           = document.getElementById("message");

const clueButton        = document.getElementById("clue-button");
const guessButton       = document.getElementById("guess-button");
const giveUpButton      = document.getElementById("give-up-button");
const newGameButton     = document.getElementById("new-game-button");

const liveLabel         = document.getElementById("live-label");
const phaseLabel        = document.getElementById("phase");
const trackId           = document.getElementById("track-id");
const featureCount      = document.getElementById("feature-count");
const featuresMeta      = document.getElementById("features-meta");
const certaintyOut      = document.getElementById("certainty");
const arcOut            = document.getElementById("arc-pct");
const decayOut          = document.getElementById("decay");
const ticks             = document.querySelectorAll(".st-ticks i");

const plot              = document.getElementById("plot");
const pathProjected     = document.getElementById("path-projected");
const pathFlown         = document.getElementById("path-flown");


/* =====================================================
   API REQUEST
===================================================== */

async function loadPlayers() {

    try {

        const response = await fetch("players.json");

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const result = await response.json();

        players = result.filter(player =>
            player.first_name &&
            player.last_name &&
            player.position &&
            player.team &&
            player.team.full_name
        );

        console.log("Players loaded:", players.length);
        console.log("Example player:", players[0]);

        updateGameStats();

        startGame();

    } catch (error) {

        console.error("PLAYER LOAD ERROR:", error);

        message.textContent =
            "Couldn't load the player pool. Check the browser console.";

        setPhase("NO SIGNAL");
    }
}


/* =====================================================
   CONTROLS
===================================================== */

function enableGameControls() {
    clueButton.disabled = false;
    guessButton.disabled = false;
    guessInput.disabled = false;
    giveUpButton.disabled = false;
    newGameButton.disabled = false;
}


function disableFinishedGame() {
    clueButton.disabled = true;
    guessButton.disabled = true;
    guessInput.disabled = true;
    giveUpButton.disabled = true;

    /* New Player stays live. */
    newGameButton.disabled = false;
}


/* =====================================================
   START GAME
===================================================== */

function startGame() {

    if (players.length === 0) {
        message.textContent = "Player pool hasn't loaded yet.";
        return;
    }

    mysteryPlayer = players[Math.floor(Math.random() * players.length)];

    clueNumber = 0;
    score = 1000;
    gameOver = false;
    selectedSuggestionIndex = -1;

    root.classList.remove("is-made", "is-missed");
    root.classList.add("is-ready");

    cluesContainer.innerHTML =
        `<p class="st-empty">No features revealed. Guess blind for the full 1000.</p>`;

    guessInput.value = "";
    suggestionsContainer.innerHTML = "";

    trackId.textContent = mysteryPlayer.id
        ? "#" + String(mysteryPlayer.id).padStart(4, "0")
        : "#0000";

    message.textContent = "Target locked. Take a guess or reveal a feature.";
    setPhase("TRACKING");

    enableGameControls();

    basketball.classList.remove("airball");
    clearSamples();
    moveBasketball(0);
    updateReadouts();
    drawTrajectory();

    /*
        Development helper — logs the answer.
        Delete this line before you publish.
    */
    console.log("ANSWER:", getFullName(mysteryPlayer));
}


/* =====================================================
   HELPERS
===================================================== */

function getFullName(player) {
    return player.first_name + " " + player.last_name;
}


function formatPosition(position) {

    const positionNames = {
        "G":   "Guard",
        "F":   "Forward",
        "C":   "Center",
        "G-F": "Guard / Forward",
        "F-G": "Forward / Guard",
        "F-C": "Forward / Center",
        "C-F": "Center / Forward"
    };

    return positionNames[position] || position;
}


function setPhase(text) {
    phaseLabel.textContent = text;
}

function updateGameStats() {

    const percentage = playersAttempted === 0
        ? 0
        : Math.round(
            (playersGuessedCorrectly / playersAttempted) * 100
        );

    liveLabel.textContent =
        `TOTAL POINTS: ${totalPoints} · ` +
        `PLAYERS GUESSED: ${playersGuessedCorrectly}/${playersAttempted} ` +
        `(${percentage}%)`;
}

/* =====================================================
   CLUES

   Each clue is a label / value pair so it can be
   rendered as a row of the feature table.
===================================================== */

function getClues(player) {

    return [
        { 
            key: "POSITION", 
            value: formatPosition(player.position) 
        },
        { 
            key: "NUMBER", 
            value: player.jersey_number 
                ? "#" + player.jersey_number 
                : "Unlisted" 
        },
        { 
            key: "DRAFT YEAR", 
            value: player.draft_year 
                ? player.draft_year 
                : "Undrafted" 
        },
        { 
            key: "COLLEGE", 
            value: player.college || "International" 
        },
        { 
            key: "NBA TEAM", 
            value: player.team.full_name 
        }
    ];
}


/* =====================================================
   REVEAL CLUE
===================================================== */

function revealClue() {

    if (!mysteryPlayer) {
        message.textContent = "Player data is still loading.";
        return;
    }

    if (gameOver) {
        return;
    }

    const clues = getClues(mysteryPlayer);

    if (clueNumber >= clues.length) {
        message.textContent = "Every feature is out. Guess, or resolve the shot.";
        return;
    }


    /* Clear the empty state on the first reveal. */

    if (clueNumber === 0) {
        cluesContainer.innerHTML = "";
    }


    const clue = clues[clueNumber];

    const row = document.createElement("div");
    row.className = "st-feature";

    row.innerHTML = `
        <span class="idx">${String(clueNumber + 1).padStart(2, "0")}</span>
        <span class="key">${clue.key}</span>
        <span class="val"></span>
    `;

    row.querySelector(".val").textContent = clue.value;
    cluesContainer.appendChild(row);


    clueNumber++;
    score = SCORES[clueNumber];

    moveBasketball(clueNumber);
    updateReadouts();


    if (clueNumber === clues.length) {
        clueButton.disabled = true;
        message.textContent = "Last feature. The ball is already coming down.";
        setPhase("DESCENDING");
    }
    else {
        message.textContent = `Feature ${clueNumber} revealed.`;
    }

}


/* =====================================================
   READOUTS
===================================================== */

function updateReadouts() {

    scoreDisplay.textContent = score;
    scoreBar.style.width = (score / 1000) * 100 + "%";

    featureCount.textContent = clueNumber;
    featuresMeta.textContent = `${clueNumber} / 5`;
    certaintyOut.textContent = CERTAINTY[clueNumber];
    arcOut.textContent = ARC_PCT[clueNumber];
    decayOut.textContent = DECAY[clueNumber];

    ticks.forEach((tick, i) => {
        tick.classList.toggle("on", i < clueNumber);
    });

    updateFlownPath();
}


/* =====================================================
   BALL MOVEMENT
===================================================== */

function moveBasketball(positionIndex) {

    const position = shotPositions[positionIndex];

    if (!position) {
        return;
    }

    basketball.style.left = position.left + "%";
    basketball.style.bottom = position.bottom + "px";
    basketball.style.transform = `rotate(${positionIndex * 150}deg)`;

    dropSample(position.left, position.bottom);

    /* Extend the plotted line to match the ball. */
    plottedIndex = positionIndex;
    updateFlownPath();
}


/*
    Leaves a tracked sample point behind the ball,
    the way frame-by-frame tracking data looks.
*/

function dropSample(left, bottom) {

    const dot = document.createElement("span");
    dot.className = "st-sample";
    dot.style.left = left + "%";
    dot.style.bottom = bottom + "px";

    court.appendChild(dot);
}


function clearSamples() {
    court.querySelectorAll(".st-sample").forEach(dot => dot.remove());
}


/* =====================================================
   TRAJECTORY PLOT

   Draws the full shot path through the court,
   in the same coordinate space the ball uses.
===================================================== */

function trajectoryPoints() {

    const w = court.clientWidth;
    const h = court.clientHeight;

    // Normal clue portion of the shot
    const points = shotPositions.map(p => ({
        x: (w * p.left) / 100 + 22,
        y: h - p.bottom - 22
    }));

    // Find the ACTUAL center of the rim
    const courtRect = court.getBoundingClientRect();
    const rimRect = rim.getBoundingClientRect();

    const rimX =
        rimRect.left - courtRect.left + rimRect.width / 2;

    const rimY =
        rimRect.top - courtRect.top + rimRect.height / 2;

    // Smooth continuation from the final clue toward the rim
    const last = points[points.length - 1];

    points.push(
        {
            x: last.x + (rimX - last.x) * 0.35,
            y: last.y + (rimY - last.y) * 0.18
        },
        {
            x: last.x + (rimX - last.x) * 0.65,
            y: last.y + (rimY - last.y) * 0.45
        },
        {
            x: last.x + (rimX - last.x) * 0.85,
            y: last.y + (rimY - last.y) * 0.72
        },
        {
            x: rimX,
            y: rimY
        }
    );

    return points;
}

/*
    Catmull-Rom through the sample points, converted
    to a cubic Bezier path so the arc reads smooth.
*/

function smoothPath(points) {

    if (points.length < 2) {
        return "";
    }

    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {

        const p0 = points[i - 1] || points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;

        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;

        d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }

    return d;
}


function drawTrajectory() {

    const w = court.clientWidth;
    const h = court.clientHeight;

    plot.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const d = smoothPath(trajectoryPoints());

    pathProjected.setAttribute("d", d);
    pathFlown.setAttribute("d", d);

    updateFlownPath();
}


/*
    The solid orange line grows to wherever the
    ball currently is.
*/

function updateFlownPath() {

    const total = pathFlown.getTotalLength();

    if (!total) {
        return;
    }

    const points = trajectoryPoints();
    const travelled = partialLength(points, plottedIndex);

    pathFlown.style.strokeDasharray = total;
    pathFlown.style.strokeDashoffset = total - travelled;
}


function partialLength(points, index) {

    if (index <= 0) {
        return 0;
    }

    const temp = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
    );

    temp.setAttribute("d", smoothPath(points.slice(0, index + 1)));
    plot.appendChild(temp);

    const length = temp.getTotalLength();
    temp.remove();

    return length;
}


/* Keep the plot aligned when the court resizes. */

window.addEventListener("resize", drawTrajectory);


/* =====================================================
   GUESSING
===================================================== */

function normalizeName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}


function checkGuess() {

    if (gameOver || !mysteryPlayer) {
        return;
    }

    const userGuess = normalizeName(guessInput.value);

    if (!userGuess) {
        message.textContent = "Type a player name first.";
        return;
    }

    const correctAnswer = normalizeName(getFullName(mysteryPlayer));


    /* CORRECT */

    if (userGuess === correctAnswer) {

        gameOver = true;

        totalPoints += score;
        playersGuessedCorrectly++;
        playersAttempted++;
        updateGameStats();

        message.textContent =
            `Confirmed — ${getFullName(mysteryPlayer)}. ${score} points.`;

        root.classList.remove("is-ready");
        root.classList.add("is-made");

        setPhase("SHOT MADE");
        arcOut.textContent = "100";

        closeSuggestions();
        disableFinishedGame();
        makeShot();

        return;
    }


    /* WRONG */

    message.textContent = "Not a match. Guess again or reveal another feature.";
    setPhase("LOCK LOST");

    shakeBasketball();

    guessInput.value = "";
    closeSuggestions();

    setTimeout(() => {
        if (!gameOver) {
            setPhase(clueNumber === 5 ? "DESCENDING" : "TRACKING");
        }
    }, 900);
}


function shakeBasketball() {

    basketball.classList.remove("shake");

    /* Force a repaint so the animation can replay. */
    void basketball.offsetWidth;

    basketball.classList.add("shake");

    setTimeout(() => basketball.classList.remove("shake"), 450);
}


/* =====================================================
   MADE SHOT

   Finishes the remaining arc from wherever the
   ball currently is.
===================================================== */

function makeShot() {

    const points = trajectoryPoints();

    // Everything after the clue positions is the
    // smooth responsive path toward the rim.
    const finishPoints = points.slice(shotPositions.length);

    const courtRect = court.getBoundingClientRect();

    finishPoints.forEach((point, index) => {

        setTimeout(() => {

            const ballWidth = basketball.offsetWidth;
            const ballHeight = basketball.offsetHeight;

            basketball.style.left =
                ((point.x - ballWidth / 2) / courtRect.width) * 100 + "%";

            basketball.style.bottom =
                courtRect.height - point.y - ballHeight / 2 + "px";

            basketball.style.transform =
                `rotate(${850 + index * 150}deg)`;

        }, index * 350);

    });

    // After reaching the rim, continue straight down
    // through the basket to the floor.
    const rimArrivalTime = finishPoints.length * 350;

    setTimeout(() => {

        const courtRect = court.getBoundingClientRect();
        const rimRect = rim.getBoundingClientRect();

        const rimCenterX =
            rimRect.left - courtRect.left + rimRect.width / 2;

        const ballWidth = basketball.offsetWidth;

        basketball.style.left =
            ((rimCenterX - ballWidth / 2) / courtRect.width) * 100 + "%";

        basketball.style.bottom = "10px";

        basketball.style.transform =
            `rotate(${850 + finishPoints.length * 150}deg)`;

    }, rimArrivalTime);

    // Fill the plotted path to the rim.
    setTimeout(() => {
        pathFlown.style.strokeDashoffset = 0;
    }, 50);
}


/* =====================================================
   MISSED SHOT

   1. finish the normal clue path through position 5
   2. continue toward the backboard
   3. hit the upper backboard
   4. bounce backward
   5. fall to the floor
===================================================== */

function missShot() {

    if (gameOver || !mysteryPlayer) {
        return;
    }

    gameOver = true;

    playersAttempted++;
    updateGameStats();

    message.textContent =
        `Shot missed — the player was ${getFullName(mysteryPlayer)}.`;
    
    root.classList.remove("is-ready");
    root.classList.add("is-missed");

    setPhase("SHOT MISSED");

    closeSuggestions();
    disableFinishedGame();


    let delay = 0;


    /*
        Finish the clue path first, so giving up
        early still shows the whole arc.
    */

    for (let i = clueNumber + 1; i < shotPositions.length; i++) {

        const positionIndex = i;
        delay += 450;

        setTimeout(() => moveBasketball(positionIndex), delay);
    }


    const rebound = [
        { left: "76%", bottom: "235px", rotate: 850,  gap: 450 },
        { left: "83%", bottom: "205px", rotate: 1000, gap: 400 },
        { left: "90%", bottom: "190px", rotate: 1120, gap: 300 },  // backboard
        { left: "78%", bottom: "220px", rotate: 950,  gap: 300 },  // bounce back
        { left: "68%", bottom: "160px", rotate: 750,  gap: 400 },
        { left: "59%", bottom: "90px",  rotate: 550,  gap: 350 },
        { left: "54%", bottom: "35px",  rotate: 400,  gap: 350 }
    ];

    rebound.forEach(step => {

        delay += step.gap;

        setTimeout(() => {

            basketball.style.left = step.left;
            basketball.style.bottom = step.bottom;
            basketball.style.transform = `rotate(${step.rotate}deg)`;

        }, delay);

    });
}


/* =====================================================
   AUTOCOMPLETE
===================================================== */

function showSuggestions() {

    if (gameOver || players.length === 0) {
        return;
    }

    const typed = normalizeName(guessInput.value);

    suggestionsContainer.innerHTML = "";
    selectedSuggestionIndex = -1;

    if (typed.length === 0) {
        return;
    }


    /*
        Match on full name, first name, or last name,
        so "ste", "curr" and "lebr" all work.
    */

    const matches = players.filter(player => {

        const fullName  = normalizeName(getFullName(player));
        const firstName = normalizeName(player.first_name);
        const lastName  = normalizeName(player.last_name);

        return (
            fullName.startsWith(typed) ||
            firstName.startsWith(typed) ||
            lastName.startsWith(typed)
        );
    });


    matches.sort((a, b) =>
        getFullName(a).localeCompare(getFullName(b))
    );


    matches.slice(0, 8).forEach(player => {

        const option = document.createElement("div");
        option.className = "suggestion";
        option.textContent = getFullName(player);

        option.addEventListener("click", () => {
            guessInput.value = getFullName(player);
            closeSuggestions();
            guessInput.focus();
        });

        suggestionsContainer.appendChild(option);
    });
}


function closeSuggestions() {
    suggestionsContainer.innerHTML = "";
    selectedSuggestionIndex = -1;
}


/* =====================================================
   KEYBOARD CONTROL OF THE DROPDOWN
===================================================== */

function handleInputKeydown(event) {

    const options = Array.from(
        document.querySelectorAll(".suggestion")
    );


    if (event.key === "ArrowDown") {

        if (options.length === 0) return;

        event.preventDefault();
        selectedSuggestionIndex++;

        if (selectedSuggestionIndex >= options.length) {
            selectedSuggestionIndex = 0;
        }

        highlightSuggestion(options);
    }

    else if (event.key === "ArrowUp") {

        if (options.length === 0) return;

        event.preventDefault();
        selectedSuggestionIndex--;

        if (selectedSuggestionIndex < 0) {
            selectedSuggestionIndex = options.length - 1;
        }

        highlightSuggestion(options);
    }

    else if (event.key === "Enter") {

        event.preventDefault();

        if (selectedSuggestionIndex >= 0 && options[selectedSuggestionIndex]) {
            guessInput.value = options[selectedSuggestionIndex].textContent;
            closeSuggestions();
        }
        else {
            checkGuess();
        }
    }

    else if (event.key === "Escape") {
        closeSuggestions();
    }
}


function highlightSuggestion(options) {

    options.forEach(option => option.classList.remove("selected"));

    if (options[selectedSuggestionIndex]) {
        options[selectedSuggestionIndex].classList.add("selected");
        options[selectedSuggestionIndex].scrollIntoView({ block: "nearest" });
    }
}


/* =====================================================
   EVENT LISTENERS
===================================================== */

clueButton.addEventListener("click", revealClue);
guessButton.addEventListener("click", checkGuess);
giveUpButton.addEventListener("click", missShot);
newGameButton.addEventListener("click", startGame);

guessInput.addEventListener("input", showSuggestions);
guessInput.addEventListener("keydown", handleInputKeydown);

document.addEventListener("click", event => {
    if (!event.target.closest(".st-field")) {
        closeSuggestions();
    }
});


/* =====================================================
   INITIALIZE

   page load → loadPlayers() → API → startGame()
===================================================== */

drawTrajectory();
loadPlayers();
