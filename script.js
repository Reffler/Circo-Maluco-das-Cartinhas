import { joinRoom } from '@trystero-p2p/torrent';

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
      currentRank = 1,
      currentGold = 1,
      maxGold = 1;

  const rankText = document.getElementById("rank-text");

  const lobbyScreen = document.getElementById('lobby-screen');
  const gameScreen = document.getElementById('game-screen');
  const hostBtn = document.getElementById('host-btn');
  const joinBtn = document.getElementById('join-btn');
  const joinInput = document.getElementById('join-input');
  const lobbyStatus = document.getElementById('lobby-status');
  
  let room;
  let sendEndTurn, getEndTurn, sendBoardState, getBoardState;
  let endTurnReadyLocal = false;
  let endTurnReadyPeer = false;
  let inCombatPhase = false;

  const appConfig = { appId: 'circo-maluco-custom-multiplayer-v1' };
  
  hostBtn.addEventListener('click', () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    joinInput.value = roomId;
    lobbyStatus.textContent = "Waiting for peer... Code: " + roomId;
    setupMultiplayer(roomId, true);
  });
  
  joinBtn.addEventListener('click', () => {
    const roomId = joinInput.value.trim();
    if (!roomId) return;
    lobbyStatus.textContent = "Joining room...";
    setupMultiplayer(roomId, false);
  });
  
  function setupMultiplayer(roomId, isHost) {
    room = joinRoom(appConfig, roomId);
    
    [sendEndTurn, getEndTurn] = room.makeAction('endTurn');
    [sendBoardState, getBoardState] = room.makeAction('boardState');
    
    room.onPeerJoin(peerId => {
      lobbyScreen.style.display = 'none';
      gameScreen.style.display = 'flex'; // Start the game!
    });
    
    room.onPeerLeave(peerId => {
      alert("Peer left the game.");
      location.reload();
    });
    
    getEndTurn((data, peerId) => {
      endTurnReadyPeer = true;
      updateEndTurnUI();
      checkCombatPhase();
    });
    
    getBoardState((boardArray, peerId) => {
      peerBoardState = boardArray;
      renderCombatPhaseIfNeeded();
    });
  }

  let peerBoardState = null;
  let localBoardState = null;

  function updateEndTurnUI() {
     let count = 0;
     if (endTurnReadyLocal) count++;
     if (endTurnReadyPeer) count++;
     endTurnButton.textContent = `End Turn (${count}/2)`;
  }
  
  function checkCombatPhase() {
     if (endTurnReadyLocal && endTurnReadyPeer && !inCombatPhase) {
        inCombatPhase = true;
        
        const cards = Array.from(boardSection.querySelectorAll('.card'));
        cards.sort((a, b) => {
           let ax = parseFloat(a.style.left) || 0;
           let bx = parseFloat(b.style.left) || 0;
           return ax - bx;
        });
        localBoardState = cards.map(c => c.textContent.replace(' L', ''));
        if(cards.length === 0) localBoardState = ['Empty']; 

        sendBoardState(localBoardState);
        renderCombatPhaseIfNeeded();
     }
  }
  
  function renderCombatPhaseIfNeeded() {
     if (localBoardState && peerBoardState) {
        shopSection.style.display = 'none';
        handSection.style.display = 'none';
        refreshButton.style.display = 'none';
        upgradeButton.style.display = 'none';
        endTurnButton.style.display = 'none';
        document.getElementById('gold-text').style.display = 'none';
        document.getElementById('rank-text').style.display = 'none';
        
        const allCards = document.querySelectorAll('.card');
        allCards.forEach(c => c.style.display = 'none');

        boardSection.style.height = '100vh'; 
        boardSection.style.flexDirection = 'row';
        boardSection.innerHTML = '';
        
        const localContainer = document.createElement('div');
        localContainer.style.display = 'flex';
        localContainer.style.gap = '1vw';
        localContainer.style.flexDirection = 'row';
        localContainer.style.border = '0.5vw solid lime';
        localContainer.style.padding = '2vw';
        localContainer.style.borderRadius = '1vw';
        localContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
        
        const peerContainer = document.createElement('div');
        peerContainer.style.display = 'flex';
        peerContainer.style.gap = '1vw';
        peerContainer.style.flexDirection = 'row';
        peerContainer.style.border = '0.5vw solid red';
        peerContainer.style.padding = '2vw';
        peerContainer.style.borderRadius = '1vw';
        peerContainer.style.backgroundColor = 'rgba(0,0,0,0.5)';
        
        localBoardState.forEach(text => {
            const slot = document.createElement('div');
            slot.className = 'slot';
            slot.style.opacity = 1;
            slot.style.position = 'relative';
            if (text && text !== 'Empty') {
               const c = document.createElement('div');
               c.className = 'card';
               c.textContent = text;
               c.style.position = 'absolute';
               c.style.left = '0';
               c.style.top = '0';
               c.style.pointerEvents = 'none';
               c.style.display = 'flex';
               c.style.justifyContent = 'center';
               c.style.alignItems = 'center';
               slot.appendChild(c);
            }
            localContainer.appendChild(slot);
        });
        
        peerBoardState.forEach(text => {
            const slot = document.createElement('div');
            slot.className = 'slot';
            slot.style.opacity = 1;
            slot.style.position = 'relative';
            if (text && text !== 'Empty') {
               const c = document.createElement('div');
               c.className = 'card';
               c.textContent = text;
               c.style.position = 'absolute';
               c.style.left = '0';
               c.style.top = '0';
               c.style.pointerEvents = 'none';
               c.style.display = 'flex';
               c.style.justifyContent = 'center';
               c.style.alignItems = 'center';
               slot.appendChild(c);
            }
            peerContainer.appendChild(slot);
        });

        const vsText = document.createElement('div');
        vsText.style.color = 'white';
        vsText.style.fontSize = '4vw';
        vsText.style.margin = '0 2vw';
        vsText.style.fontWeight = 'bold';
        vsText.textContent = 'VS';
        
        boardSection.appendChild(localContainer);
        boardSection.appendChild(vsText);
        boardSection.appendChild(peerContainer);
     }
  }

  const goldText = document.getElementById("gold-text");

  function updateGold(amount) {
    currentGold += amount;
    goldText.textContent = `Gold: ${currentGold}`;
  }

  function replenishGold() {
    currentGold = maxGold;
    goldText.textContent = `Gold: ${currentGold}`;
  }

  function getMaxNumberByRank() {
    return currentRank * 10;
  }

