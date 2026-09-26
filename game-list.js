// The list of games, shared by every page that offers them: the hub's tile grid (index.html) and
// the job picker at the HMRC fairground stalls. Add a game here and it appears in both.
// Tile styles live in game-tiles.css; pictures in assets/modes/ (sources in CREDITS.md).
//
// Each game:
//   id     — also the picture's file name (assets/modes/<id>.jpg)
//   title  — shown on its tile
//   glow   — the tile's theme colour (border, hover glow, title accent)
//   desc   — shown as the tile's tooltip
//   page   — for games with their own page; the others run inside index.html
// The online race isn't listed (removed from the menu), though its code and #race= links remain.
export const GAMES = [
  { id: 'exam', title: 'Exam Mode', glow: '#60a5fa',
    desc: 'All 20 questions, one at a time, with the correct answer and an explanation shown after each. Finishes with a pass/fail score and a topic-by-topic breakdown.' },
  { id: 'arcade', title: 'Space Invaders', glow: '#22d3ee',
    desc: 'Space Invaders style: fly through 10 questions sampled at random. Shoot the ship carrying the correct answer — wrong guesses are shown, but nothing is lost. Correct answers upgrade your weapon.' },
  { id: 'penalty', title: 'Football Penalties', glow: '#4ade80',
    desc: 'Football penalty shootout style: a best-of-5 shootout sampled at random. Pick the goal zone showing the correct answer to score — pick wrong and the keeper saves it. Nothing is lost either way.' },
  { id: 'pacman', title: 'Pac-Man', glow: '#facc15',
    desc: 'Pac-Man style: navigate a maze through 10 questions sampled at random. Eat the answer node with the correct text — wrong guesses are shown, but nothing is lost. Dodge the ghosts along the way.' },
  { id: 'forest', title: 'Street Adventure', glow: '#fb7185',
    desc: 'A Pokémon-inspired city walk: explore a street scene with shops and buildings, walk down the road, and chat with computer-controlled walkers while collecting the feeling of a starter RPG.' },
  { id: 'racing-demo', title: 'Racing Game', glow: '#fb923c', page: './racing-demo.html',
    desc: 'Launch the standalone browser racing game with a chase camera, drifting car handling, and modern 3D visuals.' },
  { id: 'hmrc', title: 'HMRC Mode', glow: '#e879f9', page: './hmrc-mode.html',
    desc: 'A top-down, Pokémon-style walkabout: explore an indoor fairground hall on foot with WASD or the arrow keys. (Early build — just the hall and movement for now.)' },
  { id: 'tax-battle', title: 'Tax Quest Battle', glow: '#a78bfa', page: './tax-battle-mode.html',
    desc: 'A Pokémon-inspired quiz battle: a trainer explores encounters, answers tax and tech questions, and wins badges by picking the correct answer in a turn-based fight.' },
  { id: 'chess', title: 'Chess', glow: '#e5c07b', page: './chess.html',
    desc: 'Two-player chess where every turn starts with a question from the selected subject: answer correctly to make your move, answer wrongly and your turn passes to your opponent. Play on one screen or online with a room code.' },
];

export const findGame = (id) => GAMES.find((game) => game.id === id);

// Bump when a picture in assets/modes/ is replaced, so browsers don't keep showing the old one.
const CARD_IMAGE_VERSION = 2;

// Where a game is played, for pages other than the hub. Games with their own page open it
// directly; the rest run inside index.html, which starts them from ?play= (see arcade-module/main.js).
export function gameUrl(id, subject) {
  const game = findGame(id);
  const query = 'subject=' + encodeURIComponent(subject);
  return game.page ? `${game.page}?${query}` : `./index.html?play=${encodeURIComponent(id)}&${query}`;
}

// A picture tile for `game` (a <button>; the caller decides what clicking it does).
// `index` staggers the tiles' entrance animation.
export function createGameTile(game, index = 0) {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'game-card';
  tile.style.setProperty('--i', index);
  tile.style.setProperty('--glow', game.glow);
  tile.title = game.desc;
  tile.innerHTML = `<span class="game-thumb"><img src="./assets/modes/${game.id}.jpg?v=${CARD_IMAGE_VERSION}" alt="" loading="lazy" decoding="async"></span>`
    + '<span class="game-shade" aria-hidden="true"></span><span class="game-play" aria-hidden="true">▶ PLAY</span>'
    + '<span class="game-title"></span>';
  tile.querySelector('.game-title').textContent = game.title;
  return tile;
}
