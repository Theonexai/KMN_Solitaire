const suits = [
  { id: "hearts", symbol: "♥", color: "red" },
  { id: "diamonds", symbol: "♦", color: "red" },
  { id: "clubs", symbol: "♣", color: "black" },
  { id: "spades", symbol: "♠", color: "black" },
];

const ranks = [
  { label: "A", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10", value: 10 },
  { label: "J", value: 11 },
  { label: "Q", value: 12 },
  { label: "K", value: 13 },
];

const state = {
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
  moves: 0,
  startedAt: null,
  timerId: null,
  dragged: null,
  history: [],
};

const SAVE_KEY="hopmint:solitaire:v1";
let elapsedMs=0, activeSince=null, storageOK=true;
function notice(text){document.getElementById('move-status').textContent=text;}
function clockMs(){return elapsedMs+(activeSince===null?0:Date.now()-activeSince);}
function pauseClock(){elapsedMs=clockMs();activeSince=null;}
function snapshot(){return structuredClone({stock:state.stock,waste:state.waste,foundations:state.foundations,tableau:state.tableau,moves:state.moves});}
function validSnapshot(s){
 if(!s||!Number.isInteger(s.moves)||s.moves<0||!Array.isArray(s.stock)||!Array.isArray(s.waste)||!Array.isArray(s.tableau)||s.tableau.length!==7||!Array.isArray(s.foundations)||s.foundations.length!==4)return false;
 const piles=[s.stock,s.waste,...s.tableau,...s.foundations];if(piles.some(p=>!Array.isArray(p)))return false;
 const cards=piles.flat(),canonical=new Map(createDeck().map(c=>[c.id,c]));
 if(cards.length!==52||new Set(cards.map(c=>c?.id)).size!==52)return false;
 if(cards.some(c=>!c||typeof c.faceUp!=='boolean'||!canonical.has(c.id)||['suit','rank','value','color','symbol'].some(k=>c[k]!==canonical.get(c.id)[k])))return false;
 if(s.stock.some(c=>c.faceUp)||s.waste.some(c=>!c.faceUp))return false;
 if(s.foundations.some((p,i)=>p.some((c,j)=>!c.faceUp||c.suit!==suits[i].id||c.value!==j+1)))return false;
 return s.tableau.every(p=>{const first=p.findIndex(c=>c.faceUp);return !p.length||(first>=0&&p.slice(first).every(c=>c.faceUp)&&isValidSequence(p.slice(first)));});
}
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:1,game:snapshot(),elapsedMs:clockMs(),history:state.history.slice(-80)}));storageOK=true;}catch{storageOK=false;}document.getElementById('save-status').textContent=storageOK?'Saved on this device':'Saving unavailable — keep this tab open to retain your hand.';}
function restoreGame(){try{const raw=JSON.parse(localStorage.getItem(SAVE_KEY));if(!raw)return false;if(raw.version!==1||!validSnapshot(raw.game)||!Number.isFinite(raw.elapsedMs)||raw.elapsedMs<0)throw new Error('Invalid save');Object.assign(state,raw.game);state.history=Array.isArray(raw.history)?raw.history.slice(-80).filter(validSnapshot):[];elapsedMs=raw.elapsedMs;activeSince=document.hidden||hasFinishedGame()?null:Date.now();state.timerId=setInterval(updateTimer,1000);render();return true;}catch{notice('The previous hand could not be restored. A new hand has been dealt.');return false;}}
function selectCard(location){
 const move=buildMove(location);if(!move)return;
 if(state.dragged){if(state.dragged.cards[0].id===move.cards[0].id){state.dragged=null;render();notice('Selection cleared.');return;}placeSelection(location.source,location.source==='tableau'?location.column:location.pile);return;}
 state.dragged=move;render();notice('Card selected. Choose a marked destination; Escape cancels.');
}
function placeSelection(type,index){if(!state.dragged)return;if(!canDrop(type,index)){notice('That move is not allowed. Choose a marked destination.');return;}moveDragged(type,index);notice('Card moved.');}


const els = {
  stock: document.querySelector("#stock"),
  stockCount: document.querySelector("#stock-count"),
  waste: document.querySelector("#waste"),
  foundations: document.querySelector("#foundations"),
  tableau: document.querySelector("#tableau"),
  moves: document.querySelector("#moves"),
  timer: document.querySelector("#timer"),
  undo: document.querySelector("#undo"),
  newGame: document.querySelector("#new-game"),
  winDialog: document.querySelector("#win-dialog"),
  winSummary: document.querySelector("#win-summary"),
  playAgain: document.querySelector("#play-again"),
  skipLeaveWarning: document.querySelector("#skip-leave-warning"),
};