function generateRandomSlots() {
  if (isAnimating) return;

  isAnimating = true;
  refreshButton.disabled = true;

  // Remove lingering cloned cards
  const lingeringCardsBackOutUp = document.querySelectorAll('.card.animate__animated.animate__backOutUp');
  lingeringCardsBackOutUp.forEach(card => {
    card.remove();
  });

  const lingeringHiddenCards = document.querySelectorAll('.card.smooth-move[style*="visibility: hidden"]');
  lingeringHiddenCards.forEach(card => {
    card.remove();
  });

  // Store the locked cards, their respective slots, and their current positions
  const lockedCards = [];
  const oldCards = document.querySelectorAll('.card');

  oldCards.forEach(card => {
    const slotId = card.dataset.slotId;
    const associatedSlot = document.querySelector(`[data-card-id="${slotId}"]`);
    const cardRect = card.getBoundingClientRect(); // Capture card's current position

    // If the card has "L", store it in the lockedCards array with its current and slot position
    if (card.textContent.includes(' L') && associatedSlot && shopSection.contains(associatedSlot)) {
      lockedCards.push({
        slotId: slotId,
        cardText: card.textContent.replace(' L', ''), // Remove the "L" to store the original number
        position: [...associatedSlot.parentNode.children].indexOf(associatedSlot), // Store its position
        startX: cardRect.left + window.scrollX, // Capture the current X position
        startY: cardRect.top + window.scrollY   // Capture the current Y position
      });
      removeShopCardLock(card); // Ensure the lock is removed
      card.remove(); // Remove the card from the DOM
    } else if (associatedSlot && shopSection.contains(associatedSlot)) {
      cloneAndAnimateCard(card);
      removeShopCardLock(card); // Ensure the lock is removed when the card is removed
      card.remove();
    }
  });

  shopSection.innerHTML = '';

  const maxNumber = getMaxNumberByRank();

  for (let i = 0; i < 7; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.draggable = false;

    // Assign slotId and dataset
    const slotId = `shop-card-${shopSlotCounter++}`;
    slot.dataset.cardId = slotId;

    const card = document.createElement('div');
    card.dataset.slotId = slotId;

    // Append the slot to the shopSection before calling addShopCardLock
    shopSection.appendChild(slot);

    // Check if the current slot position has a locked card to insert
    const lockedCard = lockedCards.find(locked => locked.position === i);

    if (lockedCard) {
      // Locked card
      card.textContent = `${lockedCard.cardText} L`;
      card.dataset.fromShop = true; // Mark as from shop
      card.className = 'card smooth-move';

      // Set the card's initial position to its old position
      card.style.position = 'absolute';
      card.style.left = `${lockedCard.startX}px`;
      card.style.top = `${lockedCard.startY}px`;

      // Append the card to the document
      document.body.appendChild(card);

      // Add the lock button with the state set to "Unlock"
      addShopCardLock(card, false); // false means it's "unlocked"

      // Move the card to its new position after it's appended to the document
      const slotRect = slot.getBoundingClientRect();
      requestAnimationFrame(() => {
        const targetX = slotRect.left + window.scrollX;
        const targetY = slotRect.top + window.scrollY;

        // Move smoothly to the new slot position
        card.style.left = `${targetX}px`;
        card.style.top = `${targetY}px`;
      });
    } else {
      // New random card
      const randomNumber = Math.floor(Math.random() * maxNumber) + 1;
      card.textContent = randomNumber;
      card.dataset.fromShop = true; // Mark as from shop
      card.className = 'card animate__animated animate__backInLeft';

      // Append the card to the document
      document.body.appendChild(card);

      // Add the lock button in the default "locked" state
      addShopCardLock(card, true); // true means it's "locked"

      // Add animation end listener
      card.addEventListener('animationend', (event) => {
        if (event.animationName === 'backInLeft') {
          isAnimating = false;
          slot.draggable = true;
          refreshButton.disabled = false;

          enableShopSlotsDragAndInteraction();
          card.classList.add('smooth-move');
          card.classList.remove('animate__animated');
        }
      });
    }

    followCardMovement(card, slot);
  }
}


