import { joinRoom } from '@trystero-p2p/mqtt';

document.addEventListener("DOMContentLoaded", () => {
  const shopSection = document.getElementById('shop'),
        boardSection = document.getElementById('board'),
        handSection = document.getElementById('hand'),
        refreshButton = document.getElementById('refresh-button'),
        upgradeButton = document.getElementById('upgrade-button'),
        endTurnButton = document.getElementById('end-turn-button'),
        targetPosition = { x: 0, y: 0 },
        latestFollowCardMap = new Map();

  let removeOnDrop, droppedInShop, isAnimating, isDragging = false,
      originalSection = null, followCard = null,
      shopSlotCounter = 0, lerpAlpha = 0.15, previousX = 0, previousY = 0, tiltX = 0, tiltY = 0,
      currentRank = 1, currentGold = 999, maxGold = 999;

  const rankText = document.getElementById("rank-text");
  const goldText = document.getElementById("gold-text");

  // === CARD RENDERING ===
  function renderCardContent(card) {
    const atk = card.dataset.attack || '0';
    const hp = card.dataset.life || '0';
    const locked = card.dataset.locked === 'true';
    card.innerHTML = `<span class="card-atk">${atk}</span><span class="card-hp">${hp}</span>`;
    if (locked) card.innerHTML += '<span class="card-lock-indicator">L</span>';
  }

  // === LOBBY & MULTIPLAYER ===
  const lobbyScreen = document.getElementById('lobby-screen');
  const gameScreen = document.getElementById('game-screen');
  const hostBtn = document.getElementById('host-btn');
  const joinBtn = document.getElementById('join-btn');
  const joinInput = document.getElementById('join-input');
  const lobbyStatus = document.getElementById('lobby-status');

  let room, sendEndTurn, getEndTurn, sendBoardState, getBoardState;
  let endTurnReadyLocal = false, endTurnReadyPeer = false, inCombatPhase = false;
  let peerBoardState = null, localBoardState = null;
  const appConfig = { appId: 'circo-maluco-custom-multiplayer-v1' };

  hostBtn.addEventListener('click', () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    joinInput.value = roomId;
    lobbyStatus.textContent = "Waiting for peer... Code: " + roomId;
    setupMultiplayer(roomId);
  });

  joinBtn.addEventListener('click', () => {
    const roomId = joinInput.value.trim();
    if (!roomId) return;
    lobbyStatus.textContent = "Joining room...";
    setupMultiplayer(roomId);
  });

  function setupMultiplayer(roomId) {
    room = joinRoom(appConfig, roomId);
    [sendEndTurn, getEndTurn] = room.makeAction('endTurn');
    [sendBoardState, getBoardState] = room.makeAction('boardState');

    room.onPeerJoin(() => {
      lobbyScreen.style.display = 'none';
      gameScreen.style.display = 'flex';
      generateRandomSlots();
    });

    room.onPeerLeave(() => { alert("Peer left."); location.reload(); });

    getEndTurn(() => { endTurnReadyPeer = true; updateEndTurnUI(); checkCombatPhase(); });
    getBoardState((data) => { peerBoardState = data; startCombatIfReady(); });
  }

  function updateEndTurnUI() {
    let c = 0; if (endTurnReadyLocal) c++; if (endTurnReadyPeer) c++;
    endTurnButton.textContent = `End Turn (${c}/2)`;
  }

  function getBoardCards() {
    const slots = boardSection.querySelectorAll('.slot');
    const cards = [];
    slots.forEach(slot => {
      const card = document.querySelector(`[data-slot-id="${slot.dataset.cardId}"]`);
      if (card && card.style.display !== 'none') {
        cards.push({ attack: parseInt(card.dataset.attack)||1, life: parseInt(card.dataset.life)||1 });
      }
    });
    return cards;
  }

  function checkCombatPhase() {
    if (endTurnReadyLocal && endTurnReadyPeer && !inCombatPhase) {
      inCombatPhase = true;
      localBoardState = getBoardCards();
      sendBoardState(localBoardState);
      startCombatIfReady();
    }
  }

  function startCombatIfReady() {
    if (!localBoardState || !peerBoardState || !inCombatPhase) return;

    // Hide game UI
    [shopSection, handSection].forEach(s => s.style.display = 'none');
    [refreshButton, upgradeButton, endTurnButton, goldText, rankText].forEach(e => e.style.display = 'none');
    document.querySelectorAll('.card').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.shop-card-lock').forEach(l => l.style.display = 'none');

    boardSection.style.cssText = 'height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:2vw;border:0.25vw solid white;width:100%;box-sizing:border-box;';
    boardSection.innerHTML = '';

    const myCards = localBoardState.map(c => ({...c}));
    const enemyCards = peerBoardState.map(c => ({...c}));

    // Build combat UI
    const combatArea = document.createElement('div');
    combatArea.style.cssText = 'display:flex;gap:6vw;align-items:center;justify-content:center;';

    const localCont = document.createElement('div');
    localCont.style.cssText = 'display:flex;gap:1vw;border:0.3vw solid lime;padding:2vw;border-radius:1vw;background:rgba(0,50,0,0.5);min-height:12vw;align-items:center;min-width:10vw;justify-content:center;';

    const vs = document.createElement('div');
    vs.style.cssText = 'color:white;font-size:4vw;font-weight:bold;';
    vs.textContent = 'VS';

    const peerCont = document.createElement('div');
    peerCont.style.cssText = 'display:flex;gap:1vw;border:0.3vw solid red;padding:2vw;border-radius:1vw;background:rgba(50,0,0,0.5);min-height:12vw;align-items:center;min-width:10vw;justify-content:center;';

    combatArea.append(localCont, vs, peerCont);
    boardSection.appendChild(combatArea);

    const status = document.createElement('div');
    status.style.cssText = 'color:white;font-size:2vw;font-weight:bold;margin-top:2vw;text-align:center;';
    boardSection.appendChild(status);

    function mkCard(d) {
      const el = document.createElement('div');
      el.className = 'card combat-card';
      el.innerHTML = `<span class="card-atk">${d.attack}</span><span class="card-hp">${d.life}</span>`;
      return el;
    }

    function render() {
      localCont.innerHTML = ''; peerCont.innerHTML = '';
      if (!myCards.length) localCont.innerHTML = '<div style="color:lime;font-size:1.5vw">No cards</div>';
      else myCards.forEach(c => localCont.appendChild(mkCard(c)));
      if (!enemyCards.length) peerCont.innerHTML = '<div style="color:red;font-size:1.5vw">No cards</div>';
      else enemyCards.forEach(c => peerCont.appendChild(mkCard(c)));
    }

    render();
    status.textContent = 'COMBAT START!';

    let turn = 0, localIdx = 0;

    function step() {
      if (!myCards.length || !enemyCards.length) {
        const r = !myCards.length && !enemyCards.length ? 'DRAW!' : myCards.length ? 'YOU WIN!' : 'YOU LOSE!';
        status.textContent = r; status.style.fontSize = '3vw';
        setTimeout(returnToShop, 3000);
        return;
      }

      if (turn % 2 === 0) {
        const ai = localIdx % myCards.length;
        const ti = Math.floor(Math.random() * enemyCards.length);
        const a = myCards[ai], t = enemyCards[ti];
        t.life -= a.attack; a.life -= t.attack;
        status.textContent = `Your (${a.attack}/${Math.max(0,a.life)}) ⚔️ Enemy (${t.attack}/${Math.max(0,t.life)})`;
        if (t.life <= 0) enemyCards.splice(ti, 1);
        if (a.life <= 0) myCards.splice(ai, 1); else localIdx++;
      } else {
        const ai = Math.floor(Math.random() * enemyCards.length);
        const ti = Math.floor(Math.random() * myCards.length);
        const a = enemyCards[ai], t = myCards[ti];
        t.life -= a.attack; a.life -= t.attack;
        status.textContent = `Enemy (${a.attack}/${Math.max(0,a.life)}) ⚔️ Your (${t.attack}/${Math.max(0,t.life)})`;
        if (t.life <= 0) myCards.splice(ti, 1);
        if (a.life <= 0) enemyCards.splice(ai, 1);
      }
      render(); turn++;
      setTimeout(step, 1500);
    }
    setTimeout(step, 1500);
  }

  function returnToShop() {
    inCombatPhase = false; endTurnReadyLocal = false; endTurnReadyPeer = false;
    peerBoardState = null; localBoardState = null;

    [shopSection, handSection].forEach(s => s.style.display = 'flex');
    [refreshButton, upgradeButton, endTurnButton, goldText, rankText].forEach(e => e.style.display = '');
    document.querySelectorAll('.card:not(.combat-card)').forEach(c => c.style.display = '');
    document.querySelectorAll('.shop-card-lock').forEach(l => l.style.display = '');

    boardSection.style.cssText = '';
    boardSection.className = 'section';
    boardSection.id = 'board';
    boardSection.innerHTML = '';

    // Clean up orphaned cards (slots destroyed by innerHTML='')
    document.querySelectorAll('.card').forEach(card => {
      if (card.dataset.slotId && !document.querySelector(`[data-card-id="${card.dataset.slotId}"]`)) {
        removeShopCardLock(card); card.remove();
      }
    });
    document.querySelectorAll('.combat-card').forEach(c => c.remove());

    updateEndTurnUI();
    maxGold += 1; replenishGold();
  }

  // === GOLD ===
  function updateGold(amount) { currentGold += amount; goldText.textContent = `Gold: ${currentGold}`; }
  function replenishGold() { currentGold = maxGold; goldText.textContent = `Gold: ${currentGold}`; }
  function getMaxNumberByRank() { return currentRank * 10; }

  // === SHOP ===
  function generateRandomSlots() {
    if (isAnimating) return;
    isAnimating = true; refreshButton.disabled = true;

    document.querySelectorAll('.card.animate__animated.animate__backOutUp').forEach(c => c.remove());
    document.querySelectorAll('.card.smooth-move[style*="visibility: hidden"]').forEach(c => c.remove());

    const lockedCards = [];
    document.querySelectorAll('.card').forEach(card => {
      const slotId = card.dataset.slotId;
      const slot = document.querySelector(`[data-card-id="${slotId}"]`);
      const rect = card.getBoundingClientRect();
      if (card.dataset.locked === 'true' && slot && shopSection.contains(slot)) {
        lockedCards.push({ slotId, attack: card.dataset.attack, life: card.dataset.life,
          position: [...slot.parentNode.children].indexOf(slot),
          startX: rect.left + window.scrollX, startY: rect.top + window.scrollY });
        card.dataset.locked = 'false'; removeShopCardLock(card); card.remove();
      } else if (slot && shopSection.contains(slot)) {
        cloneAndAnimateCard(card); removeShopCardLock(card); card.remove();
      }
    });

    shopSection.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot'; slot.draggable = false;
      const slotId = `shop-card-${shopSlotCounter++}`;
      slot.dataset.cardId = slotId;
      const card = document.createElement('div');
      card.dataset.slotId = slotId;
      shopSection.appendChild(slot);

      const locked = lockedCards.find(l => l.position === i);
      if (locked) {
        card.dataset.attack = locked.attack; card.dataset.life = locked.life;
        card.dataset.locked = 'true'; card.dataset.fromShop = true;
        card.className = 'card smooth-move'; renderCardContent(card);
        card.style.position = 'absolute';
        card.style.left = `${locked.startX}px`; card.style.top = `${locked.startY}px`;
        document.body.appendChild(card);
        addShopCardLock(card, false);
        const sr = slot.getBoundingClientRect();
        requestAnimationFrame(() => {
          card.style.left = `${sr.left + window.scrollX}px`;
          card.style.top = `${sr.top + window.scrollY}px`;
        });
      } else {
        card.dataset.attack = Math.floor(Math.random() * 5) + 1;
        card.dataset.life = Math.floor(Math.random() * 5) + 1;
        card.dataset.locked = 'false'; card.dataset.fromShop = true;
        card.className = 'card animate__animated animate__backInLeft';
        renderCardContent(card);
        document.body.appendChild(card);
        addShopCardLock(card, true);
        card.addEventListener('animationend', (e) => {
          if (e.animationName === 'backInLeft') {
            isAnimating = false; slot.draggable = true; refreshButton.disabled = false;
            enableShopSlotsDragAndInteraction();
            card.classList.add('smooth-move'); card.classList.remove('animate__animated');
          }
        });
      }
      followCardMovement(card, slot);
    }
  }

  // === LOCK ===
  function addShopCardLock(card, isLocked = true) {
    const slot = document.querySelector(`[data-card-id="${card.dataset.slotId}"]`);
    if (!shopSection.contains(slot)) return;
    const lock = document.createElement('button');
    lock.className = 'shop-card-lock'; document.body.appendChild(lock);
    lock.textContent = isLocked ? 'Lock' : 'Unlock';
    if (!isLocked) { card.dataset.locked = 'true'; renderCardContent(card); }
    lock.addEventListener('click', () => {
      if (lock.textContent === 'Lock') { lock.textContent = 'Unlock'; card.dataset.locked = 'true'; }
      else { lock.textContent = 'Lock'; card.dataset.locked = 'false'; }
      renderCardContent(card);
    });
    function updatePos() {
      const cr = card.getBoundingClientRect(), lr = lock.getBoundingClientRect();
      lock.style.left = `${cr.left + window.scrollX + (cr.width - lr.width) / 2}px`;
      lock.style.top = `${cr.top + window.scrollY - lr.height - 0.5 * parseFloat(getComputedStyle(card).fontSize)}px`;
      requestAnimationFrame(updatePos);
    }
    updatePos(); card._lock = lock;
  }

  function removeShopCardLock(card) { if (card._lock) { card._lock.remove(); card._lock = null; } }

  // === BUTTONS ===
  upgradeButton.addEventListener("click", () => {
    if (currentRank < 6) { currentRank++; rankText.textContent = `Rank ${currentRank}`; }
  });
  endTurnButton.addEventListener("click", () => {
    if (inCombatPhase || endTurnReadyLocal) return;
    endTurnReadyLocal = true; updateEndTurnUI();
    if (sendEndTurn) sendEndTurn(true); checkCombatPhase();
  });
  refreshButton.addEventListener("click", () => {
    if (currentGold > 0) { updateGold(-1); generateRandomSlots(); }
  });

  // === ANIMATIONS ===
  function cloneAndAnimateCard(card) {
    const clone = card.cloneNode(true); clone.style.pointerEvents = 'none';
    const r = card.getBoundingClientRect();
    clone.style.left = `${r.left + window.scrollX}px`; clone.style.top = `${r.top + window.scrollY}px`;
    document.body.appendChild(clone);
    clone.classList.add('animate__animated', 'animate__backOutRight');
    clone.addEventListener('animationend', () => clone.remove());
  }

  function followCardMovement(card, slot) {
    function move() {
      const r = slot.getBoundingClientRect();
      card.style.left = `${r.left + (r.width/2) - (card.offsetWidth/2)}px`;
      card.style.top = `${r.top + (r.height/2) - (card.offsetHeight/2)}px`;
      requestAnimationFrame(move);
    }
    move();
  }

  // === DRAG & DROP ===
  function addDragAndDropListeners() {
    const sections = document.querySelectorAll(".section");
    document.addEventListener("dragstart", (e) => {
      const slot = e.target.closest('.slot');
      if (slot && !isDragging && (!isAnimating || !shopSection.contains(slot))) {
        isDragging = true; e.target.classList.add("dragging");
        originalSection = e.target.closest('.section');
        removeOnDrop = false; droppedInShop = false;
        const cardId = e.target?.dataset?.cardId;
        const card = document.querySelector(`[data-slot-id="${cardId}"]`);
        if (card && originalSection === shopSection) {
          card.dataset.fromShop = true; card.classList.add('smooth-move'); removeShopCardLock(card);
        } else if (card) { card.dataset.fromShop = false; }
        if (card) { card.style.visibility = 'hidden'; createFollowCard(card, e); }
      }
    });
    document.addEventListener("dragend", endDragOperation);
    document.addEventListener("dragover", (e) => {
      if (followCard) {
        targetPosition.x = e.pageX - followCard.offsetWidth / 2;
        targetPosition.y = e.pageY - followCard.offsetHeight / 2;
      }
    });
    sections.forEach((section, index) => {
      section.addEventListener("dragover", (e) => {
        e.preventDefault();
        const dragging = document.querySelector(".dragging");
        if (dragging) dragging.classList.add('smooth-move');
        if ((index===1||index===2) && originalSection===shopSection && currentGold<=0) return;
        if (index===0 && originalSection && originalSection!==section) { droppedInShop=true; return; }
        else if (originalSection===section) { removeOnDrop=false; droppedInShop=false; }
        else { droppedInShop=false; }
        const slots = section.querySelectorAll(".slot");
        if (index===1 && slots.length>=7 && !section.contains(dragging)) return;
        if (index===2 && slots.length>=10 && !section.contains(dragging)) return;
        const after = getNewPosition(section, e.clientX);
        if (after) after.insertAdjacentElement("afterend", dragging);
        else section.prepend(dragging);
      });
    });
  }

  function endDragOperation() {
    const dragging = document.querySelector(".dragging");
    if (dragging) {
      dragging.classList.remove("dragging");
      const cardId = dragging?.dataset?.cardId;
      const card = document.querySelector(`[data-slot-id="${cardId}"]`);
      if (droppedInShop) {
        dragging.remove(); freezeAndAnimateFollowCard(card);
        if (card.dataset.fromShop==='true') addShopCardLock(card, card.dataset.locked!=='true');
      } else if (followCard && card) {
        const sr = dragging.getBoundingClientRect();
        targetPosition.x = sr.left+(sr.width/2)-(followCard.offsetWidth/2);
        targetPosition.y = sr.top+(sr.height/2)-(followCard.offsetHeight/2);
        followCard.classList.add('smooth-move');
        followCard.style.left = `${targetPosition.x}px`; followCard.style.top = `${targetPosition.y}px`;
        const cf = followCard;
        cf.addEventListener('transitionend', () => { card.style.visibility='visible'; latestFollowCardMap.delete(cardId); removeFollowCard(cf); });
        interpolateRotationToZero(cf);
        const inHB = handSection.contains(dragging)||boardSection.contains(dragging);
        if (inHB) {
          card.dataset.locked='false'; renderCardContent(card); removeShopCardLock(card);
          if (originalSection===shopSection && currentGold>0) updateGold(-1);
        } else if (originalSection===shopSection) {
          addShopCardLock(card, card.dataset.locked!=='true');
        }
      }
      if (removeOnDrop) { if(card){removeShopCardLock(card);card.remove();} dragging.remove(); }
    }
    isDragging = false;
  }

  function freezeAndAnimateFollowCard(card) {
    if (followCard) {
      followCard.classList.add('animate__animated','animate__backOutUp');
      followCard.addEventListener('animationend', () => { removeFollowCard(); card.remove(); });
    }
  }

  function getNewPosition(section, posX) {
    const slots = section.querySelectorAll(".slot:not(.dragging)"); let result;
    for (let s of slots) { const b=s.getBoundingClientRect(); if(posX>=b.x+b.width/2) result=s; }
    return result;
  }

  function createFollowCard(card, event) {
    const cardId = card.dataset.slotId;
    const prev = latestFollowCardMap.get(cardId);
    if (prev) removeFollowCard(prev);
    followCard = document.createElement('div');
    followCard.className = 'card'; followCard.style.zIndex = 1000;
    followCard.innerHTML = card.innerHTML;
    const shiftX = event.clientX - card.getBoundingClientRect().left;
    const shiftY = event.clientY - card.getBoundingClientRect().top;
    targetPosition.x = event.pageX - shiftX; targetPosition.y = event.pageY - shiftY;
    followCard.style.left = `${targetPosition.x}px`; followCard.style.top = `${targetPosition.y}px`;
    document.body.append(followCard);
    latestFollowCardMap.set(cardId, followCard);
    requestAnimationFrame(lerpToTarget);
  }

  function interpolateRotationToZero(card) {
    const a = 0.1;
    function anim() {
      tiltX *= 1-a; tiltY *= 1-a;
      card.style.transform = `perspective(25vw) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      if (Math.abs(tiltX)>0.01||Math.abs(tiltY)>0.01) requestAnimationFrame(anim);
      else { tiltX=0; tiltY=0; card.style.transform='perspective(25vw) rotateX(0deg) rotateY(0deg)'; }
    }
    requestAnimationFrame(anim);
  }

  function removeFollowCard(c) {
    if(c){c.remove();if(c===followCard)followCard=null;} }

  function applyTiltEffect(card, x, y, sensitivity=6, damping=0.3) {
    const dx=x-previousX, dy=y-previousY; previousX=x; previousY=y;
    const maxT=25, mf=sensitivity*0.6;
    tiltX -= dy*mf; tiltY += dx*mf;
    tiltX=Math.max(-maxT,Math.min(maxT,tiltX)); tiltY=Math.max(-maxT,Math.min(maxT,tiltY));
    tiltX *= 1-damping; tiltY *= 1-damping;
    card.style.transform = `perspective(25vw) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  }

  function lerpToTarget() {
    if (followCard && !followCard.classList.contains('smooth-move')) {
      const cx=parseFloat(followCard.style.left), cy=parseFloat(followCard.style.top);
      const nx=cx+(targetPosition.x-cx)*lerpAlpha, ny=cy+(targetPosition.y-cy)*lerpAlpha;
      followCard.style.left=`${nx}px`; followCard.style.top=`${ny}px`;
      applyTiltEffect(followCard, nx, ny, 3, 0.3);
      requestAnimationFrame(lerpToTarget);
    }
  }

  function enableShopSlotsDragAndInteraction() {
    shopSection.querySelectorAll('.slot').forEach(s => s.draggable = true);
  }

  addDragAndDropListeners();
});