function createDeck() {
  return suits.flatMap((suit) =>
    ranks.map((rank) => ({
      id: `${rank.label}-${suit.id}`,
      suit: suit.id,
      symbol: suit.symbol,
      color: suit.color,
      rank: rank.label,
      value: rank.value,
      faceUp: false,
    }))
  );
}

function shuffle(deck) {
  const cards = [...deck];
  crypto.getRandomValues(new Uint32Array(cards.length)).forEach((random, index) => {
    const swapIndex = index + (random % (cards.length - index));
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  });
  return cards;
}

function startGame() {
  clearInterval(state.timerId);
  const deck = shuffle(createDeck());
  state.stock = [];
  state.waste = [];
  state.foundations = [[], [], [], []];
  state.tableau = [[], [], [], [], [], [], []];
  state.moves = 0;
  state.startedAt = Date.now();
  elapsedMs=0;activeSince=document.hidden?null:Date.now();
  state.dragged = null;
  state.history = [];

  for (let column = 0; column < 7; column += 1) {
    for (let row = 0; row <= column; row += 1) {
      const card = deck.pop();
      card.faceUp = row === column;
      state.tableau[column].push(card);
    }
  }

  state.stock = deck;
  state.timerId = setInterval(updateTimer, 1000);
  render();
}

function render() {
 const focused=document.activeElement?.dataset.cardId;
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
  els.moves.textContent = `${state.moves} ${state.moves === 1 ? "move" : "moves"}`;
  els.undo.disabled = state.history.length === 0;
  updateTimer();
 document.querySelectorAll('[data-card-id]').forEach(el=>{const selected=state.dragged?.cards.some(c=>c.id===el.dataset.cardId)||false;el.classList.toggle('selected-card',selected);el.setAttribute('aria-pressed',String(selected));});
 if(focused)document.querySelector(`[data-card-id="${focused}"]`)?.focus({preventScroll:true});
 persist();
}

function renderStock() {
  els.stock.classList.toggle("has-cards", state.stock.length > 0);
  els.stockCount.textContent = String(state.stock.length);
  els.stock.setAttribute(
    "aria-label",
    state.stock.length > 0 ? `Draw a card, ${state.stock.length} remaining` : "Recycle waste, stock empty"
  );
}

function renderWaste() {
  els.waste.replaceChildren();
  els.waste.dataset.source = "waste";
  const visibleCards = state.waste.slice(-3);
  const firstVisibleIndex = state.waste.length - visibleCards.length;

  visibleCards.forEach((card, visibleIndex) => {
    const cardIndex = firstVisibleIndex + visibleIndex;
    const isTopCard = cardIndex === state.waste.length - 1;
    const cardEl = createCardElement(
      card,
      { source: "waste", index: cardIndex },
      { interactive: isTopCard }
    );
    cardEl.style.left = `${visibleIndex * wasteSpread()}px`;
    cardEl.style.zIndex = String(visibleIndex + 1);
    els.waste.append(cardEl);
  });

}

function renderFoundations() {
  els.foundations.replaceChildren();
  state.foundations.forEach((pile, index) => {
    const foundation = document.createElement("div");
    foundation.className = "pile foundation";
    foundation.dataset.foundation = String(index);
    foundation.dataset.suit = suits[index].id;
    foundation.setAttribute("aria-label", `${suits[index].id} foundation`);
    attachDropTarget(foundation, "foundation", index);

    const topCard = pile.at(-1);
    if (topCard) {
      foundation.append(createCardElement(topCard, { source: "foundation", pile: index, index: pile.length - 1 }));
    }
    els.foundations.append(foundation);
  });
}

function renderTableau() {
  els.tableau.replaceChildren();
  state.tableau.forEach((columnCards, columnIndex) => {
    const column = document.createElement("div");
    column.className = `column${columnCards.length === 0 ? " empty" : ""}`;
    column.dataset.column = String(columnIndex);
    column.setAttribute("aria-label", `Column ${columnIndex + 1}`);
    attachDropTarget(column, "tableau", columnIndex);

    columnCards.forEach((card, cardIndex) => {
      const cardEl = createCardElement(card, {
        source: "tableau",
        column: columnIndex,
        index: cardIndex,
      });
      cardEl.style.top = `${cardIndex * stackOffset()}px`;
      column.append(cardEl);
    });

    column.style.minHeight = `${Math.max(0, columnCards.length - 1) * stackOffset() + els.stock.getBoundingClientRect().height}px`;
    els.tableau.append(column);
  });
}