function addShopCardLock(card, isLocked = true) {
  // Only add a lock if the card is in the shop section
  const associatedSlot = document.querySelector(`[data-card-id="${card.dataset.slotId}"]`);
  if (!shopSection.contains(associatedSlot)) return;

  // Create a lock button for the card in the shop
  const lock = document.createElement('button');
  lock.className = 'shop-card-lock';
  document.body.appendChild(lock);

  // If the card is locked, the button shows "Lock"; if unlocked, it shows "Unlock"
  lock.textContent = isLocked ? 'Lock' : 'Unlock';

  // Store the original card content (number) for toggling later
  const originalContent = card.textContent.replace(' L', ''); // Remove any existing "L" for handling

  // Set the card text with "L" if it's unlocked
  if (!isLocked) {
    card.textContent = `${originalContent} L`; // Ensure only one "L" is appended
  }

  // Toggle the lock/unlock state when the button is clicked
  lock.addEventListener('click', () => {
    if (lock.textContent === 'Lock') {
      lock.textContent = 'Unlock';
      card.textContent = `${originalContent} L`; // Add "L" beside the number
    } else {
      lock.textContent = 'Lock';
      card.textContent = originalContent; // Revert to the original content (number only)
    }
  });

  // Update the lock's position to follow the card
function updateLockPosition() {
  const cardRect = card.getBoundingClientRect();
  const lockRect = lock.getBoundingClientRect();
  lock.style.left = `${cardRect.left + window.scrollX + (cardRect.width - lockRect.width) / 2}px`;
  lock.style.top = `${cardRect.top + window.scrollY - lockRect.height - 0.5 * parseFloat(getComputedStyle(card).fontSize)}px`; // Adjust spacing as needed
  requestAnimationFrame(updateLockPosition);
}

  updateLockPosition();

  // Store lock reference in the card for future removal
  card._lock = lock;
}

  function removeShopCardLock(card) {
    if (card._lock) {
      card._lock.remove();
      card._lock = null;
    }
  }

  // Upgrade button functionality with max rank cap of 6
  upgradeButton.addEventListener("click", () => {
    if (currentRank < 6) {
      currentRank += 1;
      rankText.textContent = `Rank ${currentRank}`;
    }
  });

  // End Turn button functionality to replenish gold and increase the max
  endTurnButton.addEventListener("click", () => {
    if (typeof inCombatPhase !== 'undefined' && inCombatPhase) return;
    if (typeof endTurnReadyLocal !== 'undefined' && endTurnReadyLocal) return;
    
    maxGold += 1; // Increase the maximum gold by 1 each time "End Turn" is clicked
    replenishGold(); // Replenish current gold to the new maximum
    
    if (typeof endTurnReadyLocal !== 'undefined') {
        endTurnReadyLocal = true;
        updateEndTurnUI();
        if (sendEndTurn) sendEndTurn(true);
        checkCombatPhase();
    }
  });

  // Refresh button functionality - costs 1 gold
  refreshButton.addEventListener("click", () => {
    if (currentGold > 0) {
      updateGold(-1); // Decrease gold by 1
      generateRandomSlots(); // Generate new random slots
    } else {
      console.log("Not enough gold"); // Log message to console if no gold
    }
  });

  function cloneAndAnimateCard(card) {
    const clone = card.cloneNode(true);
    clone.style.pointerEvents = 'none';

    const cardRect = card.getBoundingClientRect();
    clone.style.left = `${cardRect.left + window.scrollX}px`;
    clone.style.top = `${cardRect.top + window.scrollY}px`;

    document.body.appendChild(clone);

    clone.classList.add('animate__animated', 'animate__backOutRight');

    clone.addEventListener('animationend', () => {
      clone.remove();
    });
  }

  function followCardMovement(card, slot) {
    function move() {
      const slotRect = slot.getBoundingClientRect();

      const targetX = slotRect.left + (slotRect.width / 2) - (card.offsetWidth / 2);
      const targetY = slotRect.top + (slotRect.height / 2) - (card.offsetHeight / 2);

      card.style.left = `${targetX}px`;
      card.style.top = `${targetY}px`;

      requestAnimationFrame(move);
    }

    move();
  }

  function addDragAndDropListeners() {
    const sections = document.querySelectorAll(".section");

    document.addEventListener("dragstart", (e) => {
      const slot = e.target.closest('.slot');
      if (slot && !isDragging && (!isAnimating || !shopSection.contains(slot))) {
        isDragging = true;
        e.target.classList.add("dragging");
        originalSection = e.target.closest('.section'); // Track the original section (shop, board, or hand)
        removeOnDrop = false;
        droppedInShop = false;

        const cardId = e.target?.dataset?.cardId;
        const card = document.querySelector(`[data-slot-id="${cardId}"]`);

        // Mark the card as being from the shop when it's dragged from the shop
        if (card && originalSection === shopSection) {
          card.dataset.fromShop = true; // Mark the card as being from the shop
          card.classList.add('smooth-move');
          removeShopCardLock(card); // Remove the lock immediately when dragging out of shop
        } else {
          card.dataset.fromShop = false; // Mark the card as not from the shop
        }

        if (card) {
          card.style.visibility = 'hidden';
          createFollowCard(card, e);
        }
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
        if (dragging) {
          dragging.classList.add('smooth-move');
        }

        const isDroppedInHandOrBoard = index === 1 || index === 2;
        const isCardFromShop = originalSection === shopSection;

        // Only allow dropping into hand or board if gold is > 0 when dragging from shop
        if (isDroppedInHandOrBoard && isCardFromShop && currentGold <= 0) {
          console.log("Not enough gold");
          return;
        }

        if (index === 0 && originalSection && originalSection !== section) {
          droppedInShop = true;
          return;
        } else if (originalSection === section) {
          removeOnDrop = false;
          droppedInShop = false;
        } else {
          droppedInShop = false;
        }

        const slots = section.querySelectorAll(".slot");
        if (index === 1 && slots.length >= 7 && !section.contains(dragging)) {
          return;
        }

        if (index === 2 && slots.length >= 10 && !section.contains(dragging)) {
          return;
        }

        const applyAfter = getNewPosition(section, e.clientX);

        if (applyAfter) {
          applyAfter.insertAdjacentElement("afterend", dragging);
        } else {
          section.prepend(dragging);
        }
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
      if (dragging) {
        dragging.remove();
      }
      freezeAndAnimateFollowCard(card);

      // Only add the lock back if the card originally came from the shop
      if (card.dataset.fromShop === 'true') {
        const isLocked = !card.textContent.includes(' L'); // Check if card should be locked or unlocked
        addShopCardLock(card, isLocked); // Pass the correct lock state
      }
    } else if (followCard && card) {
      const slotRect = dragging.getBoundingClientRect();
      targetPosition.x = slotRect.left + (slotRect.width / 2) - (followCard.offsetWidth / 2);
      targetPosition.y = slotRect.top + (slotRect.height / 2) - (followCard.offsetHeight / 2);

      followCard.classList.add('smooth-move');
      followCard.style.left = `${targetPosition.x}px`;
      followCard.style.top = `${targetPosition.y}px`;

      const currentFollowCard = followCard;

      currentFollowCard.addEventListener('transitionend', () => {
        card.style.visibility = 'visible';
        latestFollowCardMap.delete(cardId);
        removeFollowCard(currentFollowCard);
      });

      interpolateRotationToZero(currentFollowCard);

      // Check if the card is dropped in the hand or board and came from the shop
      const isDroppedInHandOrBoard = handSection.contains(dragging) || boardSection.contains(dragging);
      if (isDroppedInHandOrBoard) {
        // Remove "L" from card and unlock it if dropped in hand or board
        card.textContent = card.textContent.replace(' L', ''); // Remove the "L"
        removeShopCardLock(card); // Remove the lock button

        if (originalSection === shopSection && currentGold > 0) {
          updateGold(-1); // Decrease gold by 1 only if it came from the shop
        } else if (currentGold <= 0) {
          // Return the card to its original slot in the shop if gold is 0
          const originalSlot = document.querySelector(`[data-card-id="${cardId}"]`);
          if (originalSlot && shopSection.contains(originalSlot)) {
            originalSlot.appendChild(card);
            card.style.visibility = 'visible';
            card.classList.add('smooth-move');

            const isLocked = !card.textContent.includes(' L'); // Check if the card should be locked or unlocked
            addShopCardLock(card, isLocked); // Pass the correct lock state
          }
        }
      } else if (originalSection === shopSection) {
        // Re-add the lock in its correct state when the card is returned to the shop
        const isLocked = !card.textContent.includes(' L');
        addShopCardLock(card, isLocked); // Pass the correct lock state
      }
    }

    if (removeOnDrop) {
      if (card) {
        removeShopCardLock(card); // Remove lock if the card is being removed
        card.remove();
      }
      dragging.remove();
    }
  }
  isDragging = false;
}

  function freezeAndAnimateFollowCard(card) {
    if (followCard) {
      followCard.classList.add('animate__animated', 'animate__backOutUp');
      followCard.addEventListener('animationend', () => {
        removeFollowCard();
        card.remove();
      });
    }
  }

  function getNewPosition(section, posX) {
    const slots = section.querySelectorAll(".slot:not(.dragging)");
    let result;

    for (let refer_slot of slots) {
      const box = refer_slot.getBoundingClientRect();
      const boxCenterX = box.x + box.width / 2;

      if (posX >= boxCenterX) {
        result = refer_slot;
      }
    }

    return result;
  }

  function createFollowCard(card, event) {
    const cardId = card.dataset.slotId;

    const previousFollowCard = latestFollowCardMap.get(cardId);
    if (previousFollowCard) {
      removeFollowCard(previousFollowCard);
    }

    followCard = document.createElement('div');
    followCard.className = 'card';
    followCard.style.zIndex = 1000;

    followCard.textContent = card.textContent;

    let shiftX = event.clientX - card.getBoundingClientRect().left;
    let shiftY = event.clientY - card.getBoundingClientRect().top;

    targetPosition.x = event.pageX - shiftX;
    targetPosition.y = event.pageY - shiftY;

    followCard.style.left = `${targetPosition.x}px`;
    followCard.style.top = `${targetPosition.y}px`;

    document.body.append(followCard);

    latestFollowCardMap.set(cardId, followCard);

    requestAnimationFrame(lerpToTarget);
  }

  function interpolateRotationToZero(card) {
    const lerpRotationAlpha = 0.1;

    function animateRotation() {
      tiltX *= 1 - lerpRotationAlpha;
      tiltY *= 1 - lerpRotationAlpha;

      card.style.transform = `perspective(25vw) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;

      if (Math.abs(tiltX) > 0.01 || Math.abs(tiltY) > 0.01) {
        requestAnimationFrame(animateRotation);
      } else {
        tiltX = 0;
        tiltY = 0;
        card.style.transform = `perspective(25vw) rotateX(0deg) rotateY(0deg)`;
      }
    }

    requestAnimationFrame(animateRotation);
  }

  function removeFollowCard(cardToRemove) {
    if (cardToRemove) {
      cardToRemove.remove();
      if (cardToRemove === followCard) {
        followCard = null;
      }
    }
  }

  function applyTiltEffect(card, x, y, sensitivity = 6, damping = 0.3) {
    const deltaX = x - previousX;
    const deltaY = y - previousY;

    previousX = x;
    previousY = y;

    const maxTilt = 25;
    const moveFactor = sensitivity * 0.6;

    tiltX -= deltaY * moveFactor;
    tiltY += deltaX * moveFactor;

    tiltX = Math.max(-maxTilt, Math.min(maxTilt, tiltX));
    tiltY = Math.max(-maxTilt, Math.min(maxTilt, tiltY));

    tiltX *= 1 - damping;
    tiltY *= 1 - damping;

    card.style.transform = `perspective(25vw) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  }

  function lerpToTarget() {
    if (followCard && !followCard.classList.contains('smooth-move')) {
      const currentX = parseFloat(followCard.style.left);
      const currentY = parseFloat(followCard.style.top);

      const newX = currentX + (targetPosition.x - currentX) * lerpAlpha;
      const newY = currentY + (targetPosition.y - currentY) * lerpAlpha;

      followCard.style.left = `${newX}px`;
      followCard.style.top = `${newY}px`;

      applyTiltEffect(followCard, newX, newY, 3, 0.3);

      requestAnimationFrame(lerpToTarget);
    }
  }

  function enableShopSlotsDragAndInteraction() {
    const shopSlots = shopSection.querySelectorAll('.slot');
    shopSlots.forEach(slot => {
      slot.draggable = true;
    });
  }

  addDragAndDropListeners();
  generateRandomSlots();
});