function createCardElement(card, location, options = {}) {
  const interactive = options.interactive !== false;
  const cardEl = document.createElement("div");
  cardEl.className = `card ${card.color}${card.faceUp ? "" : " face-down"}`;
  cardEl.dataset.cardId = card.id;
  if (interactive) {
    cardEl.setAttribute("role", "button");
    cardEl.setAttribute("aria-label", card.faceUp ? `${card.rank} of ${card.suit}` : "Face-down card");
  } else {
    cardEl.classList.add("preview");
    cardEl.setAttribute("aria-hidden", "true");
  }

  if (card.faceUp && interactive) {
    cardEl.tabIndex = 0;
    cardEl.draggable = canDrag(location);
    cardEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();selectCard(location);
      }
    });
    cardEl.innerHTML = `
      <span class="rank">${card.rank}<span class="corner-suit">${card.symbol}</span></span>
      <span class="center-suit">${card.symbol}</span>
      <span class="suit">${card.symbol}</span>
    `;
    cardEl.addEventListener("click", (event) => {
      event.stopPropagation();
      selectCard(location);
    });
    cardEl.addEventListener("dragstart", (event) => onDragStart(event, location));
    cardEl.addEventListener("dragend", onDragEnd);

  } else if (card.faceUp) {
    cardEl.innerHTML = `
      <span class="rank">${card.rank}<span class="corner-suit">${card.symbol}</span></span>
      <span class="center-suit">${card.symbol}</span>
      <span class="suit">${card.symbol}</span>
    `;
  }

  return cardEl;
}

function attachDropTarget(element, type, index = null) {
 element.tabIndex=0;element.setAttribute('role','button');
 element.classList.toggle('legal-destination',canDrop(type,index));
 if(canDrop(type,index))element.setAttribute('aria-label',element.getAttribute('aria-label')+', valid destination');
 element.addEventListener('click',()=>placeSelection(type,index));
 element.addEventListener('keydown',e=>{if(e.target===element&&(e.key==='Enter'||e.key===' ')){e.preventDefault();placeSelection(type,index);}});
  element.addEventListener("dragover", (event) => {
    if (canDrop(type, index)) {
      event.preventDefault();
      element.classList.add("drop-ok");
    }
  });
  element.addEventListener("dragleave", () => element.classList.remove("drop-ok"));
  element.addEventListener("drop", (event) => {
    event.preventDefault();
    element.classList.remove("drop-ok");
    moveDragged(type, index);
  });
}

function onDragStart(event, location) {
  state.dragged = buildMove(location);
  if (!state.dragged) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", state.dragged.cards.map((card) => card.id).join(","));
  requestAnimationFrame(() => event.target.classList.add("dragging"));
}

function onDragEnd(event) {
  event.target.classList.remove("dragging");
  document.querySelectorAll(".drop-ok").forEach((el) => el.classList.remove("drop-ok"));
}

function buildMove(location) {
  if (location.source === "waste") {
    const card = state.waste.at(-1);
    return card ? { from: location, cards: [card] } : null;
  }

  if (location.source === "foundation") {
    const card = state.foundations[location.pile].at(-1);
    return card ? { from: location, cards: [card] } : null;
  }

  const column = state.tableau[location.column];
  const cards = column.slice(location.index);
  if (!cards.length || !cards.every((card) => card.faceUp) || !isValidSequence(cards)) {
    return null;
  }
  return { from: location, cards };
}

function canDrag(location) {
  return Boolean(buildMove(location));
}

function canDrop(type, index) {
  const move = state.dragged;
  if (!move) return false;
  if (type === "waste") return false;
  if (type === "foundation") return canMoveToFoundation(move.cards, index);
  if (type === "tableau") return !isSameTableauSource(move,index)&&canMoveToTableau(move.cards, index);
  return false;
}

function moveDragged(type, index) {
  if (!state.dragged || !canDrop(type, index)) return;
  saveHistory();
  const move = state.dragged;
  removeFromSource(move);

  if (type === "foundation") {
    state.foundations[index].push(move.cards[0]);
  } else {
    state.tableau[index].push(...move.cards);
  }

  afterMove();
}

function removeFromSource(move) {
  const { from, cards } = move;
  if (from.source === "waste") {
    state.waste.pop();
  } else if (from.source === "foundation") {
    state.foundations[from.pile].pop();
  } else {
    state.tableau[from.column].splice(from.index, cards.length);
  }
}

function canMoveToFoundation(cards, foundationIndex) {
  if (cards.length !== 1) return false;
  const card = cards[0];
  const pile = state.foundations[foundationIndex];
  const expectedSuit = suits[foundationIndex].id;
  if (card.suit !== expectedSuit) return false;
  if (pile.length === 0) return card.value === 1;
  return pile.at(-1).value + 1 === card.value;
}

function canMoveToTableau(cards, columnIndex) {
  const card = cards[0];
  const destination = state.tableau[columnIndex];
  const topCard = destination.at(-1);
  if (!topCard) return card.value === 13;
  return topCard.faceUp && topCard.color !== card.color && topCard.value === card.value + 1;
}

function isValidSequence(cards) {
  return cards.every((card, index) => {
    if (index === 0) return true;
    const previous = cards[index - 1];
    return previous.color !== card.color && previous.value === card.value + 1;
  });
}

function afterMove() {
  flipAvailableCards();
  state.moves += 1;
  state.dragged = null;
  render();
  checkWin();
}

function flipAvailableCards() {
  state.tableau.forEach((column) => {
    const topCard = column.at(-1);
    if (topCard && !topCard.faceUp) {
      topCard.faceUp = true;
    }
  });
}

function drawFromStock() {
 state.dragged=null;
  if (state.stock.length > 0) {
    saveHistory();
    const card = state.stock.pop();
    card.faceUp = true;
    state.waste.push(card);
    state.moves += 1;
  } else if (state.waste.length > 0) {
    saveHistory();
    state.stock = state.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    state.waste = [];
    state.moves += 1;
  }
  render();
}

function autoFoundation(location) {
  const move = buildMove(location);
  if (!move || move.cards.length !== 1) return;
  const foundationIndex = state.foundations.findIndex((_, index) => canMoveToFoundation(move.cards, index));
  if (foundationIndex === -1) return;
  state.dragged = move;
  moveDragged("foundation", foundationIndex);
}

function autoMove(location) {
  const move = buildMove(location);
  if (!move) return;

  const tableauIndex = state.tableau.findIndex((_, index) => {
    return !isSameTableauSource(move, index) && canMoveToTableau(move.cards, index);
  });
  if (tableauIndex !== -1) {
    state.dragged = move;
    moveDragged("tableau", tableauIndex);
    return;
  }

  if (move.cards.length !== 1) return;
  const foundationIndex = state.foundations.findIndex((_, index) => canMoveToFoundation(move.cards, index));
  if (foundationIndex === -1) return;
  state.dragged = move;
  moveDragged("foundation", foundationIndex);
}

function isSameTableauSource(move, columnIndex) {
  return move.from.source === "tableau" && move.from.column === columnIndex;
}

function checkWin() {
  const completed = state.foundations.every((pile) => pile.length === 13);
  if (!completed) return;
  pauseClock();persist();clearInterval(state.timerId);
  els.winSummary.textContent = `Finished in ${state.moves} moves and ${formatTime(elapsedSeconds())}.`;
  els.winDialog.showModal();
}

function hasFinishedGame() {
  return state.foundations.every((pile) => pile.length === 13);
}

function saveHistory() {
  state.history.push({
    stock: cloneCards(state.stock),
    waste: cloneCards(state.waste),
    foundations: state.foundations.map(cloneCards),
    tableau: state.tableau.map(cloneCards),
    moves: state.moves,
  });
 state.history=state.history.slice(-80);
}

function undoMove() {
  const previous = state.history.pop();
  if (!previous) return;
  state.stock = previous.stock;
  state.waste = previous.waste;
  state.foundations = previous.foundations;
  state.tableau = previous.tableau;
  state.moves = previous.moves;
  state.dragged = null;
 if(!document.hidden&&activeSince===null)activeSince=Date.now();clearInterval(state.timerId);state.timerId=setInterval(updateTimer,1000);
  render();
}

function cloneCards(cards) {
  return cards.map((card) => ({ ...card }));
}

function updateTimer() {
  els.timer.textContent = formatTime(elapsedSeconds());
}

function elapsedSeconds() {
  return Math.floor(clockMs()/1000);
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function stackOffset() {
  return window.matchMedia("(max-width: 780px)").matches ? 22 : 30;
}

function wasteSpread() {
  return (els.waste.getBoundingClientRect().width - els.stock.getBoundingClientRect().width) / 2;
}

els.stock.addEventListener("click", drawFromStock);
els.undo.addEventListener("click", undoMove);
els.newGame.addEventListener("click",()=>{if(state.moves>0&&!hasFinishedGame())document.getElementById('restart-dialog').showModal();else startGame();});
document.getElementById('cancel-restart').onclick=()=>document.getElementById('restart-dialog').close();
document.getElementById('confirm-restart').onclick=()=>{document.getElementById('restart-dialog').close();startGame();};
els.playAgain.addEventListener("click", () => {
  els.winDialog.close();
  startGame();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.dragged){state.dragged=null;render();notice('Selection cleared.');}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseClock();persist();}else if(!hasFinishedGame())activeSince=Date.now();});
window.addEventListener('pagehide',()=>{pauseClock();persist();});
window.addEventListener('pageshow',()=>{if(!document.hidden&&!hasFinishedGame()&&activeSince===null)activeSince=Date.now();});
window.addEventListener('resize',render);
setInterval(persist,5000);
if(!restoreGame())startGame();
